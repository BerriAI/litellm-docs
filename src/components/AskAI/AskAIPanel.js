import React, {useEffect, useRef} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {SquarePen, Copy, Check, Send, Square} from 'lucide-react';
import {useAskAI, commonQuestions} from './AskAIContext';
import {useSalesForm} from '@site/src/components/SalesForm';
import {mapCitations} from '../../../search/citations.mjs';
import {sourceLabel, sourceDetail} from '../../../search/content';
import DockedPanel from './DockedPanel';
import styles from './styles.module.css';

function Answer({answer, sources}) {
  const byId = new Map(sources.map(source => [source.id, source]));
  const allowed = new Set(sources.map(source => source.url));
  const markdown = mapCitations(answer, (id, text) => byId.has(id) ? `[${id}](${byId.get(id).url})` : text);
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({href, children}) => allowed.has(href) ? <a className={styles.citation} href={href} aria-label={`Source ${children}`}>{children}</a> : <span>{children}</span>,
    img: () => null,
  }}>{markdown}</ReactMarkdown>;
}

function Sources({sources}) {
  if (!sources.length) return null;
  return <div className={styles.sources} aria-label="Sources">
    {sources.map(source => {
      const detail = sourceDetail(source);
      const title = source.heading ? `${source.title} · ${source.heading}` : source.title;
      return <a key={source.id} href={source.url} title={`${sourceLabel(source)}${detail ? ` · ${detail}` : ''}: ${title}`}>
        <b>{source.id}</b><span>{source.title}{source.heading && <i> · {source.heading}</i>}</span>
      </a>;
    })}
  </div>;
}

export default function AskAIPanel() {
  const {open, closePanel, ask, stop, newChat, retry, copyConversation, turns, asking, pendingQuestion, streamedAnswer,
    streamedSources, progress, error, draft, setDraft, copied, focusRequest} = useAskAI();
  const salesForm = useSalesForm();
  const composer = useRef(null), body = useRef(null), latestTurn = useRef(null), handledFocus = useRef(0), wasAsking = useRef(false);

  useEffect(() => {
    if (open && focusRequest !== handledFocus.current) {
      handledFocus.current = focusRequest;
      composer.current?.focus();
    }
  }, [open, focusRequest]);

  // After an answer finishes, give the input focus back unless the reader moved on to the page.
  useEffect(() => {
    if (wasAsking.current && !asking && open) {
      const active = document.activeElement;
      if (!active || active === document.body || body.current?.parentElement?.contains(active)) composer.current?.focus();
    }
    wasAsking.current = asking;
  }, [asking, open]);

  useEffect(() => {
    // Scroll the log itself; scrollIntoView could also move the page behind the panel.
    if (open && latestTurn.current && body.current) body.current.scrollTop = latestTurn.current.offsetTop;
  }, [open, turns.length, pendingQuestion]);

  if (!open) return null;

  function submit() {
    if (draft.trim() && !asking) ask(draft);
  }

  const empty = !turns.length && !asking && !error;
  return <DockedPanel open onClose={closePanel} actions={<>
    {turns.length > 0 && <button type="button" className={styles.iconButton} onClick={copyConversation} aria-label={copied ? 'Conversation copied' : 'Copy conversation'} title="Copy conversation">
      {copied ? <Check size={16}/> : <Copy size={16}/>}
    </button>}
    <button type="button" className={styles.iconButton} onClick={newChat} aria-label="New chat" title="New chat"><SquarePen size={16}/></button>
  </>}>
    <div className={styles.body} ref={body} role="log" aria-label="Conversation">
      <div className={styles.intro}>
        <p>Ask about proxy setup, model routing, caching, spend tracking, and more. Answers cite the docs.</p>
        {empty && <>
          <h3>Common questions</h3>
          <div className={styles.commonQuestions}>{commonQuestions.map(question => <button key={question} type="button" onClick={() => ask(question)}>{question}</button>)}</div>
        </>}
      </div>
      {turns.map((turn, i) => <article className={styles.turn} key={i} ref={i === turns.length - 1 && !asking ? latestTurn : undefined}>
        <p className={styles.user}>{turn.question}</p>
        <div className={styles.answer}><Answer {...turn}/></div>
        <Sources sources={turn.sources}/>
      </article>)}
      {asking && <article className={styles.turn} ref={latestTurn}>
        <p className={styles.user}>{pendingQuestion}</p>
        {streamedAnswer
          ? <div className={styles.answer} aria-busy="true"><Answer answer={streamedAnswer} sources={streamedSources}/><span role="status" className={styles.thinking}>Writing answer…</span></div>
          : <p role="status" className={styles.thinking}>{progress}</p>}
      </article>}
      {error && <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={retry}>Retry question</button></div>}
    </div>
    <footer className={styles.footer}>
      <p className={styles.human}>Need a person? <button type="button" onClick={() => salesForm.open({source: 'ask-ai-panel'})}>Talk to sales</button>
        {' '}or ask the community on <a href="https://litellmossslack.slack.com/" target="_blank" rel="noopener noreferrer">Slack</a>
        {' '}or <a href="https://discord.com/invite/wuPM9dRgDw" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
      <form className={styles.composer} onSubmit={event => {event.preventDefault(); submit();}}>
        <textarea ref={composer} aria-label="Ask anything about LiteLLM" placeholder={turns.length ? 'Ask a follow-up…' : 'Ask anything about LiteLLM…'} value={draft} rows={1} disabled={asking}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); submit();}}}/>
        {asking
          ? <button type="button" onClick={stop} aria-label="Stop answer"><Square size={15} fill="currentColor"/></button>
          : <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={17}/></button>}
      </form>
      <p className={styles.note}>AI can make mistakes. Check the sources.</p>
    </footer>
  </DockedPanel>;
}
