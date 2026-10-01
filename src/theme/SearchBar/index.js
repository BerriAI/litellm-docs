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
function Icon({name = 'search', ...props}) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    document: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    enter: <path d="M20 5v8H4m5-5-5 5 5 5"/>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
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
  const [searchError, setSearchError] = useState('');
  const [aiError, setAiError] = useState('');
  const [category, setCategory] = useState('All docs');
  const error = mode === 'search' ? searchError : aiError;
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
    input.current?.focus();
    return () => {document.body.style.overflow = overflow; previousFocus.current?.focus();};
  }, [open]);

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

  function close() {
    controller.current?.abort(); requestId.current += 1; setAsking(false); setOpen(false);
    if (owner === identity.current) owner = null;
  }
  function changeQuery(value) {
    controller.current?.abort(); setAsking(false); setAnswer(null); setAiError(''); setQuery(value);
  }
  async function ask(event) {
    event?.preventDefault();
    if (!query.trim() || asking) return;
    const pending = new AbortController();
    controller.current?.abort(); controller.current = pending;
    setAsking(true); setAnswer(null); setAiError('');
    try {
      const response = await fetch(askUrl, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: query}), signal: pending.signal});
      const data = await response.json().catch(() => ({error: 'Ask AI is unavailable on this preview. Document search is still available.'}));
      if (!response.ok) throw new Error(data.error || 'Ask AI is unavailable.');
      if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('Ask AI is temporarily unavailable.');
      if (!pending.signal.aborted) setAnswer(data);
    } catch (error) {
      if (!pending.signal.aborted) setAiError(error.message === 'Failed to fetch' ? 'Ask AI could not connect. Please try again.' : error.message);
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
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled),input,select,a[href]')];
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
      <Icon/><span>Search docs</span><kbd>⌘ K</kbd>
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        <form className={styles.query} onSubmit={mode === 'ai' ? ask : event => event.preventDefault()}>
          <Icon name={mode === 'search' ? 'search' : 'spark'}/>
          <input ref={input} value={query} maxLength={500} onChange={event => changeQuery(event.target.value)}
            placeholder={mode === 'search' ? 'Search documentation…' : 'Ask a question about LiteLLM…'}
            aria-label={mode === 'search' ? 'Search documentation' : 'Ask a question about LiteLLM'}
            aria-controls={mode === 'search' ? 'docs-search-results' : undefined}
            aria-activedescendant={mode === 'search' && results.length ? `docs-result-${selected}` : undefined}
            role={mode === 'search' ? 'combobox' : undefined} aria-expanded={mode === 'search' ? !!results.length : undefined} aria-autocomplete={mode === 'search' ? 'list' : undefined}/>
          {query && <button type="button" className={styles.clear} onClick={() => {changeQuery(''); input.current?.focus();}} aria-label="Clear search"><Icon name="close"/></button>}
          <button type="button" className={styles.close} onClick={close} aria-label="Close search">esc</button>
        </form>
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="group" aria-label="Search mode">
            <button aria-pressed={mode === 'search'} onClick={() => {setMode('search'); input.current?.focus();}}><Icon/>Search</button>
            <button aria-pressed={mode === 'ai'} onClick={() => {setMode('ai'); input.current?.focus();}}><Icon name="spark"/>Ask AI</button>
          </div>
          {mode === 'search' && <select aria-label="Filter documentation" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select>}
          {mode === 'ai' && <span className={styles.private}>Answers with sources</span>}
        </div>
        <div className={styles.content}>
          {error && <p role="alert" className={styles.error}>{error} <button onClick={() => {if (mode === 'ai') ask(); else setRetry(value => value + 1);}}>Try again</button></p>}
          {!query.trim() && <div className={styles.empty}>
            <p className={styles.eyebrow}>{mode === 'search' ? 'Suggested' : 'What can we help with?'}</p>
            {examples.map(({query: example, detail}) => <button className={styles.suggestion} key={example} onClick={() => {changeQuery(mode === 'ai' ? `How do I set up ${example}?` : example); input.current?.focus();}}>
              <span className={styles.docIcon}><Icon name={mode === 'search' ? 'document' : 'spark'}/></span><span><strong>{mode === 'search' ? example : `How do I set up ${example}?`}</strong><small>{detail}</small></span><span className={styles.suggestArrow}>↗</span>
            </button>)}
          </div>}
          {mode === 'search' && query.trim() && <>
            <p className={styles.eyebrow} role="status">{loading ? 'Searching…' : results[0]?.matchType === 'typo' ? 'Closest matches' : results.length ? 'Top matches' : 'No matches'}</p>
            <div id="docs-search-results" role="listbox" aria-label="Matching documentation">{results.map((result, i) => <a key={result.id} id={`docs-result-${i}`} data-result={i} role="option" aria-selected={selected === i}
              className={`${styles.result} ${selected === i ? styles.selected : ''}`} href={result.url} onMouseEnter={() => setSelected(i)}>
              <span className={styles.docIcon}><Icon name="document"/></span>
              <span className={styles.resultBody}>
                <strong><Highlighted text={result.title} terms={result.highlights}/></strong>
                <span className={styles.path}>{result.category}{result.heading && <> <span>›</span> <Highlighted text={result.heading} terms={result.highlights}/></>}</span>
                <span className={styles.snippet}><Highlighted text={result.snippet} terms={result.highlights}/></span>
              </span>
              <span className={styles.openResult}><Icon name="enter"/></span>
            </a>)}</div>
            {!loading && !error && !results.length && <div className={styles.noResults}><p>No documentation found for “{query}”.</p><span>Try fewer words or a feature name.</span>{category !== 'All docs' && <button onClick={() => setCategory('All docs')}>Search all docs</button>}<button onClick={() => setMode('ai')}>Ask AI about this <span>→</span></button></div>}
          </>}
          {mode === 'ai' && <>
            {asking && <div role="status" className={styles.thinking}><Icon name="spark"/><div><strong>Reading the docs</strong><span>Finding the relevant guides for your question…</span></div></div>}
            {answer && <div className={styles.answer} aria-live="polite"><div className={styles.answerLabel}><Icon name="spark"/>LiteLLM answer</div><div><Answer {...answer}/></div>{answer.sources.length > 0 && <><h4>Read the source</h4><div className={styles.sources}>{answer.sources.map(source => <a key={source.id} href={source.url}><span>{source.id}</span><span>{source.title}{source.heading && <small>{source.heading}</small>}</span><span>↗</span></a>)}</div><p className={styles.caution}>AI can make mistakes. Check the linked documentation.</p></>}</div>}
            {query.trim() && !asking && !answer && <div className={styles.askPrompt}><Icon name="spark"/><h3>Get an answer from the docs</h3><p>We’ll find the relevant guides and include links to the sources.</p><button className={styles.ask} onClick={ask}>Ask AI <Icon name="enter"/></button></div>}
          </>}
        </div>
        <footer className={styles.footer}><span>{mode === 'search' ? <><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open</> : 'Uses public docs · Sent to our AI gateway'}</span><span>LiteLLM Docs</span></footer>
      </section>
    </div>, document.body)}
  </>;
}
