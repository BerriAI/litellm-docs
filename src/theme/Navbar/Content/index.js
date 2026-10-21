import React from 'react';
import {
  useThemeConfig,
  ErrorCauseBoundary,
} from '@docusaurus/theme-common';
import {
  splitNavbarItems,
  useNavbarMobileSidebar,
} from '@docusaurus/theme-common/internal';
import NavbarItem from '@theme/NavbarItem';
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';
import NavbarLogo from '@theme/Navbar/Logo';
import NavbarSearch from '@theme/Navbar/Search';
import SearchBar from '@theme/SearchBar';
import AskAIButton from '@site/src/components/AskAI/AskAIButton';
import NavbarMoreMenu from '@site/src/components/NavbarMoreMenu';

function useNavbarItems() {
  return useThemeConfig().navbar.items;
}

function NavbarItems({ items }) {
  return (
    <>
      {items.map((item, i) => (
        <ErrorCauseBoundary
          key={i}
          onError={(error) =>
            new Error(
              `A theme navbar item failed to render.\n${JSON.stringify(item, null, 2)}`,
              { cause: error },
            )
          }>
          <NavbarItem {...item} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}

export default function NavbarContent() {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const [leftItems, rightItems] = splitNavbarItems(items);
  const searchBarItem = items.find((item) => item.type === 'search');

  return (
    <div className="navbar__inner">
      {/* Left: logo, then the product switcher and the nav links */}
      <div className="navbar__brand-col">
        {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
        <NavbarLogo />
      </div>

      <div className="navbar__center-col">
        <NavbarItems items={leftItems} />
      </div>

      {/* Right: search, Ask AI, GitHub, More. The color mode toggle only
          shows on phones (CSS); on desktop it lives in the More menu. */}
      <div className="navbar__right-col">
        {!searchBarItem && (
          <NavbarSearch>
            <SearchBar />
          </NavbarSearch>
        )}
        <AskAIButton />
        <NavbarItems items={rightItems} />
        <NavbarMoreMenu />
        <NavbarColorModeToggle className="navbar__colormode-mobile" />
      </div>
    </div>
  );
}
