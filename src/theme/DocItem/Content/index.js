import React, {useState} from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import styles from './styles.module.css';

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
      await navigator.clipboard.writeText(atob(rawMarkdownB64));
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
      title="Copy page as Markdown"
    >
      <span className={styles.copyBtnInner}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span>{copied ? 'Copied' : 'Copy as Markdown'}</span>
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
  const {frontMatter} = useDoc();
  const rawMarkdownB64 = frontMatter.rawMarkdownB64;

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
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
