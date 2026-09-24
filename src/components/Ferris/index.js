import React, {useEffect, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const LINES = [
  'blazingly fast. obviously.',
  'no undefined behavior in this sidebar.',
  'the borrow checker says hi.',
  'cargo cult? cargo build.',
  'zero cost, except the joke.',
  'fearless concurrency. fearful of deadlines.',
  'if it compiles, it ships.',
  'rust never sleeps. i do.',
];

export default function Ferris() {
  const {pathname} = useLocation();
  const ferris = useBaseUrl('/img/ferris.svg');
  const train = useBaseUrl('/img/litellm-train-nose.png');
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(null);
  const hideTimer = useRef(null);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const say = (text) => {
    setLine(text);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLine(null), 2600);
  };

  if (!pathname.startsWith('/docs')) return null;

  return (
    <div
      className={`${styles.crab} ${open ? styles.open : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      {line && <div className={styles.bubble}>{line}</div>}
      <button
        type="button"
        className={styles.button}
        onClick={() => say(LINES[Math.floor(Math.random() * LINES.length)])}
        aria-expanded={open}
        aria-label="Ferris is peeking from the left edge with the LiteLLM train. Hover to see him, click for a line.">
        <span className={styles.stage}>
          <img className={styles.ferris} src={ferris} alt="" />
          <img className={styles.train} src={train} alt="" />
        </span>
      </button>
    </div>
  );
}
