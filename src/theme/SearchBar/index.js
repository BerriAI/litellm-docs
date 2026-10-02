import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// One owner renders the modal even when the navbar and docs sidebar both mount a trigger.
const openEvent = 'litellm:open-docs-search';
let owner = null;
const examples = [
  {query: 'Lens', detail: 'Investigate agent traces'},
  {query: 'Virtual keys', detail: 'Manage access to your gateway'},
  {query: 'Caching', detail: 'Reuse responses and reduce costs'},
  {query: 'Fallbacks', detail: 'Recover from provider failures'},
];
const categories = ['All docs', 'Gateway', 'SDK', 'Providers', 'Integrations'];
function Highlighted({text, terms = []}) {
  const escaped = [...new Set(terms)].filter(term => term.length > 1).sort((a,b) => b.length-a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  return text.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
}

function Answer({answer, sources}) {
  const byId = new Map(sources.map(source => [String(source.id), source]));
  const allowed = new Set(sources.map(source => source.url));
  const markdown = answer.replace(/\[(\d+)\]/g, (text, id) => byId.has(id) ? `[${id}](${byId.get(id).url})` : text);
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({href, children}) => allowed.has(href) ? <a className={styles.citation} href={href} aria-label={`Source ${children}`}>{children}</a> : <span>{children}</span>,
    img: () => null,
  }}>{markdown}</ReactMarkdown>;
}

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [aiError, setAiError] = useState('');
  const [category, setCategory] = useState('All docs');
  const error = mode === 'search' ? searchError : aiError;
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef(null), composer = useRef(null), dialog = useRef(null), worker = useRef(null), latestTurn = useRef(null);
  const requestId = useRef(0), controller = useRef(null), previousFocus = useRef(null);
  const identity = useRef({});
  const indexUrl = useBaseUrl('/search-index.json');
  const askUrl = useBaseUrl('/api/docs/ask');

  useEffect(() => {
    const show = () => {
      if (owner) return;
      owner = identity.current;
      previousFocus.current = document.activeElement;
      setOpen(true);
    };
    const key = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); show();
      }
    };
    window.addEventListener(openEvent, show);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener(openEvent, show);
      window.removeEventListener('keydown', key);
      worker.current?.terminate(); controller.current?.abort();
      if (owner === identity.current) owner = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (mode === 'search' ? input.current : composer.current)?.focus();
    return () => {document.body.style.overflow = overflow; previousFocus.current?.focus();};
  }, [open]);

  useEffect(() => {
    if (open) (mode === 'search' ? input.current : composer.current)?.focus();
  }, [mode]);
  useEffect(() => {
    if (open && mode === 'ai') latestTurn.current?.scrollIntoView({block: 'start'});
  }, [pendingQuestion, turns.length, open, mode]);

  useEffect(() => {
    if (!open || mode !== 'search') return;
    const id = ++requestId.current;
    setSelected(0); setSearchError('');
    setLoading(true); setResults([]);
    const timeout = setTimeout(() => {
      if (!worker.current) {
        worker.current = new Worker(new URL('./search.worker.js', import.meta.url));
        worker.current.onmessage = ({data}) => {
          if (data.id !== requestId.current) return;
          setLoading(false); setSearchError(data.error || ''); setResults(data.results || []);
        };
        worker.current.onerror = () => {
          setLoading(false); setSearchError('Search could not load. Please try again.');
          worker.current?.terminate(); worker.current = null;
        };
      }
      worker.current.postMessage({id, query, indexUrl, category});
    }, 80);
    return () => clearTimeout(timeout);
  }, [query, open, indexUrl, retry, mode, category]);

  function stopAnswer() {
    controller.current?.abort(); setAsking(false);
    if (pendingQuestion) setDraft(pendingQuestion);
    setPendingQuestion('');
  }
  function close() {
    stopAnswer(); requestId.current += 1; setOpen(false);
    if (owner === identity.current) owner = null;
  }
  function changeQuery(value) {setQuery(value);}
  function openAI(question) {
    setMode('ai');
    if (typeof question === 'string') ask(question);
    else if (!turns.length && !draft) setDraft(query);
  }
  function newChat() {
    controller.current?.abort(); setAsking(false); setPendingQuestion('');
    setTurns([]); setDraft(''); setAiError(''); setFailedQuestion(''); composer.current?.focus();
  }
  async function ask(question = draft) {
    if (!question.trim() || asking) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    setAsking(true); setPendingQuestion(question); setDraft(''); setAiError(''); setFailedQuestion('');
    const history = turns.slice(-4).map(turn => ({question: turn.question, answer: turn.answer.slice(0, 3000)}));
    try {
      const response = await fetch(askUrl, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question, history}), signal: pending.signal});
      const data = await response.json().catch(() => ({error: 'Ask AI is unavailable on this preview. Document search is still available.'}));
      if (!response.ok) throw new Error(data.error || 'Ask AI is unavailable.');
      if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('Ask AI is temporarily unavailable.');
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
    if (mode === 'search' && event.target === input.current && results.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
      }
      if (event.key === 'Enter') {event.preventDefault(); window.location.assign(results[selected].url);}
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

  return <>
    <button className={styles.trigger} onClick={() => window.dispatchEvent(new Event(openEvent))} aria-label="Search docs or ask AI">
      <span>Search docs</span><kbd>⌘ K</kbd>
    </button>
    {open && createPortal(<div className={`${styles.backdrop} ${mode === 'ai' ? styles.chatBackdrop : ''}`} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={`${styles.dialog} ${mode === 'ai' ? styles.chatDialog : ''} ${mode === 'ai' && (turns.length || asking || aiError) ? styles.chatActive : ''}`} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        {mode === 'search' ? <form className={styles.query} onSubmit={event => event.preventDefault()}>

          <input ref={input} value={query} maxLength={500} onChange={event => changeQuery(event.target.value)}
            placeholder={mode === 'search' ? 'Search documentation…' : 'Ask a question about LiteLLM…'}
            aria-label={mode === 'search' ? 'Search documentation' : 'Ask a question about LiteLLM'}
            aria-controls={mode === 'search' ? 'docs-search-results' : undefined}
            aria-activedescendant={mode === 'search' && results.length ? `docs-result-${selected}` : undefined}
            role={mode === 'search' ? 'combobox' : undefined} aria-expanded={mode === 'search' ? !!results.length : undefined} aria-autocomplete={mode === 'search' ? 'list' : undefined}/>
          {query && <button type="button" className={styles.clear} onClick={() => {changeQuery(''); input.current?.focus();}} aria-label="Clear search">Clear</button>}
          <button type="button" className={styles.close} onClick={close} aria-label="Close search">esc</button>
        </form> : null}
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="group" aria-label="Search mode">
            <button aria-pressed={mode === 'search'} onClick={() => {setMode('search'); input.current?.focus();}}>Search</button>
            <button aria-pressed={mode === 'ai'} onClick={() => openAI()}>Ask AI</button>
          </div>
          {mode === 'search' && <select aria-label="Filter documentation" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select>}
          {mode === 'ai' && <div className={styles.chatActions}>
            {(turns.length > 0 || asking) && <button className={styles.newChat} onClick={newChat}>New chat</button>}
            <button className={styles.close} onClick={close} aria-label="Close search">Close</button>
          </div>}
        </div>
        <div className={`${styles.content} ${mode === 'ai' ? styles.chatContent : ''}`}>
          {mode === 'search' && error && <p role="alert" className={styles.error}>{error} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
          {mode === 'search' && !query.trim() && <div className={styles.empty}>
            <p className={styles.eyebrow}>{mode === 'search' ? 'Suggested' : 'What can we help with?'}</p>
            {examples.map(({query: example, detail}) => <button className={styles.suggestion} key={example} onClick={() => {changeQuery(mode === 'ai' ? `How do I set up ${example}?` : example); input.current?.focus();}}>
              <span><strong>{mode === 'search' ? example : `How do I set up ${example}?`}</strong><small>{detail}</small></span>
            </button>)}
          </div>}
          {mode === 'search' && query.trim() && <>
            <p className={styles.eyebrow} role="status">{loading ? 'Searching…' : results[0]?.matchType === 'typo' ? 'Closest matches' : results.length ? 'Top matches' : 'No matches'}</p>
            <div id="docs-search-results" role="listbox" aria-label="Matching documentation">{results.map((result, i) => <a key={result.id} id={`docs-result-${i}`} data-result={i} role="option" aria-selected={selected === i}
              className={`${styles.result} ${selected === i ? styles.selected : ''}`} href={result.url} onMouseEnter={() => setSelected(i)}>

              <span className={styles.resultBody}>
                <strong><Highlighted text={result.title} terms={result.highlights}/></strong>
                <span className={styles.path}>{result.category}{result.heading && <> <span>›</span> <Highlighted text={result.heading} terms={result.highlights}/></>}</span>
                <span className={styles.snippet}><Highlighted text={result.snippet} terms={result.highlights}/></span>
              </span>

            </a>)}</div>
            {!loading && !error && !results.length && <div className={styles.noResults}><p>No documentation found for “{query}”.</p><span>Try fewer words or a feature name.</span>{category !== 'All docs' && <button onClick={() => setCategory('All docs')}>Search all docs</button>}<button onClick={() => openAI(query)}>Ask AI about this <span>→</span></button></div>}
          </>}
          {mode === 'ai' && <>
            {turns.map((turn, i) => <article className={styles.turn} key={i} ref={i === turns.length - 1 && !asking ? latestTurn : undefined}>
              <div className={styles.userQuestion}>{turn.question}</div>
              <div className={styles.answer}><div className={styles.answerLabel}>LiteLLM</div><Answer {...turn}/>
                {turn.sources.length > 0 && <details className={styles.sourceDetails}><summary>{turn.sources.length} {turn.sources.length === 1 ? 'source' : 'sources'}</summary><div className={styles.sources}>{turn.sources.map(source => <a key={source.id} href={source.url}><span>{source.id}</span><span>{source.title}{source.heading && <small>{source.heading}</small>}</span></a>)}</div></details>}
              </div>
            </article>)}
            {asking && <article className={styles.turn} ref={latestTurn}><div className={styles.userQuestion}>{pendingQuestion}</div><div role="status" className={styles.thinking}><div><strong>Searching the documentation</strong><span>{turns.length ? 'Using the context from your conversation…' : 'Finding the relevant guides…'}</span></div></div></article>}
            {aiError && <div role="alert" className={styles.error}>{aiError}<button onClick={() => ask(failedQuestion)}>Retry question</button></div>}
          </>}
        </div>
        {mode === 'ai' && <form className={styles.composer} onSubmit={event => {event.preventDefault(); ask();}}>
          <div className={styles.composerField}><textarea ref={composer} aria-label="Ask a question about LiteLLM" placeholder={turns.length ? 'Ask a follow-up…' : 'Ask a question…'} value={draft} maxLength={500} rows={2} disabled={asking}
            onChange={event => setDraft(event.target.value)} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); ask();}}}/>
            {asking ? <button type="button" className={styles.stop} onClick={stopAnswer} aria-label="Stop answer">Stop</button> : <button className={styles.send} type="submit" disabled={!draft.trim()} aria-label="Send question">Send</button>}
          </div><p>AI can make mistakes. Check the sources. <span>Enter to send · Shift + Enter for a new line</span></p>
        </form>}
        <footer className={styles.footer}><span>{mode === 'search' ? <><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open</> : 'History clears on refresh · Uses our AI gateway'}</span><span>LiteLLM Docs</span></footer>
      </section>
    </div>, document.body)}
  </>;
}
