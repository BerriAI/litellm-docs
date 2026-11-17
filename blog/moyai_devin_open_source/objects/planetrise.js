import {canvasLoop, hashN} from './canvasLoop';

const CITY = Array.from({length: 700}, (_, n) => ({
  a: (hashN(n, 1) - 0.5) * 1.3,
  depth: Math.pow(hashN(n, 2), 2) * 0.08,
  r: 0.4 + hashN(n, 3) * 0.9,
  twinkle: hashN(n, 4) * Math.PI * 2,
}));

function start(canvas, progressRef) {
  return canvasLoop(canvas, (ctx, W, H, t) => {
    const p = progressRef.current;
    const R = Math.max(W * 1.25, H * 1.4);
    const cx = W / 2;
    const cy = H * (0.78 + p * 0.08) + R;
    const sunY = cy - R - H * (0.02 + 0.04 * Math.sin(t * 0.15) * 0.3) + p * H * 0.06;

    const sky = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, W * 0.7);
    sky.addColorStop(0, 'rgba(120,170,255,0.32)');
    sky.addColorStop(0.35, 'rgba(70,110,220,0.1)');
    sky.addColorStop(1, 'rgba(40,60,140,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    const flare = ctx.createLinearGradient(0, sunY, W, sunY);
    flare.addColorStop(0, 'rgba(120,170,255,0)');
    flare.addColorStop(0.5, 'rgba(210,230,255,0.55)');
    flare.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, sunY - 1.2, W, 2.4);
    const sun = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, H * 0.16);
    sun.addColorStop(0, 'rgba(255,255,255,1)');
    sun.addColorStop(0.08, 'rgba(220,235,255,0.9)');
    sun.addColorStop(0.35, 'rgba(140,180,255,0.22)');
    sun.addColorStop(1, 'rgba(100,140,255,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    const limb = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, R * 1.012);
    limb.addColorStop(0, 'rgba(60,110,255,0)');
    limb.addColorStop(0.55, 'rgba(110,160,255,0.55)');
    limb.addColorStop(0.75, 'rgba(200,225,255,0.9)');
    limb.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.012, Math.PI * 1.08, Math.PI * 1.92);
    ctx.arc(cx, cy, R * 0.985, Math.PI * 1.92, Math.PI * 1.08, true);
    ctx.closePath();
    ctx.fill();

    for (const c of CITY) {
      const theta = -Math.PI / 2 + c.a * (W / R);
      const rr = R * (0.996 - c.depth);
      const x = cx + Math.cos(theta) * rr;
      const y = cy + Math.sin(theta) * rr;
      if (y > H) continue;
      ctx.globalAlpha = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + c.twinkle))) * (1 - c.depth * 8);
      ctx.fillStyle = '#ffd59a';
      ctx.beginPath();
      ctx.arc(x, y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export default {
  id: 'planetrise',
  label: 'Planetrise',
  accent: '#a9c6ff',
  backdrop: 'radial-gradient(ellipse at 50% 70%, #0a1226 0%, #04060c 65%)',
  orbit: {tilt: 0.2, angle: 0, horizon: 0.78, inner: [0.16, 240], outer: [0.28, 420]},
  start,
};
