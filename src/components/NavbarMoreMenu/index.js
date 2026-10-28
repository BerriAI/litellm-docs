import React, {useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useColorMode} from '@docusaurus/theme-common';
import {ExternalLink, Monitor, MoreHorizontal, Moon, ShieldCheck, Sun} from 'lucide-react';
import styles from './styles.module.css';

// The Discord mark, same path as the old navbar icon link; it takes the text
// colour so it reads on both themes.
function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// null is the system choice; Docusaurus resolves it from prefers-color-scheme.
const THEMES = [
  {value: 'light', label: 'Light', Icon: Sun},
  {value: 'dark', label: 'Dark', Icon: Moon},
  {value: null, label: 'System', Icon: Monitor},
];

export default function NavbarMoreMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const slackSrc = useBaseUrl('/img/integrations/slack.svg');
  const {colorModeChoice, setColorMode} = useColorMode();

  const close = (returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const items = () => Array.from(panelRef.current?.querySelectorAll('[role^="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return undefined;
    // Keyboard users land on the first item; a mouse click leaves focus on the button
    if (rootRef.current?.matches(':focus-within')) items()[0]?.focus();
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const list = items();
    const at = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(at + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(at - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`${styles.root} navbar__more-menu`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        title="More"
        onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div ref={panelRef} className={styles.panel} role="menu" aria-label="More">
          <a
            className={styles.item}
            role="menuitem"
            href="https://discord.com/invite/wuPM9dRgDw"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(false)}>
            <span className={styles.marks}>
              <DiscordMark />
            </span>
            <span className={styles.label}>Discord</span>
            <ExternalLink className={styles.external} size={14} aria-hidden="true" />
          </a>
          <a
            className={styles.item}
            role="menuitem"
            href="https://litellmossslack.slack.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(false)}>
            <span className={styles.marks}>
              <img src={slackSrc} width="16" height="16" alt="" />
            </span>
            <span className={styles.label}>Slack</span>
            <ExternalLink className={styles.external} size={14} aria-hidden="true" />
          </a>
          <a
            className={styles.item}
            role="menuitem"
            href="https://trust.litellm.ai/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(false)}>
            <span className={styles.marks}>
              <ShieldCheck size={16} aria-hidden="true" />
            </span>
            <span className={styles.label}>Trust Center</span>
            <ExternalLink className={styles.external} size={14} aria-hidden="true" />
          </a>
          <div className={styles.divider} role="separator" />
          <div className={styles.themeRow}>
            <span className={styles.themeLabel} id="navbar-more-theme">Theme</span>
            <div className={styles.themeGroup} role="group" aria-labelledby="navbar-more-theme">
              {THEMES.map(({value, label, Icon}) => (
                <button
                  key={label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={colorModeChoice === value}
                  aria-label={label}
                  title={label}
                  className={`${styles.themeButton} ${colorModeChoice === value ? styles.themeActive : ''}`}
                  onClick={() => setColorMode(value)}>
                  <Icon size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
