import React, {useEffect, useId, useState} from 'react';
import styles from './styles.module.css';

// Columns: app 20-200, LiteLLM 290-470, provider 560-740. Packets travel on two
// lanes between the boxes: requests to the right, events back to the left.
const APP_EDGE = 200;
const PROVIDER_EDGE = 560;
const PROXY_LEFT = 290;
const PROXY_RIGHT = 470;
const RIGHT_LANE = 112;
const LEFT_LANE = 168;

const STEPS = [
  {
    title: 'Connect',
    lines: [
      'Your app opens a WebSocket to LiteLLM with a LiteLLM key.',
      'LiteLLM checks the key and selects a deployment.',
      'LiteLLM opens a WebSocket to the provider with the provider key.',
    ],
    note: 'Checks key, selects deployment',
    packets: [
      {label: 'LiteLLM key', from: APP_EDGE, to: PROXY_LEFT, dir: 'right'},
      {label: 'provider key', from: PROXY_RIGHT, to: PROVIDER_EDGE, dir: 'right', delay: 1.2},
    ],
  },
  {
    title: 'Set the language',
    lines: [
      'Your app sends session.update with the target language.',
      'The model sends session.updated when it is ready.',
    ],
    packets: [
      {label: 'language: fr', from: APP_EDGE, to: PROVIDER_EDGE, dir: 'right'},
      {label: 'session.updated', from: PROVIDER_EDGE, to: APP_EDGE, dir: 'left', delay: 1.6},
    ],
  },
  {
    title: 'Stream audio',
    lines: [
      'Your app sends English audio in small chunks.',
      'The model sends French audio and French text back.',
      'Both directions run at the same time. The translation stays a short time behind the speaker.',
    ],
    packets: [0, 1, 2, 3].flatMap((i) => [
      {label: '♪ EN', from: APP_EDGE, to: PROVIDER_EDGE, dir: 'right', delay: i * 0.8, loop: true},
      {label: '♪ FR', from: PROVIDER_EDGE, to: APP_EDGE, dir: 'left', delay: 1.4 + i * 0.8, loop: true},
    ]),
  },
  {
    title: 'Close and bill',
    lines: [
      'Your app sends session.close.',
      'The model sends session.closed with the seconds of audio it got.',
      'LiteLLM adds the cost to the key, team, and user spend.',
    ],
    note: '42 s × $0.000567 = $0.024',
    packets: [
      {label: 'session.close', from: APP_EDGE, to: PROVIDER_EDGE, dir: 'right'},
      {label: 'usage: 42 s', from: PROVIDER_EDGE, to: APP_EDGE, dir: 'left', delay: 1.6},
    ],
  },
];

const STEP_MS = 5600;

function Packet({label, from, to, dir, delay = 0, loop = false}) {
  const width = Math.max(64, label.length * 8 + 20);
  const y = dir === 'right' ? RIGHT_LANE : LEFT_LANE;
  const start = dir === 'right' ? from : from - width;
  const end = dir === 'right' ? to - width : to;
  return (
    <g
      className={`${styles.packet} ${loop ? styles.loop : ''}`}
      style={{'--start': `${start}px`, '--end': `${end}px`, animationDelay: `${delay}s`}}
    >
      <rect x="0" y={y - 13} width={width} height="26" rx="13" className={dir === 'right' ? styles.packetOut : styles.packetIn} />
      <text x={width / 2} y={y + 5} textAnchor="middle" className={styles.packetText}>{label}</text>
    </g>
  );
}

function Box({x, title, subtitle, highlight}) {
  return (
    <g>
      <rect x={x} y="72" width="180" height="136" rx="14" className={highlight ? styles.proxy : styles.card} />
      <text x={x + 90} y="58" textAnchor="middle" className={styles.title}>{title}</text>
      <text x={x + 90} y="232" textAnchor="middle" className={styles.subtitle}>{subtitle}</text>
    </g>
  );
}

export default function RealtimeTranslationFlow() {
  const id = useId().replace(/:/g, '');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, playing]);

  const current = STEPS[step];

  return (
    <figure className={styles.figure}>
      <div className={styles.tabs} role="tablist" aria-label="Steps of a translation session">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === step}
            className={i === step ? styles.tabActive : styles.tab}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
          >
            <span className={styles.tabNumber}>{i + 1}</span>
            {s.title}
          </button>
        ))}
        <button type="button" className={styles.play} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <div className={styles.viewport}>
        <svg className={styles.diagram} viewBox="0 0 760 250" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
          <title id={`${id}-title`}>Realtime translation through LiteLLM, step {step + 1}: {current.title}</title>
          <desc id={`${id}-desc`}>{current.lines.join(' ')}</desc>

          <path d={`M ${APP_EDGE} ${RIGHT_LANE} H ${PROVIDER_EDGE}`} className={styles.lane} />
          <path d={`M ${APP_EDGE} ${LEFT_LANE} H ${PROVIDER_EDGE}`} className={styles.lane} />

          <Box x={20} title="Your app" subtitle="mic, file, or call" />
          <Box x={290} title="LiteLLM proxy" subtitle={current.note || 'relays every event'} highlight />
          <Box x={560} title="OpenAI / Azure" subtitle="gpt-realtime-translate" />

          <text x="110" y="135" textAnchor="middle" className={styles.boxIcon}>Sends: English</text>
          <text x="110" y="158" textAnchor="middle" className={styles.boxIcon}>Gets: French</text>
          <text x="650" y="145" textAnchor="middle" className={styles.boxIcon}>EN → FR</text>

          <g key={step}>
            {current.packets.map((p, i) => (
              <Packet key={i} {...p} />
            ))}
          </g>
        </svg>
      </div>
      <ul className={styles.caption} aria-live="polite">
        {current.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </figure>
  );
}
