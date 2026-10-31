import React, {useEffect, useState} from 'react';
import {Sparkles, X} from 'lucide-react';
import styles from './styles.module.css';
import './layout.css';

// Keeps the panel's top edge under the sticky navbar, including while an announcement bar
// still sits above it at the top of the page.
function useNavbarOffset(active) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom;
      if (bottom > 0) root.style.setProperty('--ask-ai-top', `${Math.round(bottom)}px`);
      else root.style.removeProperty('--ask-ai-top');
    };
    const schedule = () => {if (!frame) frame = requestAnimationFrame(update);};
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      cancelAnimationFrame(frame);
      root.style.removeProperty('--ask-ai-top');
    };
  }, [active]);
}

const MIN_WIDTH = 380, MIN_CONTENT_WIDTH = 640;

// Same bound as layout.css: the docs sidebar and a readable content column always stay visible.
function clampWidth(value) {
  const sidebar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--doc-sidebar-width')) || 300;
  const max = Math.max(MIN_WIDTH, window.innerWidth - sidebar - MIN_CONTENT_WIDTH);
  return Math.round(Math.min(Math.max(value, MIN_WIDTH), max));
}

// The right-hand shell both chat backends render into: it docks under the navbar, reserves page
// room on wide screens, resizes from its left edge and closes on Escape. `actions` are extra
// header buttons. The panel stays mounted while closed so a chat that keeps its own state
// (Inkeep) survives being hidden.
export default function DockedPanel({open, onClose, actions, children}) {
  const [width, setWidth] = useState(null);

  useNavbarOffset(open);

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem('ask-ai-width'), 10);
      if (saved) setWidth(clampWidth(saved));
    } catch {}
  }, []);

  function saveWidth(next) {
    setWidth(next);
    try {localStorage.setItem('ask-ai-width', String(next));} catch {}
  }

  // Page layout reads this attribute. It is an attribute, not a class, because the head manager
  // rewrites the html class list on every navigation.
  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    root.setAttribute('data-ask-ai', 'open');
    if (width) root.style.setProperty('--ask-ai-width', `${width}px`);
    return () => {
      root.removeAttribute('data-ask-ai');
      root.style.removeProperty('--ask-ai-width');
    };
  }, [open, width]);

  function startResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget, root = document.documentElement;
    handle.setPointerCapture(event.pointerId);
    root.setAttribute('data-ask-ai-resizing', '');
    let latest = null;
    const move = moveEvent => {
      latest = clampWidth(window.innerWidth - moveEvent.clientX);
      root.style.setProperty('--ask-ai-width', `${latest}px`);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      root.removeAttribute('data-ask-ai-resizing');
      if (latest) saveWidth(latest);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function resizeWithKeys(event) {
    const step = {ArrowLeft: 40, ArrowRight: -40}[event.key];
    if (!step) return;
    event.preventDefault();
    saveWidth(clampWidth((width ?? MIN_WIDTH) + step));
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault(); onClose();
      document.querySelector('[data-ask-ai-trigger]')?.focus();
    }
  }

  return <aside className={styles.panel} aria-label="Ask LiteLLM AI" onKeyDown={onKeyDown} hidden={!open}>
    <div className={styles.resizeHandle} role="separator" aria-orientation="vertical" aria-label="Resize Ask AI" tabIndex={0}
      aria-valuenow={width ?? MIN_WIDTH} aria-valuemin={MIN_WIDTH} title="Drag to resize, double-click to reset"
      onPointerDown={startResize} onKeyDown={resizeWithKeys} onDoubleClick={() => saveWidth(MIN_WIDTH)}/>
    <header className={styles.header}>
      <h2><Sparkles size={15} aria-hidden="true"/>Ask LiteLLM AI</h2>
      {actions}
      <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close Ask AI" title="Close"><X size={18}/></button>
    </header>
    {children}
  </aside>;
}
