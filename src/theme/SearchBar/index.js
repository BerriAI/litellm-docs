import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ThemedImage from '@theme/ThemedImage';
import {Search, Sparkles, BookOpen, FileText, History, CornerDownLeft, X, Send, Square, User, Copy} from 'lucide-react';
import styles from './styles.module.css';
import {mapCitations} from '../../../search/citations.mjs';
import {readAnswer} from '../../../search/stream.mjs';
import {sourceLabel, sourceDetail} from '../../../search/content';
import {SearchSession} from '../../../search/search-client.mjs';
import {SearchAnalytics} from '../../../search/search-analytics.mjs';
import {track} from '../../components/Conversion/shared';

// One owner renders the modal even when the navbar and docs sidebar both mount a trigger.
const openEvent = 'litellm:open-docs-search';
let owner = null;
const commonQuestions = [
  'How do I set up the LiteLLM proxy?',
  'How do I route requests across multiple models?',
  'How do I enable response caching?',
  'How do I track spend per team or API key?',
];
const welcome = 'Hi! I can help you with LiteLLM; proxy setup, model routing, caching, spend tracking, and more. What would you like to know?';
function Highlighted({text, terms = []}) {
  const escaped = [...new Set(terms)].filter(term => term.length > 1).sort((a,b) => b.length-a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  return text.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
}

function Answer({answer, sources}) {
  const byId = new Map(sources.map(source => [source.id, source]));
  const allowed = new Set(sources.map(source => source.url));
  const markdown = mapCitations(answer, (id, text) => byId.has(id) ? `[${id}](${byId.get(id).url})` : text);
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({href, children}) => allowed.has(href) ? <a className={styles.citation} href={href} aria-label={`Source ${children}`}>{children}</a> : <span>{children}</span>,
    img: () => null,
  }}>{markdown}</ReactMarkdown>;
}

function SourceIcon({source, size = 16}) {
  const Icon = source.type === 'blog' ? FileText : source.type === 'release' ? History : BookOpen;
  return <Icon size={size}/>;
}
function SourceMeta({source}) {
  const detail = sourceDetail(source);
  return <>{sourceLabel(source)}{detail && <> <span>·</span> {detail}</>}</>;
}

