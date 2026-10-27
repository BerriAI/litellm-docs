import React from 'react';
import Link from '@docusaurus/Link';
import {ArrowRight} from 'lucide-react';
import styles from './styles.module.css';

export default function SubscriptionCards({items}) {
  return (
    <div className={styles.cards}>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className={styles.card}>
          <img className={styles.icon} src={item.icon} alt="" />
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.description}>{item.description}</p>
          <ul className={styles.requirements}>
            {item.listDescription.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
          <div className={styles.footer}>
            <span className={styles.version}>{item.version}</span>
            <span className={styles.action}>
              {item.ctaLabel}<ArrowRight size={18} aria-hidden="true" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
