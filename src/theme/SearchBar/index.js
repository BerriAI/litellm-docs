import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ThemedImage from '@theme/ThemedImage';
import {Search, Sparkles, BookOpen, FileText, History, CornerDownLeft, X} from 'lucide-react';
import styles from './styles.module.css';
import {sourceLabel, sourceDetail} from '../../../search/content';
import {useAskAI} from '@site/src/components/AskAI/AskAIContext';

// One owner renders the modal even when the navbar and docs sidebar both mount a trigger.
const openEvent = 'litellm:open-docs-search';
let owner = null;
function Highlighted({text, terms = []}) {
  const escaped = [...new Set(terms)].filter(term => term.length > 1).sort((a,b) => b.length-a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  return text.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
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
  const [open, setOpen] = useState(false);
  const askAI = useAskAI();
  const [query, setQuery] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [contentType, setContentType] = useState('all');
  const [resolvedType, setResolvedType] = useState('all');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0);
  const input = useRef(null), dialog = useRef(null), worker = useRef(null);
  const requestId = useRef(0), previousFocus = useRef(null);
  const identity = useRef({});
  const askRef = useRef(askAI);
  askRef.current = askAI;
  const indexUrl = useBaseUrl('/search-index.json');
  const avatar = {
    light: useBaseUrl('/img/brand/litellm-monogram-blue.svg'),
    dark: useBaseUrl('/img/brand/litellm-monogram-white.svg'),
  };

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const show = event => {
      // Ask AI lives in the docked panel; every mounted trigger sees the event, so handle it once.
      if (event?.detail?.mode === 'ai') {
        if (!event.askAIHandled) {event.askAIHandled = true; askRef.current.openPanel(event.detail.question);}
        return;
      }
      if (owner) return;
      owner = identity.current;
      previousFocus.current = document.activeElement;
      setOpen(true);
    };
    const key = event => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.isComposing) {
        event.preventDefault(); show();
      }
    };
    window.addEventListener(openEvent, show);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener(openEvent, show);
      window.removeEventListener('keydown', key);
      worker.current?.terminate();
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
    input.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (page) page.inert = wasInert;
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setSearchError('');
    if (!query.trim()) {
      setLoading(false); setResults([]); setResolvedQuery(''); setSelected(0);
      return;
    }
    // Keep the previous matches visible while typing and ignore stale worker replies.
    setLoading(true);
    const timeout = setTimeout(() => {
      if (!worker.current) {
        worker.current = new Worker(new URL('./search.worker.js', import.meta.url));
        worker.current.onmessage = ({data}) => {
          if (data.id !== requestId.current) return;
          setLoading(false); setSearchError(data.error || ''); setResults(data.results || []);
          setResolvedQuery(data.query); setResolvedType(data.type); setSelected(0);
        };
        worker.current.onerror = () => {
          setLoading(false); setSearchError('Search could not load. Please try again.');
          worker.current?.terminate(); worker.current = null;
        };
      }
      worker.current.postMessage({id, query, indexUrl, type: contentType});
    }, 250);
    return () => {clearTimeout(timeout); requestId.current += 1;};
  }, [query, contentType, open, indexUrl, retry]);

  function close() {
    requestId.current += 1; setOpen(false);
    if (owner === identity.current) owner = null;
  }
  // Closes the modal and continues in the docked panel, sending the typed query as the first question.
  function openAI(question) {
    previousFocus.current = null;
    close();
    askAI.openPanel(question);
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') {event.preventDefault(); close();}
    if (event.target === input.current) {
      if (results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        setSelected(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (loading || resolvedQuery !== query || resolvedType !== contentType) return;
        if (results.length) window.location.assign(results[selected].url);
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
    if (open) dialog.current?.querySelector(`[data-result="${selected}"]`)?.scrollIntoView({block: 'nearest'});
  }, [selected, open]);

  const toggle = <div className={styles.tabs} role="group" aria-label="Search mode">
    <button type="button" aria-pressed="true"><Search size={12}/>Search</button>
    <button type="button" aria-pressed="false" onClick={() => openAI(query.trim() || undefined)}><Sparkles size={12}/>Ask AI</button>
  </div>;
  return <>
    <button className={styles.trigger} onClick={() => window.dispatchEvent(new Event(openEvent))} aria-label="Search for anything..." title={`Search (${shortcut})`} aria-keyshortcuts="Meta+k Control+k">
      <Search size={18}/><span>Search for anything...</span><kbd>{shortcut}</kbd>
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        <header className={styles.header}>
          <Search className={styles.searchIcon} size={20}/>
          <input ref={input} value={query} maxLength={500} onChange={event => setQuery(event.target.value)}
            placeholder="Search for anything..." aria-label="Search documentation" aria-controls="docs-search-results"
            aria-activedescendant={results.length ? `docs-result-${selected}` : undefined}
            role="combobox" aria-expanded={!!results.length} aria-autocomplete="list"/>
          {toggle}
          <button type="button" className={styles.close} onClick={close} aria-label="Close search"><X size={18}/></button>
        </header>
        <button className={styles.askCard} onClick={() => openAI(query.trim() || undefined)}>
          <ThemedImage sources={avatar} alt=""/><span>Ask AI</span><strong>{query}</strong><small>Start conversation</small>
        </button>
        <div className={`${styles.searchContent} ${query.trim() ? styles.hasQuery : ''}`}>
          {searchError && <p role="alert" className={styles.error}>{searchError} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
          {query.trim() && <>
            <div className={styles.filters} role="group" aria-label="Content type">
              {Object.entries({all: 'All', docs: 'Docs', blog: 'Blog', release: 'Releases'}).map(([type, label]) =>
                <button key={type} type="button" aria-pressed={contentType === type} onClick={() => setContentType(type)}>{label}</button>)}
              <small role="status">{loading && !results.length ? 'Searching...' : results[0]?.matchType === 'typo' ? 'Closest matches' : ''}</small>
            </div>
            <div className={styles.results} id="docs-search-results" role="listbox" aria-label="Matching documentation" aria-busy={loading}>{results.map((result, i) => <a key={result.id} id={`docs-result-${i}`} data-result={i} role="option" aria-selected={selected === i}
              className={`${styles.result} ${selected === i ? styles.selected : ''}`} href={result.url} onMouseEnter={() => setSelected(i)}>
              <span className={styles.path}><SourceMeta source={result}/></span>
              <span className={styles.resultTitle}><SourceIcon source={result}/><span><Highlighted text={result.title} terms={result.highlights}/></span></span>
              <span className={styles.snippet}><Highlighted text={result.snippet} terms={result.highlights}/></span>
              {selected === i && <CornerDownLeft className={styles.enterIcon} size={16}/>}
            </a>)}</div>
            {!loading && !searchError && !results.length && <p className={styles.noResults}>No {contentType === 'all' ? 'results' : contentType === 'release' ? 'release notes' : contentType === 'blog' ? 'blog posts' : 'docs'} found for “{query}”. {contentType !== 'all' ? <button onClick={() => setContentType('all')}>Search all content</button> : 'Try fewer words or a feature name.'}</p>}
          </>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
