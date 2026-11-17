import React from 'react';

export const LOOP_SECONDS = 12;
export const ARRIVAL_TIMES = Array.from({length: 21}, (_, index) => 1 + index * 0.45);

const WHITE = '#f4f5f7';
const MUTED = '#8a8d93';
const BLUE = '#174bff';
const CYAN = '#69d5f4';
const GREEN = '#9fe3b4';
const AMBER = '#ffb547';
const MONO = '"Geist Mono", "SFMono-Regular", Consolas, monospace';
const SANS = 'Geist, Arial, Helvetica, sans-serif';

// Illustrative customers, one per pricing model. Each highlighted request adds `step` to model cost.
const PLANS = [
  {plan: 'Prepaid credits', customer: 'Acme', detail: '$100 credit pack', paid: 100, cap: 60, start: 39, step: 3},
  {plan: 'Per seat', customer: 'Globex', detail: '12 seats × $100', paid: 1200, cap: 720, start: 430, step: 5},
  {plan: 'Usage-based', customer: 'Initech', detail: 'Model cost × 1.3', markup: 1.3, cap: 500, start: 300, step: 4},
];

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
};
const money = value => `$${Math.round(value).toLocaleString('en-US')}`;

export function getMonetizeState(elapsed = 0) {
  const time = ((elapsed % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const plans = PLANS.map((plan, column) => {
    const accounted = ARRIVAL_TIMES.reduce((sum, arrival, index) => index % 3 === column ? sum + ease((time - arrival) / 0.22) : sum, 0);
    const cost = Math.min(plan.cap, plan.start + accounted * plan.step);
    const paid = plan.markup ? cost * plan.markup : plan.paid;
    return {...plan, cost, paid, paused: cost >= plan.cap, margin: (paid - cost) / paid * 100};
  });
  const pulses = PLANS.map((_, column) => ARRIVAL_TIMES.reduce((peak, arrival, index) => index % 3 !== column || time < arrival ? peak : Math.max(peak, 1 - (time - arrival) / 0.4), 0));
  const gatewayPulse = ARRIVAL_TIMES.reduce((peak, arrival) => Math.max(peak, 1 - Math.abs(time - (arrival - 1.1)) / 0.25), 0);
  return {time, plans, pulses, gatewayPulse: clamp(gatewayPulse)};
}

function pointOnCubic(points, progress) {
  const t = clamp(progress);
  const u = 1 - t;
  const [a, b, c, d] = points;
  const x = u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0];
  const y = u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1];
  const dx = 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0]);
  const dy = 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1]);
  return {x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI};
}

// A route is one cubic or a list of cubics. Progress is shared out by each segment's chord length.
const segmentsOf = route => Array.isArray(route[0][0]) ? route : [route];
const chord = ([a, , , d]) => Math.hypot(d[0] - a[0], d[1] - a[1]) || 1;

function pointOnCurve(route, progress) {
  const segments = segmentsOf(route);
  const lengths = segments.map(chord);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let distance = clamp(progress) * total;
  for (let index = 0; index < segments.length; index += 1) {
    if (distance <= lengths[index] || index === segments.length - 1) return pointOnCubic(segments[index], distance / lengths[index]);
    distance -= lengths[index];
  }
  return pointOnCubic(segments[0], 0);
}

const curvePath = route => segmentsOf(route).map((points, index) => `${index === 0 ? `M${points[0].join(',')} ` : ''}C${points[1].join(',')} ${points[2].join(',')} ${points[3].join(',')}`).join(' ');

