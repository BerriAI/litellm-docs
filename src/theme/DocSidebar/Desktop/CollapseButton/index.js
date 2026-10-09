import React from 'react';
import clsx from 'clsx';
import {translate} from '@docusaurus/Translate';
import SidebarToggleIcon from '@site/src/components/SidebarToggleIcon';
import styles from './styles.module.css';

// A chevron at the bottom of the sidebar.
export default function CollapseButton({onClick, className}) {
  const label = translate({
    id: 'theme.docs.sidebar.collapseButtonTitle',
    message: 'Hide sidebar',
    description: 'The title attribute for collapse button of doc sidebar',
  });
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(styles.toggle, className)}
      onClick={onClick}>
      <span className={styles.box}>
        <SidebarToggleIcon direction="left" />
      </span>
    </button>
  );
}
