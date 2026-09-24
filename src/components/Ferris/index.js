import React, {useEffect, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
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

const EYES = {idle: 0, peek: -3, drag: 1, poke: 2};

export default function Ferris() {
  const {pathname} = useLocation();
  const crab = useRef(null);
  const [pos, setPos] = useState({x: 28, y: 28});
  const [mood, setMood] = useState('idle');
  const [line, setLine] = useState(null);
  const drag = useRef(null);
  const hideTimer = useRef(null);

  useEffect(() => {
    const place = () => {
      const width = crab.current?.offsetWidth ?? 92;
      setPos({
        x: Math.max(16, window.innerWidth - width - 28),
        y: Math.max(16, window.innerHeight - 132),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [pathname]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const say = (text) => {
    setLine(text);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLine(null), 2600);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const rect = crab.current.getBoundingClientRect();
    drag.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMood('drag');
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    drag.current.moved = true;
    const width = crab.current.offsetWidth;
    const height = crab.current.offsetHeight;
    setPos({
      x: Math.min(Math.max(8, event.clientX - drag.current.dx), window.innerWidth - width - 8),
      y: Math.min(Math.max(8, event.clientY - drag.current.dy), window.innerHeight - height - 8),
    });
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) {
      setMood('idle');
      return;
    }
    setMood('poke');
    say(LINES[Math.floor(Math.random() * LINES.length)]);
    window.setTimeout(() => setMood('idle'), 700);
  };

  if (!pathname.startsWith('/docs')) return null;

  return (
    <div
      ref={crab}
      className={styles.crab}
      style={{left: pos.x, top: pos.y}}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>
      {line && <div className={styles.bubble}>{line}</div>}
      <button
        type="button"
        className={styles.button}
        aria-label="Ferris, the Rust mascot. Drag to move, click for a line.">
        <svg viewBox="0 0 120 96" className={styles.svg} aria-hidden="true">
          <g className={styles.clawLeft}>
            <path d="M28 34c-8-10-20-8-22 2-2 8 6 14 14 12" />
            <path d="M24 42c-9 2-14 10-10 16 4 6 12 2 14-4" />
          </g>
          <g className={styles.clawRight}>
            <path d="M92 34c8-10 20-8 22 2 2 8-6 14-14 12" />
            <path d="M96 42c9 2 14 10 10 16-4 6-12 2-14-4" />
          </g>
          <ellipse className={styles.body} cx="60" cy="52" rx="34" ry="26" />
          <g className={styles.eyes} style={{transform: `translateY(${EYES[mood]}px)`}}>
            <circle cx="46" cy="30" r="11" />
            <circle cx="74" cy="30" r="11" />
            <circle className={styles.pupil} cx="48" cy="31" r="4.2" />
            <circle className={styles.pupil} cx="76" cy="31" r="4.2" />
          </g>
          <path className={styles.smile} d="M50 58c4 6 16 6 20 0" />
        </svg>
      </button>
    </div>
  );
}
