import React from 'react';

export const LOOP_SECONDS = 12;
export const REQUEST_COST = 0.5;
export const ARRIVAL_TIMES = Array.from({length: 20}, (_, index) => 1 + index * 0.5);

const WHITE = '#f4f5f7';
const MUTED = '#8a8d93';
const BLUE = '#174bff';
const CYAN = '#69d5f4';
const MONO = '"Geist Mono", "SFMono-Regular", Consolas, monospace';
const SANS = 'Geist, Arial, Helvetica, sans-serif';
const SCOPES = [
  {label: 'Customer organization', name: 'Acme', spend: 750, cap: 1000},
  {label: 'Customer team', name: 'Support', spend: 192, cap: 250},
  {label: 'Customer member', name: 'Alice', spend: 39, cap: 50},
];

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
};

export function getSceneState(elapsed = 0) {
  const time = ((elapsed % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const arrived = ARRIVAL_TIMES.filter(arrival => time >= arrival).length;
  const accounted = ARRIVAL_TIMES.reduce((sum, arrival) => sum + ease((time - arrival) / 0.22), 0);
  const pulse = ARRIVAL_TIMES.reduce((peak, arrival) => time < arrival ? peak : Math.max(peak, 1 - (time - arrival) / 0.34), 0);
  const gatewayPulse = ARRIVAL_TIMES.reduce((peak, arrival) => Math.max(peak, 1 - Math.abs(time - (arrival - 1.75)) / 0.28), 0);
  return {
    time,
    arrived,
    pulse: clamp(pulse),
    gatewayPulse: clamp(gatewayPulse),
    scopes: SCOPES.map(scope => ({...scope, spend: scope.spend + accounted * REQUEST_COST})),
  };
}

function pointOnCurve(points, progress) {
  const t = clamp(progress);
  const u = 1 - t;
  const [a, b, c, d] = points;
  const x = u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0];
  const y = u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1];
  const dx = 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0]);
  const dy = 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1]);
  return {x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI};
}

const curvePath = points => `M${points[0].join(',')} C${points[1].join(',')} ${points[2].join(',')} ${points[3].join(',')}`;
const incomingCurve = lane => [[-70, 315 + lane * 22], [270, 330 + lane * 22], [368, 588 + (lane - 13) * 2.4], [540, 588 + (lane - 13) * 2.4]];
const outgoingCurve = (scope, lane = 2) => [[846, 588 + (scope - 1) * 14 + (lane - 2) * 3], [1030, 588 + (scope - 1) * 14], [1040, 488 + scope * 155 + lane * 8], [1235, 488 + scope * 155 + lane * 8]];
const compactIncomingCurve = lane => {
  const x = 72 + lane * 96;
  const destination = 336 + lane * 8;
  return [[x, 255], [x, 290], [destination, 290], [destination, 307]];
};
const compactOutgoingCurve = [[360, 425], [360, 442], [360, 458], [360, 475]];

function Packet({curve, progress, color = CYAN, glowId, opacity = 1, trail = 0.13}) {
  const {x, y, angle} = pointOnCurve(curve, progress);
  const trailPoints = Array.from({length: 8}, (_, index) => pointOnCurve(curve, Math.max(0, progress - trail * (1 - index / 7))));
  return <g opacity={opacity}>
    {trailPoints.slice(1).map((point, index) => <path key={index} d={`M${trailPoints[index].x},${trailPoints[index].y} L${point.x},${point.y}`} stroke={color} strokeWidth={1 + index / 8} opacity={0.05 + index * 0.065} fill="none" />)}
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect x="-15" y="-5" width="30" height="10" fill={color} opacity="0.28" filter={`url(#${glowId})`} />
    <rect x="-10" y="-2.5" width="20" height="5" rx="0.5" fill={color} />
    </g>
  </g>;
}

