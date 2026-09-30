import React, {useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import PromptButton from './PromptButton';
import {INSTALLS} from './content';
import {IconCheck, IconCopy} from './icons';
import {track, useCopy} from './shared';
import styles from './heroterminal.module.css';

// The docs home's first action: a terminal holding the one command that
// starts the gateway, or the one that installs the SDK, ready to copy. The
// agent prompt for the same step sits under it. Lines never wrap, so the box
// stays three lines tall; long lines scroll sideways.

const TABS = [
  {id: 'gateway', label: 'Start the Gateway', more: 'More ways to run', to: '/docs/proxy/docker_quick_start'},
  {id: 'sdk', label: 'Install the SDK', more: 'More ways to install', to: '/docs/#installation'},
];

export default function HeroTerminal({source = 'docs-home-hero'}) {
  const [tab, setTab] = useState('gateway');
  const [copied, copy] = useCopy();
  const current = TABS.find((t) => t.id === tab);
  const code = INSTALLS[tab].options[0].code;

  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`hero-tab-${next.id}`)?.focus();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.term}>
        <div className={styles.bar}>
          <div role="tablist" aria-label="Get started" className={styles.tabs}>
            {TABS.map((t, i) => (
              <button
                key={t.id}
                id={`hero-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="hero-terminal-code"
                tabIndex={tab === t.id ? 0 : -1}
                className={clsx(styles.tab, tab === t.id && styles.tabOn)}
                onClick={() => {
                  setTab(t.id);
                  track('docs_hero_tab', {tab: t.id, source});
                }}
                onKeyDown={(e) => onKey(e, i)}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.copy}
            aria-label={copied ? 'Copied' : `Copy the ${current.label.toLowerCase()} command`}
            onClick={() => {
              copy(code);
              track('docs_install_copied', {kind: tab, source});
            }}>
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre id="hero-terminal-code" role="tabpanel" aria-labelledby={`hero-tab-${tab}`} className={styles.code} tabIndex={0}>
          {code.split('\n').map((line, i) => (
            <span key={i} className={styles.line}>
              <span className={styles.ps} aria-hidden="true">
                $
              </span>
              {line}
            </span>
          ))}
        </pre>
      </div>
      <div className={styles.under}>
        <PromptButton id={tab} source={`${source}-${tab}`} size="md" />
        <Link className={styles.more} to={current.to} onClick={() => track('docs_hero_more', {tab, source})}>
          {current.more} →
        </Link>
      </div>
    </div>
  );
}
