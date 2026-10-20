import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ThemedImage from '@theme/ThemedImage';
import {Search, BookOpen, FileText, History, CornerDownLeft, X} from 'lucide-react';
import styles from './styles.module.css';
import {sourceLabel, sourceDetail} from '../../../search/content';
import {KeywordSearchSession} from '../../../search/keyword-client.mjs';
import {SearchAnalytics} from '../../../search/search-analytics.mjs';
import {track} from '../../components/Conversion/shared';
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
  const [resultSearchId, setResultSearchId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0);
  const input = useRef(null), dialog = useRef(null), previousFocus = useRef(null);
  const askRef = useRef(askAI);
  askRef.current = askAI;
  const searchSession = useRef(null);
  const analytics = useRef(null);
  if (!analytics.current) analytics.current = new SearchAnalytics({capture: (event, props) => track(event, {
    ...props, surface: 'dialog', environment: window.location.hostname === 'docs.litellm.ai' ? 'production'
      : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) ? 'local' : 'preview',
  })});
  const identity = useRef({});
  const searchUrl = useBaseUrl('/api/docs/search');
  const avatar = {
    light: useBaseUrl('/img/brand/litellm-monogram-blue.svg'),
    dark: useBaseUrl('/img/brand/litellm-monogram-white.svg'),
  };

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const show = (event, source = 'button') => {
      // Ask AI lives in the docked panel; every mounted trigger sees the event, so handle it once.
      if (event?.detail?.mode === 'ai') {
        if (!event.askAIHandled) {event.askAIHandled = true; askRef.current.openPanel(event.detail.question);}
        return;
      }
      if (owner) return;
      owner = identity.current;
      previousFocus.current = document.activeElement;
      analytics.current.open('search', event?.detail?.source || source);
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
      searchSession.current?.cancel();
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
    searchSession.current = new KeywordSearchSession({
      onResults(data) {
        setResultSearchId(analytics.current.ready(data, 'lexical'));
        setLoading(false); setSearchError(''); setResults(data.results);
        setResolvedQuery(data.query); setResolvedType(data.type); setSelected(0);
      },
      onRequest() {analytics.current.requested();},
      onError(message, metrics) {analytics.current.failed(metrics); setLoading(false); setSearchError(message);},
    }, {searchUrl});
    return () => searchSession.current.cancel();
  }, [searchUrl]);

  useEffect(() => {
    if (!open) return;
    setSearchError(''); setVisibleCount(25);
    setResults([]); setResolvedQuery(''); setResultSearchId(null); setSelected(0);
    setLoading(Boolean(query.trim()));
    analytics.current.start(query, contentType);
    searchSession.current.search(query, contentType);
    if (!query.trim()) {
      setResolvedType(contentType);
    }
    return () => searchSession.current.cancel();
  }, [query, contentType, open, searchUrl, retry]);

  useEffect(() => {
    if (!open || loading || !resultSearchId) return;
    const frame = requestAnimationFrame(() => analytics.current.shown(resultSearchId, visibleCount));
    return () => cancelAnimationFrame(frame);
  }, [open, loading, resultSearchId, visibleCount]);

  function close(reason) {
    analytics.current.close(reason);
    searchSession.current?.cancel(); setOpen(false);
    if (owner === identity.current) owner = null;
  }
  function changeQuery(value) {setQuery(value);}
  // Closes the modal and continues in the docked panel, sending the typed query as the first question.
  function openAI(question) {
    analytics.current.emit('mode_changed', {...analytics.current.props(), mode: 'ai'});
    previousFocus.current = null;
    close('ask_ai');
    askAI.openPanel(question);
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') {event.preventDefault(); close();}
    if (event.target === input.current) {
      if (!loading && results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const count = Math.min(visibleCount, results.length);
        setSelected(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (loading || searchError || resolvedQuery !== query.trim().replace(/\s+/g, ' ').toLowerCase() || resolvedType !== contentType) return;
        if (results.length) {analytics.current.select(selected, 'keyboard'); window.location.assign(results[selected].url);}
        else openAI(query.trim() || undefined);
      }
    }
    if (event.key === 'Tab') {
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled),input,select,summary,a[href]')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
  }
  useEffect(() => {
    if (open) dialog.current?.querySelector(`[data-result="${selected}"]`)?.scrollIntoView({block: 'nearest'});
  }, [selected, open]);

  return <>
    <button className={styles.trigger} onClick={() => window.dispatchEvent(new Event(openEvent))} aria-label="Search for anything..." title={`Search (${shortcut})`} aria-keyshortcuts="Meta+k Control+k">
      <Search size={18}/><span>Search for anything...</span><kbd>{shortcut}</kbd>
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => {if (event.target === event.currentTarget) close();}}>
      <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search LiteLLM documentation" onKeyDown={onKeyDown}>
        <header className={styles.header}>
          <Search className={styles.searchIcon} size={20}/>
          <input ref={input} value={query} onChange={event => changeQuery(event.target.value)}
              placeholder="Search for anything..." aria-label="Search documentation" aria-controls="docs-search-results"
              aria-activedescendant={!loading && results.length ? `docs-result-${selected}` : undefined}
              role="combobox" aria-expanded={!!query.trim()} aria-autocomplete="list"/>
          <button type="button" className={styles.close} onClick={() => close()} aria-label="Close search"><X size={18}/></button>
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
                <small role="status">{loading ? 'Searching...' : results[0]?.matchType === 'typo' ? 'Closest matches' : `${results.length} results`}</small>
              </div>
              <div className={styles.results} id="docs-search-results" role="listbox" aria-label="Matching documentation" aria-busy={loading} data-query={resolvedQuery}>{loading
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
      </section>
    </div>, document.body)}
  </>;
}
