import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import SalesButton from './SalesButton';
import {ICONS} from './icons';
import styles from './styles.module.css';

// Outcome tiles: a drawn icon, a short claim, one supporting line, and an
// optional link to the doc that backs the claim.
export function Tiles({items, columns = 3, size = 'md'}) {
  return (
    <div className={clsx(styles.tiles, size === 'lg' && styles.tilesLg)} style={{'--cv-cols': columns}}>
      {items.map(({icon, title, text, to}) => {
        const Icon = ICONS[icon];
        const inner = (
          <>
            {Icon && (
              <span className={styles.tileIcon}>
                <Icon size={size === 'lg' ? 34 : 26} />
              </span>
            )}
            <span className={styles.tileTitle}>{title}</span>
            {text && <span className={styles.tileText}>{text}</span>}
          </>
        );
        return to ? (
          <Link key={title} to={to} className={clsx(styles.tile, styles.tileLink)}>
            {inner}
          </Link>
        ) : (
          <div key={title} className={styles.tile}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// Closing call to action for enterprise-minded readers.
export function SalesBand({title, text, source = 'docs', trial = true}) {
  return (
    <aside className={styles.band}>
      <div className={styles.bandCopy}>
        <p className={styles.bandTitle}>{title || 'Rolling LiteLLM out to your whole company?'}</p>
        <p className={styles.bandText}>
          {text ||
            'Enterprise adds SSO, audit logs, delegated admin roles, and a support channel with the engineers who build LiteLLM. Same Gateway, one license key.'}
        </p>
      </div>
      <div className={styles.bandActions}>
        <SalesButton source={source} />
        {trial && <SalesButton kind="trial" variant="secondary" source={source} />}
      </div>
    </aside>
  );
}

// "What next" row: plain cards with a drawn icon and a one-line reason.
export function NextSteps({items}) {
  return <Tiles items={items} columns={items.length > 3 ? 4 : items.length} />;
}
