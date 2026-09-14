import React from 'react';

const TIERS = [
  { name: 'SIMPLE', desc: 'smallest, cheapest model', color: '#14b8a6' },
  { name: 'MEDIUM', desc: 'mid-size model', color: '#3b82f6' },
  { name: 'COMPLEX', desc: 'frontier model', color: '#8b5cf6' },
  { name: 'REASONING', desc: 'frontier model, high effort', color: '#f97316' },
];

const PRIMARY = 'var(--ifm-color-primary)';
const FONT = 'var(--ifm-font-family-base)';
const text = { fill: 'var(--ifm-font-color-base)', fontFamily: FONT };
const muted = { fill: 'var(--ifm-color-emphasis-700)', fontFamily: FONT };

const REQ = { x: 16, y: 116, w: 172, h: 68 };
const CLS = { x: 262, y: 106, w: 176, h: 88 };
const TIER = { x: 512, w: 224, h: 50, gap: 20, top: 18 };
const RES = { x: 794, y: 116, w: 156, h: 68 };

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function tierY(i) {
  return TIER.top + i * (TIER.h + TIER.gap);
}

function curve(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function Arrowhead({ id, color }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: color }} />
    </marker>
  );
}

export default function AutoRouterDiagram() {
  const clsMidY = CLS.y + CLS.h / 2;
  const resMidY = RES.y + RES.h / 2;
  return (
    <svg
      viewBox="0 0 962 300"
      role="img"
      aria-label="An inference request, sent under any model name you choose, enters the classifier, which sends it down one of four tier arms, SIMPLE, MEDIUM, COMPLEX, or REASONING, each backed by a model from any provider, and the response returns to the client."
      style={{ width: '100%', height: 'auto', display: 'block', margin: '0.5rem 0 2rem' }}
    >
      <defs>
        <Arrowhead id="ar-primary" color={PRIMARY} />
        {TIERS.map((t) => (
          <Arrowhead key={t.name} id={`ar-${t.name}`} color={t.color} />
        ))}
      </defs>

      <rect
        x={REQ.x} y={REQ.y} width={REQ.w} height={REQ.h} rx="10"
        style={{ fill: 'rgba(46, 133, 85, 0.08)', stroke: PRIMARY, strokeWidth: 1.5 }}
      />
      <text x={REQ.x + REQ.w / 2} y={REQ.y + 30} textAnchor="middle" fontSize="15" fontWeight="600" style={text}>Inference request</text>
      <text x={REQ.x + REQ.w / 2} y={REQ.y + 50} textAnchor="middle" fontSize="12" style={muted}>model: any-name-you-pick</text>

      <path d={`M ${REQ.x + REQ.w} ${clsMidY} L ${CLS.x - 2} ${clsMidY}`} style={{ fill: 'none', stroke: PRIMARY, strokeWidth: 2.5 }} markerEnd="url(#ar-primary)" />

      <rect
        x={CLS.x} y={CLS.y} width={CLS.w} height={CLS.h} rx="10"
        style={{ fill: 'rgba(46, 133, 85, 0.12)', stroke: PRIMARY, strokeWidth: 2 }}
      />
      <text x={CLS.x + CLS.w / 2} y={CLS.y + 32} textAnchor="middle" fontSize="15" fontWeight="600" style={text}>Classifier</text>
      <text x={CLS.x + CLS.w / 2} y={CLS.y + 52} textAnchor="middle" fontSize="12" style={muted}>heuristic scorer, LLM,</text>
      <text x={CLS.x + CLS.w / 2} y={CLS.y + 68} textAnchor="middle" fontSize="12" style={muted}>or keyword rules</text>

      {TIERS.map((t, i) => {
        const y = tierY(i);
        const mid = y + TIER.h / 2;
        const arm = { fill: 'none', stroke: t.color, strokeWidth: 2.25 };
        const head = `url(#ar-${t.name})`;
        return (
          <g key={t.name}>
            <path d={curve(CLS.x + CLS.w, clsMidY, TIER.x - 2, mid)} style={arm} markerEnd={head} />
            <rect
              x={TIER.x} y={y} width={TIER.w} height={TIER.h} rx="10"
              style={{ fill: hexToRgba(t.color, 0.12), stroke: t.color, strokeWidth: 1.75 }}
            />
            <circle cx={TIER.x + 18} cy={mid} r="5" style={{ fill: t.color }} />
            <text x={TIER.x + 32} y={y + 21} fontSize="12" fontWeight="700" letterSpacing="0.06em" style={{ fill: t.color, fontFamily: FONT }}>{t.name}</text>
            <text x={TIER.x + 32} y={y + 38} fontSize="12" style={muted}>{t.desc}</text>
            <path d={curve(TIER.x + TIER.w, mid, RES.x - 2, resMidY)} style={arm} markerEnd={head} />
          </g>
        );
      })}

      <rect
        x={RES.x} y={RES.y} width={RES.w} height={RES.h} rx="10"
        style={{ fill: 'rgba(46, 133, 85, 0.08)', stroke: PRIMARY, strokeWidth: 1.5 }}
      />
      <text x={RES.x + RES.w / 2} y={RES.y + 30} textAnchor="middle" fontSize="15" fontWeight="600" style={text}>Response</text>
      <text x={RES.x + RES.w / 2} y={RES.y + 50} textAnchor="middle" fontSize="12" style={muted}>any model, any provider</text>
    </svg>
  );
}
