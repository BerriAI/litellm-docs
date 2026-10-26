export const hashN = (n, k) => {
  const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function canvasLoop(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = {W: 0, H: 0};
  let rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    size.W = rect.width; size.H = rect.height;
    canvas.width = Math.round(size.W * dpr); canvas.height = Math.round(size.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(ms) {
    ctx.clearRect(0, 0, size.W, size.H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    draw(ctx, size.W, size.H, ms / 1000);
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
