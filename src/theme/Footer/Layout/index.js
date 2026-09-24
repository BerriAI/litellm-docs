import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';

export default function FooterLayout({style, links, logo, copyright}) {
  return (
    <footer
      className={clsx(ThemeClassNames.layout.footer.container, 'footer', {
        'footer--dark': style === 'dark',
      })}>
      <div className="container container-fluid">
        {links}
        <div className="footer__bottom text--center">
          <div className="footer__brand-row">
            <a
              className="footer__brand"
              href="https://www.litellm.ai/"
              target="_blank"
              rel="noopener noreferrer">
              <span className="footer__brand-mark" aria-hidden="true">
                🚅
              </span>
              <span className="footer__brand-name">LiteLLM</span>
            </a>
          </div>
          {logo && <div className="margin-bottom--sm">{logo}</div>}
          {copyright}
        </div>
      </div>
    </footer>
  );
}
