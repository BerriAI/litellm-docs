import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {readAnswer} from '../../../search/stream.mjs';
import {isContentUrl} from '../../../search/content';

// One chat for the whole site. The provider lives in the root layout, so the docked panel and
// the search modal share the same conversation and it survives client-side navigation.
// The panel state and turns also live in sessionStorage, so a reload in the same tab keeps them.
const storageKey = 'litellm-docs-ask-ai';
const maxStoredTurns = 20;

export const commonQuestions = [
  'How do I set up the LiteLLM proxy?',
  'How do I route requests across multiple models?',
  'How do I enable response caching?',
  'How do I track spend per team or API key?',
];

const noop = () => {};
const AskAIContext = createContext({
  open: false, setOpen: noop, openPanel: noop, closePanel: noop, toggle: noop, ask: noop, stop: noop, newChat: noop,
  copyConversation: noop, retry: noop, turns: [], asking: false, pendingQuestion: '', streamedAnswer: '',
  streamedSources: [], progress: '', error: '', failedQuestion: '', draft: '', setDraft: noop, copied: false,
  focusRequest: 0,
});

export function useAskAI() {
  return useContext(AskAIContext);
}

function readStored() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
    if (!stored || typeof stored !== 'object') return null;
    const turns = (Array.isArray(stored.turns) ? stored.turns : []).filter(turn =>
      turn && typeof turn.question === 'string' && typeof turn.answer === 'string' && Array.isArray(turn.sources) &&
      turn.sources.every(source => source && isContentUrl(source.url)));
    return {
      open: stored.open === true,
      turns: turns.slice(-maxStoredTurns),
      traceContext: typeof stored.traceContext === 'string' ? stored.traceContext : undefined,
    };
  } catch { return null; }
}

export function AskAIProvider({children}) {
  const [open, setOpenState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [error, setError] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [streamedSources, setStreamedSources] = useState([]);
  const [progress, setProgress] = useState('Searching documentation…');
  const [copied, setCopied] = useState(false);
  const controller = useRef(null), traceContext = useRef(undefined), turnsRef = useRef([]), askingRef = useRef(false);
  const pendingRef = useRef(''), copiedTimer = useRef(null);
  const askUrl = useBaseUrl('/api/docs/ask');
  turnsRef.current = turns;
  pendingRef.current = pendingQuestion;

  // Restore after hydration so the server and first client render match.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setOpenState(stored.open); setTurns(stored.turns); traceContext.current = stored.traceContext;
    }
    setHydrated(true);
    return () => {controller.current?.abort(); clearTimeout(copiedTimer.current);};
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({
        open, turns: turns.slice(-maxStoredTurns), traceContext: traceContext.current,
      }));
    } catch { /* storage can be blocked; the chat still works for this page view */ }
  }, [hydrated, open, turns]);

  const setOpen = useCallback(value => {
    setOpenState(value);
    if (value) setFocusRequest(count => count + 1);
  }, []);
  const closePanel = useCallback(() => setOpenState(false), []);
  const toggle = useCallback(() => {
    setOpenState(current => !current);
    setFocusRequest(count => count + 1);
  }, []);

  const stop = useCallback(() => {
    controller.current?.abort(); askingRef.current = false; setAsking(false);
    if (pendingRef.current) setDraft(pendingRef.current);
    setPendingQuestion(''); setStreamedAnswer(''); setStreamedSources([]);
  }, []);

  const newChat = useCallback(() => {
    controller.current?.abort(); askingRef.current = false; setAsking(false); setPendingQuestion('');
    traceContext.current = undefined;
    setTurns([]); setDraft(''); setError(''); setFailedQuestion('');
    setStreamedAnswer(''); setStreamedSources([]);
    setFocusRequest(count => count + 1);
  }, []);

  const ask = useCallback(async question => {
    if (typeof question !== 'string' || !question.trim() || askingRef.current) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    askingRef.current = true;
    setAsking(true); setPendingQuestion(question); setDraft(''); setError(''); setFailedQuestion('');
    setStreamedAnswer(''); setStreamedSources([]); setProgress('Searching documentation…');
    const history = turnsRef.current.slice(-4).map(turn => ({question: turn.question}));
    try {
      const response = await fetch(askUrl, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'},
        body: JSON.stringify({question, history, traceContext: traceContext.current}), signal: pending.signal});
      const context = response.headers.get('X-Docs-Trace-Context');
      if (!pending.signal.aborted && context) traceContext.current = context;
      const data = await readAnswer(response, (event, data) => {
        if (pending.signal.aborted) return;
        if (event === 'status') setProgress(data.message);
        if (event === 'answer-delta') setStreamedAnswer(previous => previous + data.text);
        if (event === 'sources') setStreamedSources(data.sources);
      }, pending.signal);
      if (!pending.signal.aborted) setTurns(previous => [...previous, {question, ...data}]);
    } catch (failure) {
      if (!pending.signal.aborted) {
        setFailedQuestion(question); setDraft(question);
        setError(failure.message === 'Failed to fetch' ? 'Ask AI could not connect. Please try again.' : failure.message);
      }
    } finally {
      if (!pending.signal.aborted) {
        askingRef.current = false; setAsking(false); setPendingQuestion('');
      }
    }
  }, [askUrl]);

  // Opens the panel and, when given a question, sends it as the next turn.
  const openPanel = useCallback(question => {
    setOpen(true);
    if (typeof question === 'string' && question.trim()) ask(question.trim());
  }, [ask, setOpen]);

  const retry = useCallback(() => {
    if (failedQuestion) ask(failedQuestion);
  }, [ask, failedQuestion]);

  const copyConversation = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(turnsRef.current.map(turn => `${turn.question}\n\n${turn.answer}`).join('\n\n'));
      setCopied(true); clearTimeout(copiedTimer.current); copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }, []);

  const value = useMemo(() => ({
    open, setOpen, openPanel, closePanel, toggle, ask, stop, newChat, retry, copyConversation,
    turns, asking, pendingQuestion, streamedAnswer, streamedSources, progress, error, failedQuestion,
    draft, setDraft, copied, focusRequest,
  }), [open, setOpen, openPanel, closePanel, toggle, ask, stop, newChat, retry, copyConversation, turns, asking,
    pendingQuestion, streamedAnswer, streamedSources, progress, error, failedQuestion, draft, copied, focusRequest]);

  return <AskAIContext.Provider value={value}>{children}</AskAIContext.Provider>;
}