function DesktopTraffic({state, prefix}) {
  const requests = [...ARRIVAL_TIMES, ...ARRIVAL_TIMES.map(arrival => arrival + LOOP_SECONDS)];
  return <g>
    {Array.from({length: 18}, (_, index) => {
      const progress = (state.time / 3 + index / 18) % 1;
      return <Packet key={`ambient-${index}`} curve={incomingCurve((index * 5) % 27)} progress={progress} color="#718bb5" opacity={Math.sin(progress * Math.PI) * 0.38} trail={0.08} glowId={`${prefix}-glow`} />;
    })}
    {requests.map((arrival, index) => {
      const progress = state.time - (arrival - 3.6);
      if (progress < 0 || progress > 3.6) return null;
      if (progress < 1.85) return <Packet key={arrival} curve={incomingCurve((index * 7 + 2) % 27)} progress={progress / 1.85} color={index % 3 ? CYAN : BLUE} glowId={`${prefix}-glow`} />;
      if (progress < 2.05) return null;
      return <Packet key={arrival} curve={outgoingCurve(index % 3, index % 5)} progress={(progress - 2.05) / 1.55} color={index % 3 ? CYAN : '#4977ff'} glowId={`${prefix}-glow`} />;
    })}
  </g>;
}

function Meter({x, y, width, spend, cap, pulse}) {
  const count = 40;
  const step = width / count;
  return <g>
    {Array.from({length: count}, (_, index) => <rect
      key={index}
      x={x + index * step}
      y={y}
      width={step * 0.55}
      height="17"
      fill={index / count < spend / cap ? `rgb(${Math.round(23 + index / count * 82)}, ${Math.round(75 + index / count * 138)}, ${Math.round(255 - index / count * 11)})` : '#27292d'}
    />)}
    {pulse > 0 && <rect x={x} y={y - 4} width={width * Math.min(spend / cap, 1)} height="25" fill={CYAN} opacity={pulse * 0.1} />}
  </g>;
}

function Portal({state, compact = false}) {
  const x = compact ? 38 : 1235;
  const y = compact ? 475 : 335;
  const width = compact ? 644 : 620;
  const rowHeight = compact ? 151 : 155;
  const labelX = x + 34;
  const firstRowY = y + 190;
  return <g fontFamily={SANS}>
    <rect x={x} y={y} width={width} height="650" rx="18" fill="#030405" stroke="#8c919a" strokeWidth="1" />
    <rect x={x} y={y} width={width} height="650" rx="18" fill="none" stroke={CYAN} opacity={state.pulse * 0.45} />
    {[0, 1, 2].map(index => <circle key={index} cx={x + 27 + index * 18} cy={y + 21} r="4.5" fill="#8b8e94" />)}
    <path d={`M${x},${y + 43} H${x + width}`} stroke="#666a72" strokeWidth="0.8" />
    <text x={x + 26} y={y + 90} fontSize="30" fill={WHITE}>Your customer portal</text>
    <text x={x + width - 170} y={y + 132} fontFamily={MONO} fontSize="14" fill={MUTED} textAnchor="end">Usage charges</text>
    <text x={x + width - 25} y={y + 132} fontFamily={MONO} fontSize="14" fill={MUTED} textAnchor="end">Budget</text>
    <path d={`M${x},${y + 148} H${x + width}`} stroke="#35383f" strokeWidth="0.8" />
    {state.scopes.map((scope, index) => {
      const rowY = firstRowY + index * rowHeight;
      const indent = index * 18;
      return <g key={scope.name}>
        {index > 0 && <path d={`M${labelX + indent - 14},${rowY - 98} V${rowY - 8} H${labelX + indent + 2}`} fill="none" stroke="#676d77" strokeWidth="1" />}
        <rect x={labelX + indent} y={rowY - 20} width="5" height="27" fill={index === 2 ? CYAN : BLUE} />
        <text x={labelX + 20 + indent} y={rowY} fontSize={compact ? 26 : 23} fontWeight="560" fill={WHITE}>{scope.label}</text>
        <text x={labelX + 20 + indent} y={rowY + 29} fontSize={compact ? 26 : 23} fill="#b7bbc2">{scope.name}</text>
        <text x={x + width - 170} y={rowY + 29} fontSize={compact ? 28 : 24} fontFamily={MONO} fill={WHITE} textAnchor="end">${scope.spend.toFixed(2)}</text>
        <text x={x + width - 25} y={rowY + 29} fontSize={compact ? 27 : 22} fontFamily={MONO} fill="#bdc1c8" textAnchor="end">${scope.cap.toLocaleString('en-US')}</text>
        <Meter x={labelX + 20 + indent} y={rowY + 52} width={width - 96 - indent} spend={scope.spend} cap={scope.cap} pulse={state.pulse} />
      </g>;
    })}
    <text x={x + 26} y={y + 622} fontFamily={MONO} fontSize="13" fill="#777e89">Same request. Three levels of attribution.</text>
  </g>;
}

