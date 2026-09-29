import React, {useId, useState} from 'react';
import clsx from 'clsx';
import {PROMPTS} from './content';
import {IconAgent, IconCheck, IconCopy} from './icons';
import {track, useCopy} from './shared';
import styles from './styles.module.css';

// A copyable prompt for Claude Code, Codex, Cursor, or any coding agent.
// Collapsed it shows the first lines with a fade; the copy button always
// copies the whole prompt.
export default function AgentPrompt({id, title, text, defaultOpen = false, compact = false}) {
  const prompt = PROMPTS[id] || {};
  const body = text || prompt.text || '';
  const heading = title || prompt.title || 'Agent prompt';
  const [open, setOpen] = useState(defaultOpen);
  const [copied, copy] = useCopy();
  const bodyId = useId();

  return (
    <div className={clsx(styles.prompt, compact && styles.promptCompact)}>
      <div className={styles.promptHead}>
        <span className={styles.promptIcon}>
          <IconAgent size={18} />
        </span>
        <span className={styles.promptTitle}>
          <span className={styles.promptBadge}>Agent prompt</span>
          {heading}
          <span className={styles.promptSub}>Paste into Claude Code, Codex, Cursor, or any coding agent</span>
        </span>
        <button
          type="button"
          className={clsx(styles.btnGhost, copied && styles.btnDone)}
          onClick={() => {
            copy(body);
            track('docs_agent_prompt_copied', {prompt: id || heading});
          }}
          aria-label={copied ? 'Prompt copied' : `Copy prompt: ${heading}`}>
          {copied ? <IconCheck /> : <IconCopy />}
          <span>{copied ? 'Copied' : 'Copy prompt'}</span>
        </button>
      </div>
      <div id={bodyId} className={clsx(styles.promptBody, open && styles.promptBodyOpen)}>
        <pre className={styles.promptText}>{body}</pre>
        {!open && (
          <button type="button" className={styles.showMore} onClick={() => setOpen(true)} aria-controls={bodyId}>
            Show full prompt
          </button>
        )}
      </div>
    </div>
  );
}
