import React, {useEffect, useRef, useState} from 'react';
import styles from './request-flow-hero.module.css';

// Fixed phases keep the server render and client hydration identical.
const noise = (n, salt) => {
  const value = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function requestPath(y, fast) {
  const lane = fast ? 212 : 412;
  return `M 42 ${y} C 150 ${y}, 185 262, 310 262 C 393 262, 393 ${lane}, 470 ${lane} L 690 ${lane} C 810 ${lane}, 827 262, 928 262 L 1060 262`;
}

const PARTICLES = [
  ...Array.from({length: 112}, (_, i) => ({
    path: requestPath(124 + noise(i, 1) * 137, true),
    duration: 3.4 + noise(i, 2) * 0.8,
    phase: noise(i, 3),
    color: ['#b7cbff', '#8aabff', '#dce8ff', '#80d7d2'][i % 4],
    opacity: 0.58 + noise(i, 4) * 0.4,
    fast: true,
  })),
  ...Array.from({length: 44}, (_, i) => ({
    path: requestPath(277 + noise(i, 5) * 151, false),
    duration: 10.2 + noise(i, 6) * 1.8,
    phase: noise(i, 7),
    color: ['#a7a5bb', '#929cb5', '#c3bfd3'][i % 3],
    opacity: 0.43 + noise(i, 8) * 0.34,
    fast: false,
  })),
];

export default function RequestFlowHero() {
  const svgRef = useRef(null);
  const figureRef = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPaused(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    let visible = true;
    const syncPlayback = () => {
      if (paused || document.hidden || !visible) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(figureRef.current);
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      svg.pauseAnimations();
    };
  }, [paused]);

  return (
    <figure ref={figureRef} className={styles.hero}>
      <svg
        ref={svgRef}
        className={styles.stage}
        viewBox="0 0 1100 520"
        role="img"
        aria-label="Common requests flow quickly through the Rust fast path. Other requests take the slower Python path. Both routes reach the model providers. Particle speed is illustrative."
      >
        <rect width="1100" height="520" fill="#10131e" />
        <g fill="#7182ae" opacity="0.16" aria-hidden="true">
          {Array.from({length: 126}, (_, i) => (
            <rect key={i} x={30 + noise(i, 9) * 1040} y={74 + noise(i, 10) * 395} width="1.5" height="1.5" />
          ))}
        </g>
        <g aria-hidden="true">
          {[148, 190, 234].map(y => (
            <path key={y} d={requestPath(y, true)} fill="none" stroke="#6f94ed" strokeWidth="1" opacity="0.12" />
          ))}
          {[310, 362, 416].map(y => (
            <path key={y} d={requestPath(y, false)} fill="none" stroke="#8c8aab" strokeWidth="1" opacity="0.1" />
          ))}
          <path d="M310 262C393 262 393 212 470 212H690C810 212 827 262 928 262H1060" fill="none" stroke="#648cf0" strokeWidth="1.2" opacity="0.27" />
          <path d="M310 262C393 262 393 412 470 412H690C810 412 827 262 928 262H1060" fill="none" stroke="#9294aa" strokeWidth="1.2" opacity="0.2" />
          <rect x="470" y="119" width="220" height="126" rx="7" fill="#141d31" stroke="#4167bb" />
          <rect x="470" y="319" width="220" height="126" rx="7" fill="#171b29" stroke="#3e465e" />
        </g>

        <g className={styles.labels}>
          <text x="48" y="97" fill="#c4d7ff" fontSize="21" className={styles.groupLabel}>Common requests</text>
          <text x="48" y="123" fill="#7d92bf" fontSize="15" className={styles.detailLabel}>Anthropic Messages</text>
          <text x="48" y="456" fill="#a0a8bf" fontSize="20" className={styles.groupLabel}>Other requests</text>
          <text x="494" y="145" fill="#86a8ff" className={styles.metadata}>FAST PATH</text>
          <text x="494" y="184" fill="#edf2ff" fontSize="33" className={styles.processName}>Rust</text>
          <text x="494" y="345" fill="#929ab3" className={styles.metadata}>EXISTING PATH</text>
          <text x="494" y="384" fill="#d3d7e7" fontSize="33" className={styles.processName}>Python</text>
          <text x="994" y="315" textAnchor="middle" fill="#c0cae1" fontSize="20" className={styles.groupLabel}>Providers</text>
        </g>

        <g aria-hidden="true">
          {PARTICLES.map((particle, i) => (
            <g key={i} opacity={particle.opacity}>
              <rect x="-11" y="-1" width="2" height="2" fill={particle.color} opacity="0.18" />
              <rect x="-7" y="-1.2" width="2.4" height="2.4" fill={particle.color} opacity="0.4" />
              <rect x="-3" y="-1.5" width="3" height="3" fill={particle.color} opacity="0.7" />
              <rect x="1" y="-1.8" width="3.6" height="3.6" fill={particle.color} />
              <animateMotion
                path={particle.path}
                dur={`${particle.duration}s`}
                begin={`${-particle.phase * particle.duration}s`}
                repeatCount="indefinite"
                rotate="auto"
              />
            </g>
          ))}
          <circle cx="310" cy="262" r="4" fill="#b7c8ed" opacity="0.85" />
          <circle cx="994" cy="262" r="12" fill="#111726" stroke="#536b9c" />
          <circle cx="994" cy="262" r="3" fill="#d3e0ff" />
        </g>
      </svg>
      <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </figure>
  );
}
