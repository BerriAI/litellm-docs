import React from 'react';
import Link from '@docusaurus/Link';
import { ArrowRight } from 'lucide-react';
import styles from './styles.module.css';

export default function NavigationCards({ items, columns = 2, variant = 'grid' }) {
  const separated = variant === 'cards';
  return (
    <div
      className={separated ? styles.tiles : styles.grid}
      style={{ '--nav-columns': columns }}
    >
      {items.map((item, i) => {
        const isExternal =
          item.to && (item.to.startsWith('http://') || item.to.startsWith('https://'));
        return (
          <Link
            key={i}
            to={item.to}
            className={separated ? styles.tile : styles.card}
            data-tone={separated ? item.tone : undefined}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
          >
            {item.icon && (
              <div className={styles.icon} aria-hidden={separated ? true : undefined}>{item.icon}</div>
            )}
            {separated && <ArrowRight className={styles.arrow} size={16} aria-hidden="true" />}
            <div className={styles.title}>{item.title}</div>
            {item.description && (
              <div className={styles.description}>{item.description}</div>
            )}
            {item.listDescription && (
              <ul className={styles.list}>
                {item.listDescription.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            )}
            {item.ctaLabel && (
              <span className={`button button--primary button--sm ${styles.cta}`}>
                {item.ctaLabel}
              </span>
            )}
            {isExternal && (
              <span className={styles.externalIcon}>↗</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
