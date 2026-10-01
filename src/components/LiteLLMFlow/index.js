import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {GATEWAY_COMPOSE, PROMPTS} from '../Conversion/content';
import {IconAgent, IconCheck} from '../Conversion/icons';
import {track, useCopy} from '../Conversion/shared';
import styles from './styles.module.css';

// The /docs/ hero: who calls LiteLLM on the left, the LiteLLM monogram in the
// middle, and what it reaches on the right (model APIs, MCP tools, A2A
// agents). Plain HTML and SVG, so it renders without an image download and
// reads the same in light and dark mode. The connecting lines are measured
// after layout, so they follow the boxes at any width.

const Line = ({d}) => <path d={d} />;

function Icon({children}) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const CALLERS = [
  ['Developer', <Icon key="d"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /></Icon>],
  ['Coding agent', <Icon key="c"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></Icon>],
  ['Your app', <Icon key="a"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" /></Icon>],
];

const AGENT_ICON = (
  <Icon>
    <rect x="5" y="8" width="14" height="11" rx="3" />
    <path d="M12 4v4M9 13h.01M15 13h.01" />
  </Icon>
);

// Logos are the vendors' files already in static/img/integrations
const GROUPS = [
  {
    label: 'LLM APIs',
    items: [['OpenAI', 'openai.svg', true], ['Anthropic', 'anthropic.svg', true], ['Gemini', 'gemini.svg'], ['Amazon Bedrock', 'aws.svg', true]],
    more: ['+100', '/docs/providers'],
  },
  {label: 'MCP tools', items: [['GitHub', 'github.png', true], ['Slack', 'slack.svg']], more: ['any MCP', '/docs/mcp']},
  {label: 'A2A agents', items: [['LangChain', 'langchain.png'], ['Letta', 'letta.svg', true], ['Your agent', null]], more: ['any A2A', '/docs/a2a']},
];

// A soft S-curve whose control points sit far out, so lines bend gently
function curve(x1, y1, x2, y2) {
  const k = Math.max(28, (x2 - x1) * 0.55);
  return `M${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`;
}

export default function LiteLLMFlow() {
  const ref = useRef(null);
  const [lines, setLines] = useState({w: 0, h: 0, d: []});
  const [copied, copy] = useCopy();
  const [hubCopied, copyHub] = useCopy(2200);
  const integration = useBaseUrl('/img/integrations/');
  const monoBlue = useBaseUrl('/img/brand/litellm-monogram-blue.svg');
  const monoWhite = useBaseUrl('/img/brand/litellm-monogram-white.svg');

  useEffect(() => {
    const fig = ref.current;
    if (!fig) return undefined;
    const draw = () => {
      const R = fig.getBoundingClientRect();
      const hub = fig.querySelector('[data-hub]').getBoundingClientRect();
      const cy = hub.top + hub.height / 2 - R.top;
      const hl = hub.left - R.left;
      const hr = hub.right - R.left;
      const d = [];
      fig.querySelectorAll('[data-caller]').forEach((n) => {
        const b = n.getBoundingClientRect();
        if (!b.width) return;
        d.push(curve(b.right - R.left, b.top + b.height / 2 - R.top, hl, cy));
      });
      fig.querySelectorAll('[data-dest]').forEach((n) => {
        const b = n.getBoundingClientRect();
        if (!b.width) return;
        d.push(curve(hr, cy, b.left - R.left - 6, b.top + b.height / 2 - R.top));
      });
      setLines({w: R.width, h: R.height, d});
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(fig);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <figure
        ref={ref}
        className={styles.flow}
        aria-label="Developers, coding agents, and apps call LiteLLM, which reaches 100+ LLM APIs, MCP tools, and A2A agents.">
        <svg className={styles.lines} width={lines.w} height={lines.h} viewBox={`0 0 ${lines.w || 1} ${lines.h || 1}`} aria-hidden="true">
          {lines.d.map((d, i) => (
            <Line key={i} d={d} />
          ))}
        </svg>

        <div className={styles.callers}>
          <span className={styles.label}>Who calls</span>
          {CALLERS.map(([label, icon]) => (
            <div key={label} className={styles.caller} data-caller="">
              <span className={styles.icon}>{icon}</span>
              {label}
            </div>
          ))}
        </div>

        <div className={styles.hubWrap}>
          {/* Clicking the logo copies the three commands that start the gateway */}
          <button
            type="button"
            className={styles.hub}
            data-hub=""
            title="Copy the command that starts the LiteLLM Gateway"
            aria-label={hubCopied ? 'Start command copied' : 'Copy the command that starts the LiteLLM Gateway'}
            onClick={() => {
              copyHub(GATEWAY_COMPOSE);
              track('docs_install_copied', {kind: 'gateway', source: 'docs-index-figure'});
            }}>
            <img className={styles.monoLight} src={monoBlue} alt="" width="52" height="52" />
            <img className={styles.monoDark} src={monoWhite} alt="" width="52" height="52" />
            <span className={styles.hubName}>LiteLLM</span>
            <span className={hubCopied ? `${styles.hubHint} ${styles.hubHintOn}` : styles.hubHint} aria-live="polite">
              {hubCopied ? 'Start command copied' : 'Click to copy start command'}
            </span>
          </button>
        </div>

        <div className={styles.dests}>
          {GROUPS.map((g) => (
            <div key={g.label} className={styles.group}>
              <span className={styles.label}>{g.label}</span>
              <div className={styles.row} data-dest="">
                {g.items.map(([name, file, invertDark]) => (
                  <span key={name} className={styles.icon} title={name}>
                    {file ? (
                      <img src={integration + file} alt={name} width="15" height="15" className={invertDark ? styles.invertDark : undefined} />
                    ) : (
                      AGENT_ICON
                    )}
                  </span>
                ))}
                <Link className={styles.more} to={g.more[1]}>
                  {g.more[0]}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </figure>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.promptBtn}
          onClick={() => {
            copy(PROMPTS.gateway.text);
            track('docs_agent_prompt_copied', {prompt: 'gateway', source: 'docs-index-figure'});
          }}>
          {copied ? <IconCheck size={13} /> : <IconAgent size={13} />}
          {copied ? 'Copied' : 'Copy agent prompt'}
        </button>
      </div>
    </>
  );
}
