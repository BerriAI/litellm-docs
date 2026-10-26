import React from 'react';
import clsx from 'clsx';
import TOCItems from '@theme/TOCItems';
import Link from '@docusaurus/Link';
import ThemedImage from '@theme/ThemedImage';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const LINK_CLASS_NAME = 'table-of-contents__link toc-highlight';
const LINK_ACTIVE_CLASS_NAME = 'table-of-contents__link--active';

export default function TOC({ className, ...props }) {
  return (
    <div className={clsx(styles.tableOfContents, className)}>
      {/* Scrollable TOC items */}
      <div className={clsx(styles.tocItemsContainer, 'thin-scrollbar')}>
        <TOCItems
          {...props}
          linkClassName={LINK_CLASS_NAME}
          linkActiveClassName={LINK_ACTIVE_CLASS_NAME}
        />
      </div>

      {/* Enterprise promo card pinned at the bottom */}
      <div className={styles.promoCard}>
        <ThemedImage
          className={styles.promoMark}
          alt=""
          width={22}
          height={22}
          sources={{
            light: useBaseUrl('/img/brand/litellm-monogram-blue.svg'),
            dark: useBaseUrl('/img/brand/litellm-monogram-white.svg'),
          }}
        />
        <div className={styles.promoHeading}>LiteLLM Enterprise</div>
        <div className={styles.promoDescription}>
          SSO/SAML, audit logs, spend tracking, multi-team management, and
          guardrails, built for production.
        </div>
        <Link to="/docs/enterprise" className={styles.promoButton}>
          Learn more →
        </Link>
      </div>
    </div>
  );
}