// Wide layout: requests enter from the left, meet the gateway, and drop into three plan cards.
const WIDE = {
  width: 1600, height: 600, gateway: [800, 92],
  cards: [100, 580, 1060].map(x => ({x, y: 222, w: 440, h: 340})),
  incoming: lane => [[-30, 28 + lane * 13], [300, 30 + lane * 13], [480, 92 + (lane - 6) * 2], [672, 92 + (lane - 6) * 2]],
  outgoing: column => [[800, 132], [800, 180], [320 + column * 480, 170], [320 + column * 480, 222]],
};
// Phone layout: the gateway sits on top and the plan cards stack.
const COMPACT = {
  width: 720, height: 965, gateway: [360, 92],
  cards: [0, 1, 2].map(index => ({x: 60, y: 200 + index * 250, w: 620, h: 230})),
  incoming: lane => [[60 + lane * 50, 0], [60 + lane * 50, 30], [360 + (lane - 6) * 4, 30], [360 + (lane - 6) * 4, 62]],
  // Requests swing left above the first card, run down a gutter outside the cards, then turn into each card's side.
  outgoing: column => {
    const enter = 315 + column * 250;
    return [
      [[360, 132], [360, 178], [28, 170], [28, 206]],
      [[28, 206], [28, 206], [28, enter - 16], [28, enter - 16]],
      [[28, enter - 16], [28, enter], [28, enter], [60, enter]],
    ];
  },
};

function Packet({curve, progress, color, glowId, opacity = 1, trail = 0.14}) {
  const {x, y, angle} = pointOnCurve(curve, progress);
  const trailPoints = Array.from({length: 7}, (_, index) => pointOnCurve(curve, Math.max(0, progress - trail * (1 - index / 6))));
  return <g opacity={opacity}>
    {trailPoints.slice(1).map((point, index) => <path key={index} d={`M${trailPoints[index].x},${trailPoints[index].y} L${point.x},${point.y}`} stroke={color} strokeWidth={1 + index / 6} opacity={0.06 + index * 0.08} fill="none" />)}
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x="-12" y="-4" width="24" height="8" fill={color} opacity="0.3" filter={`url(#${glowId})`} />
      <rect x="-8" y="-2" width="16" height="4" rx="0.5" fill={color} />
    </g>
  </g>;
}

function Traffic({state, layout, prefix}) {
  const requests = [...ARRIVAL_TIMES, ...ARRIVAL_TIMES.map(arrival => arrival + LOOP_SECONDS)];
  return <g>
    {requests.map((arrival, index) => {
      const column = index % 3;
      const age = state.time - (arrival - 2.3);
      if (age < 0 || age > 2.3) return null;
      const color = column === 0 ? BLUE : CYAN;
      if (age < 1.2) return <Packet key={arrival} curve={layout.incoming((index * 5) % 13)} progress={age / 1.2} color={color} glowId={`${prefix}-glow`} />;
      if (age < 1.35) return null;
      // A request for a capped customer stops at the gateway.
      if (state.plans[column].paused && state.time >= arrival - 0.95) return null;
      return <Packet key={arrival} curve={layout.outgoing(column)} progress={(age - 1.35) / 0.95} color={color} glowId={`${prefix}-glow`} />;
    })}
  </g>;
}

function Bar({x, y, width, value, scale, color, cap, paused, pulse = 0}) {
  const count = 32;
  const step = width / count;
  return <g>
    {Array.from({length: count}, (_, index) => <rect key={index} x={x + index * step} y={y} width={step * 0.62} height="14" fill={(index + 0.5) / count * scale < value ? color : '#22252a'} />)}
    {pulse > 0 && <rect x={x} y={y - 3} width={width * Math.min(value / scale, 1)} height="20" fill={color} opacity={pulse * 0.14} />}
    {cap !== undefined && <g>
      <path d={`M${x + width * cap / scale},${y - 8} V${y + 22}`} stroke={paused ? AMBER : WHITE} strokeWidth="2" />
      <text x={x + width * cap / scale} y={y + 38} fontFamily={MONO} fontSize="12" fill={paused ? AMBER : MUTED} textAnchor="middle">cap {money(cap)}</text>
    </g>}
  </g>;
}

