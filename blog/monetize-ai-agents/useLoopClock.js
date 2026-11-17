import {useEffect, useRef, useState} from 'react';

/**
 * Animation clock for the post's visuals. Runs only while the element is on screen and the tab is
 * visible, and holds a still frame (`still`) when the reader prefers reduced motion.
 */
export function useLoopClock({fps = 15, threshold = 0.15, initial = 0, still = initial} = {}) {
  const ref = useRef(null);
  const clock = useRef(initial);
  const [elapsed, setElapsed] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 1024px)');
    let visible = false;
    let animationId;
    let previousTime;
    let lastRender = 0;
    const animate = now => {
      if (previousTime !== undefined) clock.current += Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      if (now - lastRender >= 1000 / fps) {
        setElapsed(clock.current);
        lastRender = now;
      }
      animationId = window.requestAnimationFrame(animate);
    };
    const update = () => {
      window.cancelAnimationFrame(animationId);
      previousTime = undefined;
      setCompact(narrow.matches);
      const shouldPlay = visible && !document.hidden && !motion.matches;
      setPlaying(shouldPlay);
      if (motion.matches) setElapsed(still);
      if (shouldPlay) animationId = window.requestAnimationFrame(animate);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, {threshold});
    observer.observe(ref.current);
    motion.addEventListener('change', update);
    narrow.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      narrow.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.cancelAnimationFrame(animationId);
    };
  }, [fps, threshold, initial, still]);

  return {ref, elapsed, playing, compact};
}
