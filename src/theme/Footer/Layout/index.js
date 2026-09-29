import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';

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
              {/* The footer is always navy, so it uses the white primary logo. */}
              <img
                className="footer__brand-logo"
                src={useBaseUrl('/img/brand/litellm-logo-white.png')}
                alt="LiteLLM"
                width="264"
                height="50"
              />
            </a>
          </div>
          {logo && <div className="margin-bottom--sm">{logo}</div>}
          {copyright}
        </div>
      </div>
    </footer>
  );
}
