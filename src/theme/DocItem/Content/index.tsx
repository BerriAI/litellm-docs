import {useState, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import type {Props} from '@theme/DocItem/Content';
import styles from './styles.module.css';

function CopyIcon(): ReactNode {
  return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
  );
}

function CopyMarkdownButton({rawMarkdownB64}: {rawMarkdownB64: string}): ReactNode {
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

function useSyntheticTitle(): string | null {
  const {metadata, frontMatter, contentTitle} = useDoc();
  const shouldRender = !frontMatter.hide_title && typeof contentTitle === 'undefined';
  return shouldRender ? metadata.title : null;
}

export default function DocItemContent({children}: Props): ReactNode {
  const syntheticTitle = useSyntheticTitle();
  const {frontMatter} = useDoc();
  const activePlugin = useActivePlugin();
  // Set by src/remark/raw-markdown for the copy-as-markdown button.
  const rawMarkdownB64 = (frontMatter as {rawMarkdownB64?: string}).rawMarkdownB64;
  const showRustMigrationBanner = activePlugin?.pluginId === 'release-notes';

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {showRustMigrationBanner && (
        <Link className={styles.rustMigrationBanner} to="/rust-migration">
          <span className={styles.rustMigrationContent}>
            <strong>LiteLLM is moving to Rust <span aria-hidden="true">🦀</span></strong>
            <small>Read the latest updates.</small>
          </span>
          <span className={styles.rustMigrationChevron} aria-hidden="true">›</span>
        </Link>
      )}
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