function PlanCard({card, plan, pulse, compact = false}) {
  const {x, y, w, h} = card;
  const inner = w - 56;
  const scale = Math.max(plan.paid, plan.cap) * 1.08;
  if (compact) return <g fontFamily={SANS}>
    <rect x={x} y={y} width={w} height={h} rx="14" fill="#030405" stroke={plan.paused ? '#8a6a3a' : '#6b7079'} />
    <rect x={x} y={y} width={w} height={h} rx="14" fill="none" stroke={plan.paused ? AMBER : CYAN} opacity={pulse * 0.5} />
    <text x={x + 28} y={y + 44} fontSize="27" fill={WHITE}>{plan.plan}</text>
    <text x={x + w - 28} y={y + 44} fontFamily={MONO} fontSize="17" fill={MUTED} textAnchor="end">{plan.customer} pays {money(plan.paid)}</text>
    <text x={x + 28} y={y + 92} fontFamily={MONO} fontSize="16" fill={MUTED}>Model cost</text>
    <text x={x + w - 28} y={y + 92} fontFamily={MONO} fontSize="18" fill={WHITE} textAnchor="end">{money(plan.cost)}</text>
    <Bar x={x + 28} y={y + 106} width={inner} value={plan.cost} scale={scale} color={plan.paused ? AMBER : BLUE} cap={plan.cap} paused={plan.paused} pulse={pulse} />
    <text x={x + 28} y={y + h - 22} fontSize="44" letterSpacing="-1.5" fill={plan.paused ? AMBER : GREEN}>{Math.round(plan.margin)}%</text>
    <text x={x + 28 + 96} y={y + h - 27} fontFamily={MONO} fontSize="16" fill={MUTED}>margin</text>
    <text x={x + w - 28} y={y + h - 27} fontFamily={MONO} fontSize="16" fill={plan.paused ? AMBER : MUTED} textAnchor="end">{plan.paused ? 'Cap reached · paused' : 'Requests flowing'}</text>
  </g>;
  return <g fontFamily={SANS}>
    <rect x={x} y={y} width={w} height={h} rx="14" fill="#030405" stroke={plan.paused ? '#8a6a3a' : '#6b7079'} />
    <rect x={x} y={y} width={w} height={h} rx="14" fill="none" stroke={plan.paused ? AMBER : CYAN} opacity={pulse * 0.5} />
    <text x={x + 28} y={y + 48} fontSize="25" fill={WHITE}>{plan.plan}</text>
    <text x={x + w - 28} y={y + 48} fontFamily={MONO} fontSize="14" fill={MUTED} textAnchor="end">{plan.customer}</text>
    <text x={x + 28} y={y + 76} fontFamily={MONO} fontSize="14" fill="#9aa2ae">{plan.detail}</text>
    <path d={`M${x},${y + 96} H${x + w}`} stroke="#2b2f35" />
    <text x={x + 28} y={y + 128} fontFamily={MONO} fontSize="13" fill={MUTED}>Customer pays</text>
    <text x={x + w - 28} y={y + 128} fontFamily={MONO} fontSize="15" fill={WHITE} textAnchor="end">{money(plan.paid)}</text>
    <Bar x={x + 28} y={y + 140} width={inner} value={plan.paid} scale={scale} color="#3d4350" />
    <text x={x + 28} y={y + 186} fontFamily={MONO} fontSize="13" fill={MUTED}>Model cost</text>
    <text x={x + w - 28} y={y + 186} fontFamily={MONO} fontSize="15" fill={WHITE} textAnchor="end">{money(plan.cost)}</text>
    <Bar x={x + 28} y={y + 198} width={inner} value={plan.cost} scale={scale} color={plan.paused ? AMBER : BLUE} cap={plan.cap} paused={plan.paused} pulse={pulse} />
    <text x={x + 28} y={y + h - 34} fontSize="44" fontWeight="400" letterSpacing="-1.5" fill={plan.paused ? AMBER : GREEN}>{Math.round(plan.margin)}%</text>
    <text x={x + 28 + 92} y={y + h - 38} fontFamily={MONO} fontSize="13" fill={MUTED}>margin</text>
    <text x={x + w - 28} y={y + h - 38} fontFamily={MONO} fontSize="13" fill={plan.paused ? AMBER : MUTED} textAnchor="end">{plan.paused ? 'Cap reached · paused' : 'Requests flowing'}</text>
  </g>;
}

