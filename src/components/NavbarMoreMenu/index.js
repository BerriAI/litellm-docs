import React, {useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useColorMode} from '@docusaurus/theme-common';
import {ExternalLink, Monitor, MoreHorizontal, Moon, ShieldCheck, Sun} from 'lucide-react';
import styles from './styles.module.css';

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
