import React, {type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export type NavigationCardItem = {
  title: ReactNode;
  to: string;
  icon?: ReactNode;
  description?: ReactNode;
  listDescription?: ReactNode[];
};

type Props = {
  items: NavigationCardItem[];
  columns?: number;
};

export default function NavigationCards({ items, columns = 2 }: Props): ReactNode {
  return (
    <div
      className={styles.grid}
      style={{ '--nav-columns': columns } as CSSProperties}
    >
      {items.map((item, i) => {
        const isExternal = item.to.startsWith('http://') || item.to.startsWith('https://');
        return (
          <Link
            key={i}
            to={item.to}
            className={styles.card}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            {item.icon && (
              <div className={styles.icon}>{item.icon}</div>
            )}
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
            {isExternal && (
              <span className={styles.externalIcon}>↗</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
