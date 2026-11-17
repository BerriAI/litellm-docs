import React from 'react';
import Layout from '@theme-original/Navbar/MobileSidebar/Layout';
import SearchBar from '@theme/SearchBar';

export default function MobileSidebarLayout(props) {
  const withSearch = menu => <><div className="docs-mobile-search"><SearchBar /></div>{menu}</>;
  return <Layout {...props} primaryMenu={withSearch(props.primaryMenu)} secondaryMenu={withSearch(props.secondaryMenu)} />;
}
