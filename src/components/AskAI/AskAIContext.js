import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {readAnswer} from '../../../search/stream.mjs';
import {readConversation, saveConversation} from '../../../search/conversation-storage.mjs';

// One chat for the whole site. The provider lives in the root layout, so the docked panel and
// the search modal share the same conversation and it survives client-side navigation.
// IndexedDB holds the conversation; sessionStorage only identifies this tab's chat.

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
  const restoration = useRef(null), panelTouched = useRef(false);
  const pendingRef = useRef(''), copiedTimer = useRef(null);
  const askUrl = useBaseUrl('/api/docs/ask');
  turnsRef.current = turns;
  pendingRef.current = pendingQuestion;

  // Restore after hydration so the server and first client render match.
  useEffect(() => {
    let cancelled = false;
    restoration.current = readConversation().then(stored => {
      if (cancelled) return;
      if (stored) {
        if (!panelTouched.current) setOpenState(stored.open);
        turnsRef.current = stored.turns;
        setTurns(stored.turns); traceContext.current = stored.traceContext;
      }
      setHydrated(true);
    });
    return () => {cancelled = true; controller.current?.abort(); clearTimeout(copiedTimer.current);};
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveConversation({open, turns, traceContext: traceContext.current});
  }, [hydrated, open, turns]);

  const setOpen = useCallback(value => {
    panelTouched.current = true;
    setOpenState(value);
    if (value) setFocusRequest(count => count + 1);
  }, []);
  const closePanel = useCallback(() => {panelTouched.current = true; setOpenState(false);}, []);
  const toggle = useCallback(() => {
    panelTouched.current = true;
    setOpenState(current => !current);
    setFocusRequest(count => count + 1);
  }, []);

  const stop = useCallback(() => {
    controller.current?.abort(); askingRef.current = false; setAsking(false);
    if (pendingRef.current) setDraft(pendingRef.current);
    setPendingQuestion(''); setStreamedAnswer(''); setStreamedSources([]);
  }, []);

  const newChat = useCallback(async () => {
    await restoration.current;
    controller.current?.abort(); askingRef.current = false; setAsking(false); setPendingQuestion('');
    traceContext.current = undefined;
    turnsRef.current = [];
    setTurns([]); setDraft(''); setError(''); setFailedQuestion('');
    setStreamedAnswer(''); setStreamedSources([]);
    setFocusRequest(count => count + 1);
  }, []);

  const ask = useCallback(async question => {
    await restoration.current;
    if (typeof question !== 'string' || !question.trim() || askingRef.current) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    askingRef.current = true;
    setAsking(true); setPendingQuestion(question); setDraft(''); setError(''); setFailedQuestion('');
    setStreamedAnswer(''); setStreamedSources([]); setProgress('Searching documentation…');
    const history = turnsRef.current.map(({question, answer}) => ({question, answer}));
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
