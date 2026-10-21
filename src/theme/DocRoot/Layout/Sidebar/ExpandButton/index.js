import React from 'react';
import {translate} from '@docusaurus/Translate';
import SidebarToggleIcon from '@site/src/components/SidebarToggleIcon';
import styles from './styles.module.css';

// The whole narrow strip stays clickable. The chevron at the bottom sits
// where the hide button was.
export default function DocRootLayoutSidebarExpandButton({toggleSidebar}) {
  const label = translate({
    id: 'theme.docs.sidebar.expandButtonTitle',
    message: 'Show sidebar',
    description: 'The ARIA label and title attribute for expand button of doc sidebar',
  });
  return (
    <div
      className={styles.expandButton}
      title={label}
      aria-label={label}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSidebar(e);
        }
      }}
      onClick={toggleSidebar}>
      <span className={styles.markWrap}>
        <span className={styles.box}>
          <SidebarToggleIcon direction="right" />
        </span>
      </span>
    </div>
  );
}
