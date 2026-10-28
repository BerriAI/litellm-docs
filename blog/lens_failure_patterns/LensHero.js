import React, {useEffect, useRef, useState} from 'react';
import video from './assets/lens-failure-patterns.mp4';
import poster from './assets/lens-failure-patterns-poster.png';
import styles from './hero.module.css';

const description = 'Lens reviews agent traces in parallel, groups related observations, and checks the original evidence before producing findings. The examples are illustrative.';
const posterUrl = typeof poster === 'string' ? poster : poster.src.src;

export default function LensHero() {
  const [animate, setAnimate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimate(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  if (!animate) {
    return <img src={posterUrl} alt={description} width="1440" height="640" />;
  }

  return (
    <div className={styles.hero}>
      <video
        ref={player}
        src={video}
        poster={posterUrl}
        width="1440"
        height="640"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={description}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className={styles.playback}
        aria-label={playing ? 'Pause animation' : 'Play animation'}
        onClick={() => {
          if (player.current.paused) {
            player.current.play().catch(() => setPlaying(false));
          } else {
            player.current.pause();
          }
        }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 2.5v11L13 8z" />}
        </svg>
      </button>
    </div>
  );
}
