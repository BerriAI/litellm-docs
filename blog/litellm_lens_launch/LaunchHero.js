import React, {useEffect, useRef, useState} from 'react';
import {LensHeroZoomed} from './LensHero';
import styles from './styles.module.css';

const STAGE_AT = [0.18, 0.4, 0.62, 0.82];
const STAR_COLORS = ['#2aa889', '#8b5cf6', '#ec6f93', '#27b6e8', '#e3a42b', '#0017b7'];

function clipAboveFooter(canvas) {
  const footer = document.querySelector('footer');
  const top = footer ? footer.getBoundingClientRect().top : window.innerHeight;
  canvas.style.clipPath = `inset(0 0 ${Math.max(0, window.innerHeight - top)}px 0)`;
}

function startStars(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, stars = [], rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({length: Math.round((W * H) / 9000)}, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.12 ? 1.8 : 0.6 + Math.random() * 0.8,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      phase: Math.random() * Math.PI * 2,
      drift: 4 + Math.random() * 10,
    }));
  }

  function frame(ms) {
    const t = ms / 1000;
    clipAboveFooter(canvas);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const y = (s.y - t * s.drift + H) % H;
      ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * 0.9 + s.phase));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduce) rafId = requestAnimationFrame(frame);
  }

  resize();
  const onResize = () => { resize(); if (reduce) frame(0); };
  window.addEventListener('resize', onResize);
  if (reduce) frame(0);
  else rafId = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
  };
}

function Starfield() {
  const ref = useRef(null);
  useEffect(() => startStars(ref.current), []);
  return <canvas ref={ref} className={styles.stars} aria-hidden="true" />;
}

const hashN = (n, k) => {
  const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const SWARM = Array.from({length: 360}, (_, n) => ({
  phase: hashN(n, 1),
  speed: 0.025 + hashN(n, 2) * 0.025,
  y0: hashN(n, 3),
  colony: Math.floor(hashN(n, 4) * 5),
  color: Math.floor(hashN(n, 5) * 5),
  wob: hashN(n, 6) * 6.28,
}));

const smoothStep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function startRails(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELL = 6;
  let W = 0, H = 0, gutter = 0, rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gutter = Math.max(0, (W - 860) / 2 - 72);
  }

  function dot(x, y, color, alpha, size = 1.3) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(Math.round(x / CELL) * CELL, Math.round(y / CELL) * CELL, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSwarm(t, gateY) {
    for (const a of SWARM) {
      const u = (a.phase + t * a.speed) % 1;
      const colonyY = H * (0.12 + a.colony * 0.19);
      const mid = a.y0 * H + (colonyY - a.y0 * H) * smoothStep(u / 0.4);
      const pull = Math.pow(smoothStep((u - 0.35) / 0.65), 1.5);
      const y = mid + (gateY - mid) * pull + Math.sin(u * 12 + a.wob + t) * 8 * (1 - pull);
      dot(u * gutter, y, STAR_COLORS[a.color], 0.4 * Math.min(1, u * 8) * Math.min(1, (1 - u) * 2.5));
    }
  }

  function drawGate(gateY) {
    const gx = gutter + 2, h = 22;
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = STAR_COLORS[5];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx - 7, gateY - h); ctx.lineTo(gx, gateY - h); ctx.lineTo(gx, gateY - h * 0.5);
    ctx.moveTo(gx - 7, gateY + h); ctx.lineTo(gx, gateY + h); ctx.lineTo(gx, gateY + h * 0.5);
    ctx.stroke();
  }

  function frame(ms) {
    ctx.clearRect(0, 0, W, H);
    clipAboveFooter(canvas);
    canvas.style.opacity = Math.min(1, Math.max(0, (window.scrollY - H * 1.6) / (H * 0.5)));
    if (gutter >= 140) {
      const t = ms / 1000 + window.scrollY / 600;
      const lineY = H * 0.42;
      drawSwarm(t, lineY);
      drawGate(lineY);
    }
    if (!reduce) rafId = requestAnimationFrame(frame);
  }

  resize();
  const onResize = () => { resize(); if (reduce) frame(0); };
  window.addEventListener('resize', onResize);
  if (reduce) frame(0);
  else rafId = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
  };
}

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.35;
      const passed = ids.filter((id) => {
        const el = document.getElementById(id);
        return el && el.getBoundingClientRect().top < line;
      });
      const footer = document.querySelector('footer');
      const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      const nearFooter = footerTop < window.innerHeight * 0.5 + 150;
      const atEnd = footerTop < window.innerHeight;
      const current = atEnd ? ids[ids.length - 1] : passed[passed.length - 1];
      setActive(passed.length && !nearFooter ? current : '');
    };
    update();
    window.addEventListener('scroll', update, {passive: true});
    return () => window.removeEventListener('scroll', update);
  }, [ids]);
  return active;
}

function SideNav({sections}) {
  const ids = sections.map(([id]) => id);
  const active = useActiveSection(ids);
  return (
    <nav className={`${styles.sideNav} ${active ? styles.sideNavShown : ''}`} aria-label="On this page">
      <div className={styles.sideNavTitle}>On this page</div>
      <ol>
        {sections.map(([id, label], i) => (
          <li key={id} className={id === active ? styles.sideNavActive : undefined}>
            <a href={`#${id}`}>
              <span>[{i + 1}]</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SideRails({sections}) {
  const ref = useRef(null);
  useEffect(() => startRails(ref.current), []);
  return (
    <>
      <canvas ref={ref} className={styles.rails} aria-hidden="true" />
      <SideNav sections={sections} />
    </>
  );
}

function useScrollStage(ref) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const el = ref.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height - window.innerHeight)));
      el.style.setProperty('--p', p.toFixed(3));
      setStage(STAGE_AT.filter((at) => p >= at).length);
    };
    update();
    window.addEventListener('scroll', update, {passive: true});
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ref]);
  return stage;
}

export default function LaunchHero({date, tagline, sections}) {
  const ref = useRef(null);
  const stage = useScrollStage(ref);

  return (
    <>
      <Starfield />
      <section className={styles.scroller} ref={ref} data-stage={stage}>
        <div className={styles.hero}>
          <div className={styles.date}>{date}</div>
          <h1 className={styles.headline}>LiteLLM Lens</h1>
          <div className={styles.stage}>
            <LensHeroZoomed className={styles.field} />
            <div className={`${styles.label} ${styles.lSwarm}`}>
              <b>Agent swarms</b>200K+ traces from every agent
            </div>
            <div className={`${styles.label} ${styles.lGate}`}>
              <b>LiteLLM gateway</b>every call, one chokepoint
            </div>
            <div className={`${styles.label} ${styles.lLens}`}>
              <b>Lens</b>insight flows back to your agents
            </div>
          </div>
          <p className={styles.tagline}>{tagline}</p>
        </div>
      </section>
      <ol className={styles.toc}>
        {sections.map(([id, label], i) => (
          <li key={id}>
            <a href={`#${id}`}>
              <span>[{i + 1}]</span>
              <span className={styles.dots} aria-hidden="true" />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

export function Partner({href, logo, name, quote, author}) {
  return (
    <figure className={styles.partner}>
      <a className={styles.partnerName} href={href} target="_blank" rel="noopener noreferrer">
        <img src={logo} alt="" />
        {name}
      </a>
      <blockquote className={styles.partnerQuote}>&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className={styles.partnerAuthor}>{author}</figcaption>
    </figure>
  );
}
