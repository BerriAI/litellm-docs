import React from 'react';
import clsx from 'clsx';
import {PROMPTS} from './content';
import {IconAgent, IconCheck} from './icons';
import {track, useCopy} from './shared';
import styles from './transit.module.css';

// A small "Copy agent prompt" button for diagrams and maps: one click puts the
// prompt for that product on the clipboard, ready for Claude Code, Codex, or
// Cursor. The full prompt text lives in content.js and in the page markdown.
export default function PromptButton({id, source, label = 'Copy agent prompt', size = 'sm', className}) {
  const prompt = PROMPTS[id];
  const [copied, copy] = useCopy();
  if (!prompt) return null;
  return (
    <button
      type="button"
      className={clsx(styles.promptBtn, size === 'md' && styles.promptBtnMd, copied && styles.promptBtnDone, className)}
      title={`${prompt.title}. Paste it into Claude Code, Codex, Cursor, or any coding agent.`}
      aria-label={copied ? 'Prompt copied' : `Copy agent prompt: ${prompt.title}`}
      onClick={() => {
        copy(prompt.text);
        track('docs_agent_prompt_copied', {prompt: id, source});
      }}>
      {copied ? <IconCheck size={size === 'md' ? 16 : 14} /> : <IconAgent size={size === 'md' ? 16 : 14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
