import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import DocSidebarDesktop from '@theme/DocSidebar/Desktop';
import DocSidebarMobile from '@theme/DocSidebar/Mobile';
import CollapseButton from '@theme/DocSidebar/Desktop/CollapseButton';
import SearchBar from '@theme/SearchBar';
import styles from './styles.module.css';

export default function DocSidebar({onCollapse, ...props}) {
  const {
    docs: {
      sidebar: {hideable},
    },
  } = useThemeConfig();

  return (
    <>
      <div className={styles.sidebarDesktop}>
        <div className={styles.sidebarContainer}>
          <div className={styles.searchBarSection}>
            <div className={styles.searchBarInner}>
              <SearchBar />
            </div>
          </div>
          <div className={styles.sidebarScroll}>
            <DocSidebarDesktop {...props} />
          </div>
          {hideable && <CollapseButton onClick={onCollapse} />}
        </div>
      </div>
      <div className={styles.sidebarMobile}>
        <DocSidebarMobile {...props} />
      </div>
    </>
  );
}
