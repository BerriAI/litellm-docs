import React, {useId, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {INSTALLS, ONE_CLICK} from './content';
import AgentPrompt from './AgentPrompt';
import Command from './Command';
import {track} from './shared';
import styles from './styles.module.css';

// Tabbed install panel: every tab is one way to get the same thing running.
// The first tab is the recommended path; a coding-agent tab is always offered.
export default function InstallBox({variant = 'gateway', title, initial}) {
  const tabs = INSTALLS[variant] || [];
  const [active, setActive] = useState(initial || tabs[0]?.id);
  const baseId = useId();
  const tabRefs = useRef([]);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  if (!tab) return null;

  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const isExternal = tab.more && /^https?:/.test(tab.more);

  return (
    <div className={styles.install}>
      <div className={styles.installBar}>
        {title && <span className={styles.installTitle}>{title}</span>}
        <div className={styles.installTabs} role="tablist" aria-label={title || 'Install options'}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[i] = el)}
              role="tab"
              type="button"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={t.id === tab.id}
              aria-controls={`${baseId}-panel`}
              tabIndex={t.id === tab.id ? 0 : -1}
              className={clsx(styles.installTab, t.id === tab.id && styles.installTabActive)}
              onClick={() => {
                setActive(t.id);
                track('docs_install_tab', {variant, tab: t.id});
              }}
              onKeyDown={(e) => onKey(e, i)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab.id}`}
        className={styles.installPanel}>
        {tab.prompt ? (
          <div className={styles.installPrompt}>
            <AgentPrompt id={tab.prompt} compact />
          </div>
        ) : (
          <>
            <Command code={tab.code} note={tab.note} id={`${variant}:${tab.id}`} />
            {tab.more && (
              <div className={styles.installFoot}>
                <Link
                  to={tab.more}
                  {...(isExternal ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>
                  {tab.moreLabel || 'Full guide'}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      {variant === 'gateway' && (
        <p className={styles.mobileHint}>
          On a phone? Deploy the gateway in one click on{' '}
          {ONE_CLICK.map(([name, url], i) => (
            <React.Fragment key={name}>
              {i > 0 && ' or '}
              <a href={url} target="_blank" rel="nofollow noopener" onClick={() => track('docs_one_click_deploy', {provider: name})}>
                {name}
              </a>
            </React.Fragment>
          ))}
          , or copy the coding agent prompt for later.
        </p>
      )}
    </div>
  );
}
