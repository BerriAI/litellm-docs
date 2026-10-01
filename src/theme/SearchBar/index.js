import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// One owner renders the modal even when the navbar and docs sidebar both mount a trigger.
const openEvent = 'litellm:open-docs-search';
let owner = null;
const examples = ['Lens', 'Virtual keys', 'Fallbacks', 'How do I enable caching?'];

function Answer({answer, sources}) {
  const byId = new Map(sources.map(source => [String(source.id), source]));
  const allowed = new Set(sources.map(source => source.url));
  const markdown = answer.replace(/\[(\d+)\]/g, (text, id) => byId.has(id) ? `[${id}](${byId.get(id).url})` : text);
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({href, children}) => allowed.has(href) ? <a href={href}>{children}</a> : <span>{children}</span>,
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
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef(null), dialog = useRef(null), worker = useRef(null);
  const requestId = useRef(0), controller = useRef(null), previousFocus = useRef(null);
  const identity = useRef({});
  const indexUrl = useBaseUrl('/search-index.json');
  const askUrl = useBaseUrl('/api/docs/ask');

  useEffect(() => {
    const show = () => {
      if (owner && owner !== identity.current) return;
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
    input.current?.focus();
    return () => {document.body.style.overflow = overflow; previousFocus.current?.focus();};
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setSelected(0); setError('');
    if (!query.trim()) {setResults([]); setLoading(false); return;}
    setLoading(true); setResults([]);
    const timeout = setTimeout(() => {
      if (!worker.current) {
        worker.current = new Worker(new URL('./search.worker.js', import.meta.url));
        worker.current.onmessage = ({data}) => {
          if (data.id !== requestId.current) return;
          setLoading(false); setError(data.error || ''); setResults(data.results || []);
        };
        worker.current.onerror = () => {
          setLoading(false); setError('Search could not load. Please try again.');
          worker.current?.terminate(); worker.current = null;
        };
      }
      worker.current.postMessage({id, query, indexUrl});
    }, 80);
    return () => clearTimeout(timeout);
  }, [query, open, indexUrl, retry]);

  function close() {
    controller.current?.abort(); setAsking(false); setOpen(false);
    if (owner === identity.current) owner = null;
  }
  function changeQuery(value) {
    controller.current?.abort(); setAsking(false); setAnswer(null); setQuery(value);
  }
  async function ask(event) {
    event?.preventDefault();
    if (!query.trim() || asking) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    setAsking(true); setAnswer(null); setError('');
    try {
      const response = await fetch(askUrl, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: query}), signal: pending.signal});
      const data = await response.json().catch(() => ({error: 'Ask AI is unavailable on this preview. Document search is still available.'}));
      if (!response.ok) throw new Error(data.error || 'Ask AI is unavailable.');
      if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('Ask AI is temporarily unavailable.');
      if (!pending.signal.aborted) setAnswer(data);
    } catch (error) {
      if (!pending.signal.aborted) setError(error.message === 'Failed to fetch' ? 'Ask AI could not connect. Please try again.' : error.message);
    } finally {if (!pending.signal.aborted) setAsking(false);}
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
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled),input,a[href]')];
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
      <span aria-hidden="true">⌕</span><span>Search docs</span><kbd>⌘ K</kbd>
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        <div className={styles.topline}><span className={styles.brand}>LiteLLM <span> / Docs</span></span><button className={styles.close} onClick={close} aria-label="Close search">Esc</button></div>
        <div className={styles.tabs} role="group" aria-label="Search mode">
          <button aria-pressed={mode === 'search'} onClick={() => {setMode('search'); input.current?.focus();}}>Search</button>
          <button aria-pressed={mode === 'ai'} onClick={() => {setMode('ai'); input.current?.focus();}}>Ask AI</button>
        </div>
        <form className={styles.query} onSubmit={mode === 'ai' ? ask : event => event.preventDefault()}>
          <span aria-hidden="true">⌕</span>
          <input ref={input} value={query} maxLength={500} onChange={event => changeQuery(event.target.value)}
            placeholder={mode === 'search' ? 'Search docs, features, configuration…' : 'What would you like to know about LiteLLM?'}
            aria-label={mode === 'search' ? 'Search documentation' : 'Ask a question about LiteLLM'}
            aria-controls={mode === 'search' ? 'docs-search-results' : undefined}
            aria-activedescendant={mode === 'search' && results.length ? `docs-result-${selected}` : undefined}
            role={mode === 'search' ? 'combobox' : undefined} aria-expanded={mode === 'search' ? !!results.length : undefined} aria-autocomplete={mode === 'search' ? 'list' : undefined}/>
          {mode === 'ai' && <button className={styles.ask} type="submit" disabled={asking || !query.trim()}>{asking ? 'Answering…' : 'Ask →'}</button>}
        </form>
        <div className={styles.content}>
          {error && <p role="alert" className={styles.error}>{error} <button onClick={() => {if (mode === 'ai') ask(); else setRetry(value => value + 1);}}>Retry</button></p>}
          {!query.trim() && <div className={styles.empty}><h3>{mode === 'search' ? 'Find your next step.' : 'Answers from the docs.'}</h3><p>{mode === 'search' ? 'Go straight to the right guide, endpoint, or configuration.' : 'Ask about setup, routing, or debugging. Answers include sources you can check.'}</p><div className={styles.examples}>{examples.map(example => <button key={example} onClick={() => changeQuery(example)}>{example} <span>↗</span></button>)}</div></div>}
          {mode === 'search' && query.trim() && <>
            <p className={styles.resultCount} role="status">{loading ? 'Searching documentation…' : `${results.length} matching ${results.length === 1 ? 'page' : 'pages'}`}</p>
            <div id="docs-search-results" role="listbox" aria-label="Matching documentation">{results.map((result, i) => <a key={result.id} id={`docs-result-${i}`} data-result={i} role="option" aria-selected={selected === i}
              className={`${styles.result} ${selected === i ? styles.selected : ''}`} href={result.url} onMouseEnter={() => setSelected(i)}>
              <span className={styles.path}>{result.url.split('#')[0].replace(/^\/docs\//, '').replaceAll('/', ' / ')}</span>
              <strong>{result.title} <span>↗</span></strong>
              {result.heading && <span className={styles.heading}>{result.heading}</span>}
              <p>{result.snippet}</p>
            </a>)}</div>
            {!loading && !error && !results.length && <p className={styles.hint}>No matching docs. Try a feature name or configuration option.</p>}
          </>}
          {mode === 'ai' && <>
            {asking && <p role="status" className={styles.hint}>Reading the documentation and preparing an answer…</p>}
            {answer && <div className={styles.answer} aria-live="polite"><div><Answer {...answer}/></div>{answer.sources.length > 0 && <><h4>Sources</h4><div className={styles.sources}>{answer.sources.map(source => <a key={source.id} href={source.url}>[{source.id}] {source.title}{source.heading ? ` / ${source.heading}` : ''} ↗</a>)}</div><p className={styles.caution}>AI answers can be wrong. Check the linked documentation.</p></>}</div>}
            {query.trim() && !asking && !answer && <p className={styles.hint}>Press Enter to ask. Your question and relevant public docs are sent to our AI gateway.</p>}
          </>}
        </div>
        <footer className={styles.footer}><span>{mode === 'search' ? '↑ ↓ navigate · Enter open' : 'Grounded in public LiteLLM docs'}</span><span>Built by LiteLLM</span></footer>
      </section>
    </div>, document.body)}
  </>;
}
