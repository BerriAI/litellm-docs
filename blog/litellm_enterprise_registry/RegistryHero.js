import React, {useEffect, useRef, useState} from 'react';
import coverWebm from './cover.webm';
import coverMov from './cover.mov';
import coverGif from './cover.gif';
import coverPoster from './cover.png';
import styles from './hero.module.css';

const accessibleDescription = 'A cool white pulse reflects and refracts through frosted glass gateway beads. Absorbed light leaves a soft, fading phosphorescent glow.';
const posterVariants = coverPoster?.src?.images;
const posterUrl = typeof coverPoster === 'string' ? coverPoster
  : posterVariants?.length ? posterVariants.reduce((largest, item) => item.width > largest.width ? item : largest).path
  : coverPoster.src.src;

export default function RegistryHero() {
  const stageRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const [format, setFormat] = useState('webm');
  const tryNextFormat = () => setFormat(value => value === 'webm' ? 'mov' : 'gif');
  const checkTransparency = event => {
    // Some browsers decode the video color layer but omit its alpha layer.
    // Probe one empty pixel once per load; no rendering runs during playback.
    const video = event.currentTarget;
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const context = probe.getContext('2d');
    try {
      context.drawImage(video, 0, video.videoHeight - 1, 1, 1, 0, 0, 1, 1);
      if (context.getImageData(0, 0, 1, 1).data[3] > 8) tryNextFormat();
    } catch {
      tryNextFormat();
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bounds = stage.getBoundingClientRect();
    let visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
    const sync = () => setCanAnimate(visible && !document.hidden && !preference.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(stage);
    preference.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div className={styles.hero}>
      <div ref={stageRef} className={styles.stage}>
        {!paused && canAnimate ? (
          format === 'gif' ? (
            <img src={coverGif} width="1600" height="800" loading="lazy" decoding="async" alt={accessibleDescription} />
          ) : (
            <video key={format} src={format === 'webm' ? coverWebm : coverMov} autoPlay loop muted playsInline width="1600" height="800" poster={posterUrl} aria-label={accessibleDescription} onLoadedData={checkTransparency} onError={tryNextFormat} />
          )
        ) : (
          <img src={posterUrl} width="1600" height="800" loading="lazy" decoding="async" alt={accessibleDescription} />
        )}
      </div>
      <button type="button" className={styles.control} aria-label={paused ? 'Play animation' : 'Pause animation'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          {paused ? <path d="M6 3l11 7-11 7z" fill="currentColor" /> : <path d="M5 4h3v12H5zM12 4h3v12h-3z" fill="currentColor" />}
        </svg>
      </button>
    </div>
  );
}
