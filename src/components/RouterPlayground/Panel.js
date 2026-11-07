import React, {useEffect, useState} from 'react';
import styles from './Panel.module.css';

// A pane that folds to its header. Folding hides the body without unmounting it, so a live run
// keeps running underneath, and each pane remembers whether it was folded.

const key = id => `router-playground:fold:${id}`;

function remembered(id, fallback) {
  try {
    const value = window.localStorage.getItem(key(id));
    return value == null ? fallback : value === 'open';
  } catch {
    return fallback;
  }
}

export default function Panel({
  id,
  title,
  extra,
  folded,
  className,
  headClassName,
  sub,
  defaultOpen = true,
  reveal = 0,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(remembered(id, defaultOpen)), [id, defaultOpen]);
  // Something elsewhere on the page points into this pane, so unfold it.
  useEffect(() => {
    if (reveal) setOpen(true);
  }, [reveal]);
  const toggle = () => {
    setOpen(!open);
    try {
      window.localStorage.setItem(key(id), open ? 'closed' : 'open');
    } catch {
      // Folding still works for this visit.
    }
  };
  const Heading = sub ? 'span' : 'h2';
  return (
    <section className={`${className ?? ''} ${sub ? styles.sub : ''}`} data-open={open}>
      <div className={`${headClassName ?? ''} ${styles.head} ${open ? '' : styles.headFolded}`}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={toggle}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={styles.chevron}>
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <Heading className={sub ? styles.subTitle : styles.title}>{title}</Heading>
        </button>
        {open ? extra : folded && <span className={styles.folded}>{folded}</span>}
      </div>
      <div hidden={!open}>{children}</div>
    </section>
  );
}
