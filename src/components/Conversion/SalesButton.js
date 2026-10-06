import React from 'react';
import clsx from 'clsx';
import {SALES_URL, TRIAL_URL, withUtm} from './content';
import {track} from './shared';
import styles from './styles.module.css';

// "Talk to sales" and "Start a 30-day trial": links to the website's
// Enterprise request form, tagged with where on the docs the click came from.
export default function SalesButton({
  kind = 'sales',
  source = 'docs',
  variant = 'primary',
  children,
  className,
}) {
  const url = withUtm(kind === 'trial' ? TRIAL_URL : SALES_URL, source);
  const label = children || (kind === 'trial' ? 'Start a 30-day trial' : 'Talk to sales');

  return (
    <a
      className={clsx(variant === 'primary' ? styles.btnPrimary : styles.btnSecondary, className)}
      href={url}
      target="_blank"
      rel="noopener"
      onClick={() => track('docs_sales_cta_clicked', {kind, source})}>
      {label}
    </a>
  );
}
