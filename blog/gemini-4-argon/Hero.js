import React, {useEffect, useRef, useState} from 'react';
import video from './hero.mp4';
import poster from './hero-poster.jpg';
import styles from './hero.module.css';

const description = 'Gemini 4 Argon on LiteLLM: the LiteLLM and Gemini 4 Argon lockup, then Gemini 4 Argon selected in the LiteLLM model list.';
const posterUrl = typeof poster === 'string' ? poster : poster.src.src;

export default function GeminiArgonHero() {
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
    return <img src={posterUrl} alt={description} width="1280" height="720" />;
  }

  return (
    <div className={styles.hero}>
      <video
        ref={player}
        src={video}
        poster={posterUrl}
        width="1280"
        height="720"
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
