import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Link from '@docusaurus/Link';
import Playground from './index';
import styles from './PlaygroundModal.module.css';

// An inline link that opens the whole playground in a dialog, for pages that mention it in passing.
// The playground mounts only once the dialog opens, so the page does not load the core until then.

export default function PlaygroundModal({children = 'router playground'}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && createPortal(<Dialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Dialog({onClose}) {
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement;
    box.current?.focus();
    // Lock the page on <html>, as ConfigModal does: the docs clip overflow-x on html.
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = event => {
      // A config dialog open inside the playground takes Escape for itself.
      if (event.key === 'Escape' && !box.current?.querySelector('[role="dialog"]')) {
        event.preventDefault();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
      if (before && document.contains(before)) before.focus?.();
    };
  }, []);

  return (
    <div className={styles.scrim} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div ref={box} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Router playground" tabIndex={-1}>
        <div className={styles.head}>
          <span className={styles.title}>Router playground</span>
          <Link className={styles.full} to="/router-playground">
            Open full page
          </Link>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          <Playground />
        </div>
      </div>
    </div>
  );
}
