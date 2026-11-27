import React, {useEffect} from 'react';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import Layout from '@theme-original/Navbar/MobileSidebar/Layout';
import SearchBar from '@theme/SearchBar';

export default function MobileSidebarLayout(props) {
  const {shown, toggle} = useNavbarMobileSidebar();

  useEffect(() => {
    if (!shown) return undefined;
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      toggle();
      document.querySelector('.navbar__toggle')?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shown, toggle]);

  const withSearch = menu => <><div className="docs-mobile-search"><SearchBar /></div>{menu}</>;
  return <Layout {...props} primaryMenu={withSearch(props.primaryMenu)} secondaryMenu={withSearch(props.secondaryMenu)} />;
}
