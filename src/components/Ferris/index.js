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
  const crab = useRef(null);
  const [x, setX] = useState(24);
  const [facing, setFacing] = useState(1);
  const [line, setLine] = useState(null);
  const [poked, setPoked] = useState(false);
  const paused = useRef(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    let frame;
    let last = performance.now();
    let dir = 1;
    const step = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (!paused.current) {
        const width = crab.current?.offsetWidth ?? 150;
        const max = Math.max(8, window.innerWidth - width - 8);
        setX((current) => {
          let next = current + dir * dt * 0.07;
          if (next <= 8) {
            next = 8;
            dir = 1;
            setFacing(1);
          } else if (next >= max) {
            next = max;
            dir = -1;
            setFacing(-1);
          }
          return next;
        });
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const say = (text) => {
    setLine(text);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLine(null), 2600);
  };

  const onClick = () => {
    setPoked(true);
    say(LINES[Math.floor(Math.random() * LINES.length)]);
    window.setTimeout(() => setPoked(false), 700);
  };

  if (!pathname.startsWith('/docs')) return null;

  return (
    <div
      ref={crab}
      className={styles.crab}
      style={{transform: `translateX(${x}px)`}}
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}>
      {line && <div className={styles.bubble}>{line}</div>}
      <button
        type="button"
        className={styles.button}
        onClick={onClick}
        aria-label="Ferris, walking the bottom of the page with the LiteLLM train. Click for a line.">
        <span className={`${styles.stage} ${poked ? styles.poke : ''}`} style={{scale: `${facing} 1`}}>
          <img className={styles.ferris} src={ferris} alt="" />
          <img className={styles.train} src={train} alt="" />
        </span>
      </button>
    </div>
  );
}
