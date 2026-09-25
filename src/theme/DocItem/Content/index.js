import React, {useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import EnglishFallbackNotice from '@site/src/components/EnglishFallbackNotice';
import styles from './styles.module.css';

// atob yields one char per byte, so multi-byte UTF-8 (Chinese) must be decoded.
function decodeBase64Utf8(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function CopyMarkdownButton({rawMarkdownB64}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(decodeBase64Utf8(rawMarkdownB64));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }

  return (
    <button
      className={clsx(styles.copyBtn, copied && styles.success)}
      onClick={handleClick}
      title={translate({id: 'theme.docItem.copyMarkdown.title', message: 'Copy page as Markdown'})}
    >
      <span className={styles.copyBtnInner}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span>
          {copied ? (
            <Translate id="theme.docItem.copyMarkdown.copied">Copied</Translate>
          ) : (
            <Translate id="theme.docItem.copyMarkdown.label">Copy as Markdown</Translate>
          )}
        </span>
      </span>
    </button>
  );
}

function useSyntheticTitle() {
  const {metadata, frontMatter, contentTitle} = useDoc();
  const shouldRender = !frontMatter.hide_title && typeof contentTitle === 'undefined';
  return shouldRender ? metadata.title : null;
}

export default function DocItemContent({children}) {
  const syntheticTitle = useSyntheticTitle();
  const {frontMatter, metadata} = useDoc();
  const activePlugin = useActivePlugin();
  const rawMarkdownB64 = frontMatter.rawMarkdownB64;
  const showRustMigrationBanner = activePlugin?.pluginId === 'release-notes';

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {showRustMigrationBanner && (
        <Link className={styles.rustMigrationBanner} to="/rust-migration">
          <span className={styles.rustMigrationContent}>
            <strong>
              <Translate id="theme.docItem.rustBanner.title">LiteLLM is moving to Rust</Translate>{' '}
              <span aria-hidden="true">🦀</span>
            </strong>
            <small>
              <Translate id="theme.docItem.rustBanner.subtitle">Read the latest updates.</Translate>
            </small>
          </span>
          <span className={styles.rustMigrationChevron} aria-hidden="true">›</span>
        </Link>
      )}
      <EnglishFallbackNotice source={metadata.source} />
      {syntheticTitle ? (
        <header className={styles.titleRow}>
          <Heading as="h1" className={styles.title}>{syntheticTitle}</Heading>
          {rawMarkdownB64 && <CopyMarkdownButton rawMarkdownB64={rawMarkdownB64} />}
        </header>
      ) : (
        rawMarkdownB64 && (
          <div className={styles.copyBtnRow}>
            <CopyMarkdownButton rawMarkdownB64={rawMarkdownB64} />
          </div>
        )
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
