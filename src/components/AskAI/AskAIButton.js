import React from 'react';
import {Sparkles} from 'lucide-react';
import {useAskAI} from './AskAIContext';
import styles from './button.module.css';

// Navbar toggle for the docked Ask AI panel. Below 1100px only the icon shows.
export default function AskAIButton({className}) {
  const {open, toggle} = useAskAI();
  return <button type="button" data-ask-ai-trigger className={[styles.button, open ? styles.active : '', className].filter(Boolean).join(' ')}
    onClick={toggle} aria-pressed={open} aria-label="Ask AI" title="Ask AI">
    <Sparkles size={16} aria-hidden="true"/><span className={styles.label}>Ask AI</span>
  </button>;
}
