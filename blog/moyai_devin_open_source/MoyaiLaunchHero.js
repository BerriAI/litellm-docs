import React, {useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';
import {hashN} from './objects/canvasLoop';
import planetrise from './objects/planetrise';

const LOGOS = '/img/blog/moyai_devin_open_source/logos/';

export const HARNESSES = [
  {name: 'Hermes', logo: 'hermes.png'},
  {name: 'Claude Code', logo: 'anthropic.svg'},
  {name: 'Codex', logo: 'openai.svg'},
  {name: 'OpenCode', logo: 'opencode.svg'},
  {name: 'Deep Agents', logo: 'langchain.svg'},
];

export const PROVIDERS = [
  {name: 'OpenAI', logo: 'openai.svg'},
  {name: 'Anthropic', logo: 'anthropic.svg'},
  {name: 'Fireworks', logo: 'fireworks.svg'},
  {name: 'Google', logo: 'google.svg'},
  {name: 'xAI', logo: 'xai.svg'},
  {name: 'Mistral', logo: 'mistral.svg'},
  {name: 'DeepSeek', logo: 'deepseek.svg'},
  {name: 'Bedrock', logo: 'bedrock.svg'},
];

const STAGE_AT = [0.1, 0.35, 0.95];
const PALETTE = ['#cfe3ff', '#9cc3ff', '#ffffff', '#ffb98a', '#8b9bff', '#e9d8ff'];

function clipAboveFooter(canvas) {
  const footer = document.querySelector('footer');
  const top = footer ? footer.getBoundingClientRect().top : window.innerHeight;
  canvas.style.clipPath = `inset(0 0 ${Math.max(0, window.innerHeight - top)}px 0)`;
}

function startSky(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, stars = [], rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({length: Math.round((W * H) / 5200)}, (_, n) => ({
      x: hashN(n, 1) * W,
      y: hashN(n, 2) * H,
      r: hashN(n, 3) < 0.06 ? 1.5 : 0.4 + hashN(n, 4) * 0.8,
      color: PALETTE[Math.floor(hashN(n, 5) * PALETTE.length)],
      phase: hashN(n, 6) * Math.PI * 2,
      depth: 0.2 + hashN(n, 7) * 0.8,
    }));
  }

  function frame(ms) {
    const t = ms / 1000;
    clipAboveFooter(canvas);
    ctx.clearRect(0, 0, W, H);
    const scroll = window.scrollY;
    for (const s of stars) {
      const y = (((s.y - scroll * 0.08 * s.depth - t * 3 * s.depth) % H) + H) % H;
      ctx.globalAlpha = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.8 + s.phase))) * s.depth;
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

function useScrollProgress(ref) {
  const progress = useRef(0);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const el = ref.current;
    const fit = () => {
      el.style.marginLeft = '0px';
      el.style.marginLeft = `${-el.getBoundingClientRect().left}px`;
      el.style.width = `${document.documentElement.clientWidth}px`;
    };
    const update = () => {
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height - window.innerHeight)));
      progress.current = p;
      el.style.setProperty('--p', p.toFixed(3));
      setStage(STAGE_AT.filter((at) => p >= at).length);
    };
    const onResize = () => { fit(); update(); };
    onResize();
    window.addEventListener('scroll', update, {passive: true});
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
    };
  }, [ref]);
  return [progress, stage];
}

function useNight() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = 'dark';
    root.classList.add('moyai-night');
    return () => {
      root.classList.remove('moyai-night');
      if (previous) root.dataset.theme = previous;
    };
  }, []);
}

export function Logo({item, className}) {
  return <img className={className} src={useBaseUrl(LOGOS + item.logo)} alt={item.name} title={item.name} />;
}

function Orbit({items, radius, speed, orbit, className}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cos = Math.cos(orbit.angle), sin = Math.sin(orbit.angle);
    let rafId = 0;
    const frame = (ms) => {
      const t = ms / 1000;
      const hero = el.parentElement.getBoundingClientRect();
      const title = el.parentElement.querySelector('h1').getBoundingClientRect();
      const top = title.bottom - hero.top + 28;
      const bottom = hero.height * orbit.horizon - 20;
      const outer = Math.min(window.innerWidth * orbit.outer[0], orbit.outer[1]);
      const scale = Math.min(1, Math.max(0, (bottom - top) / 2 - 18) / (outer * orbit.tilt));
      const rx = Math.min(window.innerWidth * radius[0], radius[1]) * scale;
      const ry = rx * orbit.tilt;
      el.style.top = `${(top + bottom) / 2}px`;
      const beam = orbit.flare ? orbit.flare(t) : null;
      [...el.children].forEach((chip, i) => {
        const theta = (i / items.length) * Math.PI * 2 + t * speed;
        const ex = Math.cos(theta) * rx, ey = Math.sin(theta) * ry;
        const front = Math.sin(theta) > 0;
        chip.style.transform = `translate(${ex * cos - ey * sin}px, ${ex * sin + ey * cos}px) translate(-50%, -50%)`;
        chip.style.zIndex = front ? 2 : 1;
        chip.style.opacity = front ? 1 : 0.55;
      });
      if (!reduce) rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [items, radius, speed, orbit]);
  return (
    <div ref={ref} className={`${styles.orbit} ${className}`}>
      {items.map((item) => (
        <div key={item.name} className={styles.chip}>
          <Logo item={item} className={styles.chipLogo} />
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  );
}

function Starfield({backdrop}) {
  const ref = useRef(null);
  useNight();
  useEffect(() => startSky(ref.current), []);
  return (
    <>
      <div className={styles.backdrop} style={{background: backdrop}} aria-hidden="true" />
      <canvas ref={ref} className={styles.sky} aria-hidden="true" />
    </>
  );
}

export default function MoyaiLaunchHero({date, sections}) {
  const ref = useRef(null);
  const swirlRef = useRef(null);
  const [progress, stage] = useScrollProgress(ref);
  const object = planetrise;
  useEffect(() => object.start(swirlRef.current, progress), [object, progress]);

  return (
    <>
      <Starfield backdrop={object.backdrop} />
      <section className={styles.scroller} ref={ref} data-stage={stage} style={{'--accent': object.accent}}>
        <div className={styles.hero}>
          <canvas ref={swirlRef} className={styles.swirl} aria-hidden="true" />
          <h1 className={styles.split}>
            <img className={styles.mark} src={useBaseUrl('/img/blog/moyai_devin_open_source/moyai-head.svg')} alt="" />
            <span className={styles.brand}>Moyai</span>
            <span className={styles.subhead}>Open source cloud agent</span>
          </h1>
          <div className={styles.date}>{date}</div>
          <Orbit items={HARNESSES} radius={object.orbit.inner} speed={0.07} orbit={object.orbit} className={styles.orbitInner} />
          <Orbit items={PROVIDERS} radius={object.orbit.outer} speed={-0.045} orbit={object.orbit} className={styles.orbitOuter} />
          <p className={styles.tagline}>
            <span>Works with Claude Code and Codex</span>
            <span>Self-hosted · 100+ providers through LiteLLM</span>
          </p>
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

export function LogoWall({title, items}) {
  return (
    <figure className={styles.wall}>
      <figcaption>{title}</figcaption>
      <div className={styles.wallGrid}>
        {items.map((item) => (
          <div key={item.name} className={styles.wallItem}>
            <Logo item={item} className={styles.wallLogo} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
