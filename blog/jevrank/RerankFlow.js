import React, {useEffect, useRef, useState} from 'react';
import styles from './launch.module.css';

const description =
  'Dotted document surfaces converge through JevRank and emerge as an ordered stack. Decision probabilities become relevance scores; the original document indices stay attached.';

function addLine(points, from, to, opacity = 0.8, spacing = 5) {
  const count = Math.max(
    1,
    Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / spacing),
  );
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    points.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      opacity,
    ]);
  }
}

function makeScene(mobile) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 640 : 380;
  const source = mobile ? [180, 150] : [195, 185];
  const hub = mobile ? [450, 320] : [600, 185];
  const output = mobile ? [710, 490] : [1005, 185];
  const points = [];

  // Sample document surfaces, their edges and text lines into a fixed dot field.
  for (let layer = 0; layer < 3; layer += 1) {
    const project = (u, v) => [
      source[0] + (u - 0.5) * 230 + (v - 0.5) * 75 + layer * 9,
      source[1] + (v - 0.5) * 145 - (u - 0.5) * 45 - layer * 28,
    ];
    for (let u = 0; u <= 1; u += 1 / 38) {
      for (let v = 0; v <= 1; v += 1 / 24) {
        const [x, y] = project(u, v);
        points.push([x, y, 0.12 + layer * 0.08 + v * 0.08]);
      }
    }
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].map(([u, v]) => project(u, v));
    corners.forEach((corner, i) =>
      addLine(points, corner, corners[(i + 1) % 4], 0.55 + layer * 0.15, 4),
    );
    for (let row = 0; row < 4; row += 1) {
      addLine(
        points,
        project(0.17, 0.25 + row * 0.15),
        project(row === 3 ? 0.55 : 0.82, 0.25 + row * 0.15),
        0.65,
        4,
      );
    }
  }

  // A thin, three-dimensional gate is the transformation point, not a model score.
  for (let ring = 0; ring < 3; ring += 1) {
    for (let i = 0; i < 110; i += 1) {
      const angle = (i / 110) * Math.PI * 2;
      points.push([
        hub[0] + Math.cos(angle) * 31 + (ring - 1) * 11,
        hub[1] + Math.sin(angle) * 73,
        0.35 + ring * 0.2,
      ]);
    }
  }

  for (let rank = 0; rank < 3; rank += 1) {
    const left = output[0] - 114;
    const top = output[1] - 72 + rank * 53;
    const corners = [
      [left, top],
      [left + 230, top],
      [left + 230, top + 39],
      [left, top + 39],
    ];
    corners.forEach((corner, i) =>
      addLine(
        points,
        corner,
        corners[(i + 1) % 4],
        rank === 0 ? 0.95 : 0.55,
        4,
      ),
    );
    for (let x = 7; x < 230; x += 6) {
      for (let y = 7; y < 36; y += 6)
        points.push([left + x, top + y, rank === 0 ? 0.22 : 0.1]);
    }
    addLine(
      points,
      [left + 24, top + 14],
      [left + 194 - rank * 25, top + 14],
      0.8,
      4,
    );
    addLine(points, [left + 24, top + 25], [left + 143, top + 25], 0.45, 4);
  }
  return {width, height, source, hub, output, points};
}

function curve(from, to, t) {
  const ease = t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * ease];
}

export default function RerankFlow() {
  const canvasRef = useRef(null);
  const elapsedRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    let scene;
    let frame = 0;
    let lastFrame = 0;
    let lastTick = null;
    let elapsed = elapsedRef.current;
    let visible = true;
    const canAnimate = () => playing && !reduced && visible && !document.hidden;

    function render(time) {
      const {width, height, source, hub, output, points} = scene;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#eef8ff';
      for (const [x, y, alpha] of points) {
        context.globalAlpha = alpha;
        context.fillRect(x, y, 1.25, 1.25);
      }

      const seconds = time / 1000;
      for (let lane = 0; lane < 5; lane += 1) {
        const start = [source[0] + 148, source[1] + (lane - 2) * 24];
        const finish = [output[0] - 124, output[1] + (lane - 2) * 21];
        for (let i = 0; i < 28; i += 1) {
          const t = (i / 28 + seconds * 0.055) % 1;
          const [x, y] =
            t < 0.5
              ? curve(start, hub, t * 2)
              : curve(hub, finish, (t - 0.5) * 2);
          context.globalAlpha = 0.12 + Math.sin(t * Math.PI) * 0.5;
          context.fillRect(x, y, i % 7 === 0 ? 2 : 1.2, i % 7 === 0 ? 2 : 1.2);
        }
      }
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(hub[0], hub[1], 3.5, 0, Math.PI * 2);
      context.fill();
    }

    function tick(time) {
      frame = 0;
      if (!canAnimate()) return;
      elapsed += lastTick === null ? 0 : time - lastTick;
      elapsedRef.current = elapsed;
      lastTick = time;
      if (time - lastFrame >= 1000 / 30) {
        render(elapsed);
        lastFrame = time;
      }
      if (canAnimate()) frame = requestAnimationFrame(tick);
    }

    function synchronize() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTick = null;
      if (!scene) return;
      if (canAnimate()) frame = requestAnimationFrame(tick);
      else render(elapsed);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      scene = makeScene(window.matchMedia('(max-width: 770px)').matches);
      canvas.width = Math.round(bounds.width * dpr);
      canvas.height = Math.round(bounds.height * dpr);
      const scale = bounds.width / scene.width;
      context.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      render(elapsed);
      synchronize();
    }

    const resizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        synchronize();
      },
      {threshold: 0.01},
    );
    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    document.addEventListener('visibilitychange', synchronize);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [playing, reduced]);

  return (
    <figure className={styles.dottedFlow}>
      <div className={styles.flowProviders}>
        <span>DECISION MODELS</span>
        <span>
          <img src="/img/jevrank/typesafe.png" width="22" height="22" alt="" />
          TypeSafe Jev
        </span>
        <span>
          <img
            src="/img/jevrank/perplexity-ai.svg"
            width="22"
            height="22"
            alt=""
          />
          Perplexity
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.flowCanvas}
        role="img"
        aria-label={description}
      />
      <figcaption className={styles.flowLabels}>
        <span>
          <small>01 / INPUT</small>
          <strong>Query + passages</strong>
          <code>query, documents[]</code>
        </span>
        <span>
          <small>02 / TRANSFORM</small>
          <strong>JevRank</strong>
          <code>probabilities → scores</code>
        </span>
        <span>
          <small>03 / OUTPUT</small>
          <strong>Ranked passages</strong>
          <code>index, relevance_score</code>
        </span>
      </figcaption>
      <button
        className={styles.motionControl}
        type="button"
        onClick={() => setPlaying(!playing)}
        disabled={reduced}
        aria-label={
          reduced
            ? 'Animation disabled for reduced motion'
            : playing
              ? 'Pause flow animation'
              : 'Play flow animation'
        }
      >
        {reduced ? 'Reduced motion' : playing ? 'Pause motion' : 'Play motion'}
      </button>
    </figure>
  );
}