function SceneDefinitions({prefix}) {
  return <defs>
    <radialGradient id={`${prefix}-field`}>
      <stop offset="0" stopColor="white" stopOpacity="0.9" />
      <stop offset="1" stopColor="white" stopOpacity="0" />
    </radialGradient>
    <pattern id={`${prefix}-pixels`} width="224" height="224" patternUnits="userSpaceOnUse">
      {Array.from({length: 196}, (_, index) => {
        const hash = (index * 73 + 31) % 97;
        if (hash > 35) return null;
        return <rect key={index} x={(index % 14) * 16} y={Math.floor(index / 14) * 16} width={hash < 9 ? 5 : 2} height={hash < 9 ? 5 : 2} fill="#51565e" opacity={0.2 + hash / 100} />;
      })}
    </pattern>
    <mask id={`${prefix}-pixel-mask`}>
      <ellipse cx="320" cy="730" rx="530" ry="410" fill={`url(#${prefix}-field)`} />
      <ellipse cx="1630" cy="240" rx="460" ry="400" fill={`url(#${prefix}-field)`} />
      <ellipse cx="1100" cy="1020" rx="700" ry="260" fill={`url(#${prefix}-field)`} />
    </mask>
    <filter id={`${prefix}-glow`} x="-100%" y="-200%" width="300%" height="500%">
      <feGaussianBlur stdDeviation="4" />
    </filter>
    <filter id={`${prefix}-gateway-bloom`} x="-60%" y="-150%" width="220%" height="400%">
      <feGaussianBlur stdDeviation="20" />
    </filter>
  </defs>;
}