export default function SearchBar() {
  const [shortcut, setShortcut] = useState('Ctrl K');
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [contentType, setContentType] = useState('all');
  const [resolvedType, setResolvedType] = useState('all');
  const [results, setResults] = useState([]);
  const [resultSearchId, setResultSearchId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [aiError, setAiError] = useState('');
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [streamedSources, setStreamedSources] = useState([]);
  const [progress, setProgress] = useState('Searching documentation…');
  const [retry, setRetry] = useState(0);
  const input = useRef(null), composer = useRef(null), dialog = useRef(null), worker = useRef(null), latestTurn = useRef(null);
  const requestId = useRef(0), controller = useRef(null), previousFocus = useRef(null);
  const searchSession = useRef(null);
  const analytics = useRef(null);
  if (!analytics.current) analytics.current = new SearchAnalytics({capture: (event, props) => track(event, {
    ...props, surface: 'dialog', environment: window.location.hostname === 'docs.litellm.ai' ? 'production'
      : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) ? 'local' : 'preview',
  })});
  const identity = useRef({});
  const traceContext = useRef(undefined);
  const indexUrl = useBaseUrl('/search-index.json');
  const askUrl = useBaseUrl('/api/docs/ask');
  const rerankUrl = useBaseUrl('/api/docs/search');
  const avatar = {
    light: useBaseUrl('/img/brand/litellm-monogram-blue.svg'),
    dark: useBaseUrl('/img/brand/litellm-monogram-white.svg'),
  };

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const show = (event, source = 'button') => {
      if (owner) return;
      owner = identity.current;
      previousFocus.current = document.activeElement;
      setMode(event?.detail?.mode || 'search');
      analytics.current.open(event?.detail?.mode || 'search', event?.detail?.source || source);
      setOpen(true);
    };
    const key = event => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.isComposing) {
        event.preventDefault(); show(undefined, 'keyboard');
      }
    };
    window.addEventListener(openEvent, show);
    window.addEventListener('keydown', key);
    const pageExit = () => analytics.current.close('page_exit');
    window.addEventListener('pagehide', pageExit);
    return () => {
      window.removeEventListener(openEvent, show);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pagehide', pageExit);
      analytics.current.close('unmounted');
      searchSession.current?.cancel(); worker.current?.terminate(); controller.current?.abort();
      if (owner === identity.current) owner = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const overflow = document.body.style.overflow;
    const page = document.getElementById('__docusaurus');
    const wasInert = page?.inert;
    if (page) page.inert = true;
    document.body.style.overflow = 'hidden';
    (mode === 'search' ? input.current : composer.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (page) page.inert = wasInert;
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) (mode === 'search' ? input.current : composer.current)?.focus();
  }, [mode]);
  useEffect(() => {
    if (open && mode === 'ai') latestTurn.current?.scrollIntoView({block: 'start'});
  }, [pendingQuestion, turns.length, open, mode]);

  useEffect(() => {
    const baseline = (query, type, signal) => new Promise((resolve, reject) => {
      const id = ++requestId.current;
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, {once: true});
      if (!worker.current) worker.current = new Worker(new URL('./search.worker.js', import.meta.url));
      worker.current.onmessage = ({data}) => {
        if (data.id !== id || signal.aborted) return;
        signal.removeEventListener('abort', abort);
        if (data.error) reject(new Error(data.error)); else resolve(data);
      };
      worker.current.onerror = () => {
        signal.removeEventListener('abort', abort);
        worker.current?.terminate(); worker.current = null;
        reject(new Error('Search could not load. Please try again.'));
      };
      worker.current.postMessage({id, query, indexUrl, type});
    });
    searchSession.current = new SearchSession({
      onBaseline(data, {final = true} = {}) {
        if (!final) return;
        setResultSearchId(analytics.current.ready(data, 'local'));
        setLoading(false); setSearchError(''); setResults(data.results);
        setResolvedQuery(data.query); setSelected(0);
      },
      onRanking() {analytics.current.requested();},
      onRanked(data) {
        setResultSearchId(analytics.current.ready(data, 'jev'));
        setLoading(false); setSearchError(''); setResults(data.results);
        setResolvedQuery(data.query); setSelected(0);
      },
      // The session publishes one final order, using local matches on failure.
      onRankError() {},
      onError(message, metrics) {analytics.current.failed(metrics); setLoading(false); setSearchError(message);},
    }, {searchBaseline: baseline, rerankUrl});
    return () => searchSession.current.cancel();
  }, [indexUrl, rerankUrl]);

  useEffect(() => {
    if (!open || mode !== 'search') return;
    setSearchError(''); setVisibleCount(25);
    setLoading(Boolean(query.trim()));
    setResolvedType(contentType);
    analytics.current.start(query, contentType);
    searchSession.current.search(query, contentType);
    if (!query.trim()) {
      setLoading(false); setResults([]); setResolvedQuery(''); setSelected(0);
    }
    return () => searchSession.current.cancel();
  }, [query, contentType, open, indexUrl, rerankUrl, retry, mode]);

  useEffect(() => {
    if (!open || mode !== 'search' || loading || !resultSearchId) return;
    const frame = requestAnimationFrame(() => analytics.current.shown(resultSearchId, visibleCount));
    return () => cancelAnimationFrame(frame);
  }, [open, mode, loading, resultSearchId, visibleCount]);

  function stopAnswer() {
    controller.current?.abort(); setAsking(false);
    if (pendingQuestion) setDraft(pendingQuestion);
    setPendingQuestion('');
    setStreamedAnswer(''); setStreamedSources([]);
  }
  function close() {
    analytics.current.close();
    stopAnswer(); searchSession.current?.cancel(); setOpen(false);
    if (owner === identity.current) owner = null;
  }
  function changeQuery(value) {setQuery(value);}
  function openAI(question) {
    analytics.current.emit('mode_changed', {...analytics.current.props(), mode: 'ai'});
    analytics.current.finish('ask_ai');
    setMode('ai');
    if (typeof question === 'string') ask(question);

  }
  function newChat() {
    controller.current?.abort(); setAsking(false); setPendingQuestion('');
    traceContext.current = undefined;
    setTurns([]); setDraft(''); setAiError(''); setFailedQuestion(''); composer.current?.focus();
    setStreamedAnswer(''); setStreamedSources([]);
  }
  async function ask(question = draft) {
    if (!question.trim() || asking) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    setAsking(true); setPendingQuestion(question); setDraft(''); setAiError(''); setFailedQuestion('');
    setStreamedAnswer(''); setStreamedSources([]); setProgress('Searching documentation…');
    const history = turns.slice(-4).map(turn => ({question: turn.question}));
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
    } catch (error) {
      if (!pending.signal.aborted) {
        setFailedQuestion(question); setDraft(question);
        setAiError(error.message === 'Failed to fetch' ? 'Ask AI could not connect. Please try again.' : error.message);
      }
    } finally {
      if (!pending.signal.aborted) {setAsking(false); setPendingQuestion(''); composer.current?.focus();}
    }
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') {event.preventDefault(); close();}
    if (mode === 'search' && event.target === input.current) {
      if (!loading && results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const count = Math.min(visibleCount, results.length);
        setSelected(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (loading || resolvedQuery !== query.trim().replace(/\s+/g, ' ').toLowerCase() || resolvedType !== contentType) return;
        if (results.length) {analytics.current.select(selected, 'keyboard'); window.location.assign(results[selected].url);}
        else openAI(query.trim() || undefined);
      }
    }
    if (event.key === 'Tab') {
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled),input,textarea:not(:disabled),select,summary,a[href]')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
  }
  useEffect(() => {
    if (open && mode === 'search') dialog.current?.querySelector(`[data-result="${selected}"]`)?.scrollIntoView({block: 'nearest'});
  }, [selected, open, mode]);

  async function copyConversation() {
    try {
      await navigator.clipboard.writeText(turns.map(turn => `${turn.question}\n\n${turn.answer}`).join('\n\n'));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }
  const toggle = <div className={styles.tabs} role="group" aria-label="Search mode">
    <button type="button" aria-pressed={mode === 'search'} onClick={() => {analytics.current.emit('mode_changed', {mode: 'search'}); setMode('search');}}><Search size={12}/>Search</button>
    <button type="button" aria-pressed={mode === 'ai'} onClick={() => openAI()}><Sparkles size={12}/>Ask AI</button>
  </div>;
  const assistantAvatar = <ThemedImage className={styles.avatar} sources={avatar} alt="AI assistant avatar"/>;
  return <>
    <button className={styles.trigger} onClick={() => window.dispatchEvent(new Event(openEvent))} aria-label="Search for anything..." title={`Search (${shortcut})`} aria-keyshortcuts="Meta+k Control+k">
      <Search size={18}/><span>Search for anything...</span><kbd>{shortcut}</kbd>
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={`${styles.dialog} ${mode === 'ai' ? styles.chatDialog : ''} ${mode === 'ai' && (turns.length || asking || aiError) ? styles.chatActive : ''}`} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        <header className={styles.header}>
          {mode === 'search' ? <><Search className={styles.searchIcon} size={20}/>
            <input ref={input} value={query} maxLength={500} onChange={event => changeQuery(event.target.value)}
              placeholder="Search for anything..." aria-label="Search documentation" aria-controls="docs-search-results"
              aria-activedescendant={!loading && results.length ? `docs-result-${selected}` : undefined}
              role="combobox" aria-expanded={!!query.trim()} aria-autocomplete="list"/>
          </> : <span className={styles.chatTitle}>Ask LiteLLM AI</span>}
          {toggle}
          <button type="button" className={styles.close} onClick={close} aria-label="Close search"><X size={18}/></button>
        </header>
        {mode === 'search' && <>
          <button className={styles.askCard} onClick={() => openAI(query.trim() || undefined)}>
            <ThemedImage sources={avatar} alt=""/><span>Ask AI</span><strong>{query}</strong><small>Start conversation</small>
          </button>
          <div className={`${styles.searchContent} ${query.trim() ? styles.hasQuery : ''}`}>
            {searchError && <p role="alert" className={styles.error}>{searchError} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
            {query.trim() && <>
              <div className={styles.filters} role="group" aria-label="Content type">
                {Object.entries({all: 'All', docs: 'Docs', blog: 'Blog', release: 'Releases'}).map(([type, label]) =>
                  <button key={type} type="button" aria-pressed={contentType === type} onClick={() => setContentType(type)}>{label}</button>)}
                <small role="status">{loading ? 'Searching...' : results[0]?.matchType === 'typo' ? 'Closest matches' : `${results.length} results`}</small>
              </div>
              <div className={styles.results} id="docs-search-results" role="listbox" aria-label="Matching documentation" aria-busy={loading}>{loading
                ? Array.from({length: 5}, (_, i) => <div key={i} className={`${styles.result} ${styles.skeleton}`} aria-hidden="true">
                  <span className={styles.skeletonMeta}/>
                  <span className={styles.skeletonTitle} style={{width: `${[58, 72, 48, 64, 54][i]}%`}}/>
                  <span className={styles.skeletonSnippet}/>
                </div>)
                : results.slice(0, visibleCount).map((result, i) => <a key={result.id} id={`docs-result-${i}`} data-result={i} role="option" aria-selected={selected === i}
                className={`${styles.result} ${selected === i ? styles.selected : ''}`} href={result.url} onMouseEnter={() => setSelected(i)}
                onClick={event => analytics.current.select(i, event.detail === 0 ? 'keyboard' : 'mouse')}
                onAuxClick={event => {if (event.button === 1) analytics.current.select(i, 'middle_click');}}>
                <span className={styles.path}><SourceMeta source={result}/></span>
                <span className={styles.resultTitle}><SourceIcon source={result}/><span><Highlighted text={result.title} terms={result.highlights}/></span></span>
                <span className={styles.snippet}><Highlighted text={result.snippet} terms={result.highlights}/></span>
                {selected === i && <CornerDownLeft className={styles.enterIcon} size={16}/>}
              </a>)}</div>
              {!loading && visibleCount < results.length && <button type="button" className={styles.more} onClick={() => setVisibleCount(count => count + 25)}>Show 25 more</button>}
              {!loading && !searchError && !results.length && <p className={styles.noResults}>No {contentType === 'all' ? 'results' : contentType === 'release' ? 'release notes' : contentType === 'blog' ? 'blog posts' : 'docs'} found for “{query}”. {contentType !== 'all' ? <button onClick={() => setContentType('all')}>Search all content</button> : 'Try fewer words or a feature name.'}</p>}
            </>}
          </div>
        </>}
        {mode === 'ai' && <>
          <div className={styles.chatContent}>
            <div className={styles.assistantRow}>{assistantAvatar}<div className={styles.welcome}>
              <p>{welcome}</p>
              {!turns.length && !asking && !aiError && <><h3>COMMON QUESTIONS</h3><div className={styles.commonQuestions}>{commonQuestions.map(question => <button key={question} onClick={() => ask(question)}>{question}</button>)}</div></>}
            </div></div>
            {turns.map((turn, i) => <article className={styles.turn} key={i} ref={i === turns.length - 1 && !asking ? latestTurn : undefined}>
              <div className={styles.userRow}><span className={styles.userAvatar}><User size={19}/></span><p>{turn.question}</p></div>
              <div className={styles.assistantRow}>{assistantAvatar}<div className={styles.answer}><Answer {...turn}/>
                {turn.sources.length > 0 && <div className={styles.sources}><p>Sources</p>{turn.sources.map(source => <a key={source.id} href={source.url}><small><SourceMeta source={source}/></small><span><SourceIcon source={source} size={15}/>{source.title}{source.heading && ` · ${source.heading}`}</span></a>)}</div>}
              </div></div>
            </article>)}
            {asking && <article className={styles.turn} ref={latestTurn}><div className={styles.userRow}><span className={styles.userAvatar}><User size={19}/></span><p>{pendingQuestion}</p></div>
              <div className={styles.assistantRow}>{assistantAvatar}{streamedAnswer
                ? <div className={styles.answer} aria-busy="true"><Answer answer={streamedAnswer} sources={streamedSources}/><span role="status" className={styles.thinking}>Writing answer…</span></div>
                : <p role="status" className={styles.thinking}>{progress}</p>}</div></article>}
            {aiError && <div role="alert" className={styles.error}>{aiError}<button onClick={() => ask(failedQuestion)}>Retry question</button></div>}
          </div>
          <form className={styles.composer} onSubmit={event => {event.preventDefault(); ask();}}>
            <textarea ref={composer} aria-label="Ask anything about LiteLLM..." placeholder="Ask anything about LiteLLM..." value={draft} maxLength={500} rows={1} disabled={asking}
              onChange={event => setDraft(event.target.value)} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); ask();}}}/>
            {asking ? <button type="button" onClick={event => {event.preventDefault(); stopAnswer();}} aria-label="Stop answer"><Square size={16} fill="currentColor"/></button> : <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={18}/></button>}
          </form>
          <footer className={styles.footer}><span>AI can make mistakes. Check the sources.</span>{turns.length > 0 && <div><button onClick={copyConversation}><Copy size={12}/>{copied ? 'Copied' : 'Copy'}</button><button onClick={newChat}>Clear</button></div>}</footer>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
