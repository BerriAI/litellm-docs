import React, {useId, useState} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {INSTALLS, ONE_CLICK} from './content';
import Command from './Command';
import {track} from './shared';
import styles from './styles.module.css';

// Hidden when it would point back at the page the box is on (the quickstart's
// own install box linked to itself).
function MoreLink({to, label}) {
  const {pathname} = useLocation();
  const strip = (p) => p.split('#')[0].replace(/\/$/, '');
  if (!to || (!/^https?:/.test(to) && strip(to) === strip(pathname))) return null;
  const external = /^https?:/.test(to);
  return (
    <Link to={to} className={styles.installMore} {...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>
      {label || 'Full guide'}
    </Link>
  );
}

// One recommended command, what it gives you, and the alternatives folded
// away with a line on when each is the better pick. Agent prompts live in
// their own <AgentPrompt> box, never in here.
export default function InstallBox({variant = 'gateway', title}) {
  const config = INSTALLS[variant];
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (!config) return null;
  const [primary, ...others] = config.options;

  return (
    <div className={styles.install}>
      <div className={styles.installHead}>
        <span className={styles.installTitle}>{title || config.title}</span>
      </div>
      <div className={styles.installPanel}>
        <Command code={primary.code} id={`${variant}:${primary.id}`} />
        <p className={styles.installWhat}>
          {config.what} <MoreLink to={primary.more} label={primary.moreLabel} />
        </p>
      </div>

      {others.length > 0 && (
        <div className={styles.installOthers}>
          <button
            type="button"
            className={styles.installOthersToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => {
              if (!open) track('docs_install_others_opened', {variant});
              setOpen((v) => !v);
            }}>
            Other ways to install <span className={styles.installOthersList}>{others.map((o) => o.label).join(', ')}</span>
          </button>
          {open && (
            <div id={bodyId} className={styles.installOthersBody}>
              {others.map((o) => (
                <div key={o.id} className={styles.installAlt}>
                  <p className={styles.installAltHead}>
                    <strong>{o.label}</strong>
                    {o.when && <span>{o.when}</span>}
                  </p>
                  <Command code={o.code} id={`${variant}:${o.id}`} small />
                  <MoreLink to={o.more} label={o.moreLabel} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          .
        </p>
      )}
    </div>
  );
}