/** A deterministic SVG shared by the live hero and exported animation. */
export default function CustomerPortalScene({elapsed = 0, logoHref = '/img/brand/litellm-logo-white.png', showTitle = true, compact = false, idPrefix = 'customer-portal', className, style}) {
  const state = getSceneState(elapsed);
  const prefix = idPrefix;
  return <svg xmlns="http://www.w3.org/2000/svg" width={compact ? 720 : 1920} height={compact ? 1180 : 1080} viewBox={compact ? '0 0 720 1180' : '0 0 1920 1080'} role="img" aria-label="Agent requests flow through LiteLLM into a customer portal. Each highlighted illustrative request adds 50 cents to Acme, Support, and Alice's views of the same usage, against their own budgets." className={className} style={style}>
    <SceneDefinitions prefix={prefix} />
    <rect width="100%" height="100%" fill="#020304" />
    <rect width="100%" height="100%" fill={`url(#${prefix}-pixels)`} mask={`url(#${prefix}-pixel-mask)`} opacity="0.72" />
    {!compact && <g stroke="#383e47" strokeWidth="0.7" opacity="0.5">
      {[72, 520, 1235, 1855].map(x => <path key={x} d={`M${x},0 V1180`} />)}
      {[80, 277, 1015].map(y => <path key={y} d={`M0,${y} H1920`} strokeDasharray="3 8" />)}
    </g>}
    {showTitle && <g fontFamily={SANS} fill={WHITE} textAnchor="middle">
      <text x={compact ? 360 : 960} y={compact ? 55 : 65} fontSize={compact ? 13 : 15} fontFamily={MONO} fill="#a9b1be" letterSpacing="2">LITELLM AI GATEWAY</text>
      <text x={compact ? 360 : 960} y={compact ? 135 : 196} fontSize={compact ? 74 : 132} fontWeight="350" letterSpacing={compact ? '-3' : '-6'}>Customer Portal</text>
      <text x={compact ? 360 : 960} y={compact ? 183 : 255} fontSize={compact ? 23 : 31} fontWeight="350" fill="#aeb7c6">Budget and charge your agent’s customers.</text>
    </g>}
    {compact ? <g>
      <g fill="none" stroke="#cbd0d9" strokeWidth="0.8" opacity="0.65">
        {Array.from({length: 7}, (_, index) => <path key={index} d={curvePath(compactIncomingCurve(index))} />)}
        <path d={curvePath(compactOutgoingCurve)} />
      </g>
      <rect x="240" y="307" width="245" height="65" fill="#020304" />
      <ellipse cx="360" cy="340" rx="135" ry="35" fill={BLUE} opacity={state.gatewayPulse * 0.19} filter={`url(#${prefix}-gateway-bloom)`} />
      <image href={logoHref} x="247" y="318" width="225" height="42" preserveAspectRatio="xMidYMid meet" />
      <text x="360" y="401" fontFamily={MONO} fontSize="15" textAnchor="middle" fill="#a6aebc">Meter cost · Apply budgets</text>
      <text x="390" y="455" fontFamily={MONO} fontSize="15" fill={WHITE}>Usage API</text>
      {[...ARRIVAL_TIMES, ...ARRIVAL_TIMES.map(arrival => arrival + LOOP_SECONDS)].map((arrival, index) => {
        const age = state.time - (arrival - 3.6);
        if (age < 0 || age > 3.6 || (age >= 1.85 && age < 2.05)) return null;
        const curve = age < 1.85 ? compactIncomingCurve(index % 7) : compactOutgoingCurve;
        return <Packet key={arrival} curve={curve} progress={age < 1.85 ? age / 1.85 : (age - 2.05) / 1.55} color={index % 2 ? CYAN : BLUE} glowId={`${prefix}-glow`} />;
      })}
      <Portal state={state} compact />
    </g> : <g>
      <g fill="none" stroke="#d8dce4" strokeWidth="0.85" opacity="0.66">
        {Array.from({length: 27}, (_, lane) => <path key={lane} d={curvePath(incomingCurve(lane))} />)}
        {[0, 1, 2].flatMap(scope => Array.from({length: 5}, (_, lane) => <path key={`${scope}-${lane}`} d={curvePath(outgoingCurve(scope, lane))} />))}
      </g>
      <rect x="53" y="565" width="235" height="42" fill="#020304" />
      <text x="65" y="594" fill={WHITE} fontFamily={MONO} fontSize="24">Agent traffic</text>
      <rect x="529" y="548" width="334" height="88" fill="#020304" />
      <ellipse cx="695" cy="588" rx="190" ry="44" fill={BLUE} opacity={0.025 + state.gatewayPulse * 0.18} filter={`url(#${prefix}-gateway-bloom)`} />
      <image href={logoHref} x="540" y="558" width="310" height="58" preserveAspectRatio="xMidYMid meet" />
      <text x="695" y="676" textAnchor="middle" fontFamily={SANS} fill={WHITE} fontSize="31">AI Gateway</text>
      <text x="695" y="713" textAnchor="middle" fontFamily={MONO} fill="#b6beca" fontSize="18">Meter cost · Apply budgets</text>
      <rect x="979" y="566" width="221" height="45" fill="#020304" />
      <text x="995" y="598" fill={WHITE} fontFamily={MONO} fontSize="25">{'{ }'} Usage API</text>
      <text x="1263" y="307" fontFamily={MONO} fill="#b8bfca" fontSize="21">Customer Portal</text>
      <DesktopTraffic state={state} prefix={prefix} />
      <Portal state={state} />
      {state.pulse > 0 && <text x="1154" y="850" fontFamily={MONO} textAnchor="middle" fontSize="19" fill={CYAN} opacity={state.pulse}>+$0.50</text>}
    </g>}
    <text x={compact ? 38 : 88} y={compact ? 1160 : 1050} fontFamily={MONO} fontSize={compact ? 11 : 13} fill="#737e90">Illustrative customer traffic · $0.50 per highlighted request</text>
  </svg>;
}