function Definitions({prefix}) {
  return <defs>
    <pattern id={`${prefix}-dots`} width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#596372" opacity="0.35" />
    </pattern>
    <radialGradient id={`${prefix}-fade`}>
      <stop offset="0" stopColor="white" stopOpacity="1" />
      <stop offset="1" stopColor="white" stopOpacity="0" />
    </radialGradient>
    <mask id={`${prefix}-dots-mask`}>
      <ellipse cx="50%" cy="35%" rx="60%" ry="70%" fill={`url(#${prefix}-fade)`} />
    </mask>
    <filter id={`${prefix}-glow`} x="-100%" y="-200%" width="300%" height="500%">
      <feGaussianBlur stdDeviation="3.5" />
    </filter>
    <filter id={`${prefix}-bloom`} x="-60%" y="-150%" width="220%" height="400%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
  </defs>;
}

/** Deterministic SVG for the hero: requests pass the gateway and land in three plan cards that track price, model cost, and margin. */
export default function MonetizeScene({elapsed = 0, logoHref = '/img/brand/litellm-logo-white.png', compact = false, idPrefix = 'monetize', className, style}) {
  const state = getMonetizeState(elapsed);
  const layout = compact ? COMPACT : WIDE;
  const prefix = idPrefix;
  const [gx, gy] = layout.gateway;
  return <svg xmlns="http://www.w3.org/2000/svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Illustrative agent requests pass through LiteLLM into three plans: prepaid credits, per seat, and usage-based. Each plan shows what the customer pays, the model cost so far, and the margin. The prepaid customer reaches its $60 cap and its requests pause." className={className} style={style}>
    <Definitions prefix={prefix} />
    <rect width="100%" height="100%" fill="#020304" />
    <rect width="100%" height="100%" fill={`url(#${prefix}-dots)`} mask={`url(#${prefix}-dots-mask)`} />
    <g fill="none" stroke="#c5cad3" strokeWidth="0.7" opacity="0.4">
      {Array.from({length: 13}, (_, lane) => <path key={lane} d={curvePath(layout.incoming(lane))} />)}
      {[0, 1, 2].map(column => <path key={column} d={curvePath(layout.outgoing(column))} />)}
    </g>
    {!compact && <text x="40" y="214" fontFamily={MONO} fontSize="15" fill="#a9b1be">Agent requests</text>}
    <ellipse cx={gx} cy={gy} rx={compact ? 130 : 150} ry="36" fill={BLUE} opacity={0.04 + state.gatewayPulse * 0.2} filter={`url(#${prefix}-bloom)`} />
    <rect x={gx - 128} y={gy - 34} width="256" height="68" rx="10" fill="#05070a" stroke="#4a5160" />
    <image href={logoHref} x={gx - 104} y={gy - 18} width="208" height="36" preserveAspectRatio="xMidYMid meet" />
    <text x={gx} y={gy + 62} fontFamily={MONO} fontSize="14" textAnchor="middle" fill="#a6aebc">Meters cost · Enforces caps</text>
    <Traffic state={state} layout={layout} prefix={prefix} />
    {state.plans.map((plan, index) => <PlanCard key={plan.plan} card={layout.cards[index]} plan={plan} pulse={state.pulses[index]} compact={compact} />)}
    <text x={compact ? 60 : 100} y={layout.height - 12} fontFamily={MONO} fontSize="12" fill="#6f7886">Illustrative customers and amounts · margin before other expenses</text>
  </svg>;
}
