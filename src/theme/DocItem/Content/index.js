import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import Head from '@docusaurus/Head';
import styles from './styles.module.css';
import actionStyles from './pageActions.module.css';

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

// The raw source is base64 of UTF-8 bytes; atob alone would mangle any
// non-ASCII character, so decode the bytes explicitly.
function decodeMarkdown(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const SITE_URL = 'https://docs.litellm.ai';

function trackPageAction(action) {
  try {
    window.posthog?.capture?.('docs_page_action', {action, path: window.location.pathname});
  } catch {
    // analytics must never break the page
  }
}

// "Copy page" plus a menu to view the page as markdown or hand it to an
// assistant. The .md files are written at build time by plugins/llms.js, so
// the menu only offers them for pages of the main docs plugin.
function PageActions({rawMarkdownB64, permalink, hasMarkdownUrl}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleCopy() {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(decodeMarkdown(rawMarkdownB64));
      setCopied(true);
      trackPageAction('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }

  const mdUrl = `${SITE_URL}${permalink.endsWith('/') ? `${permalink}index.md` : `${permalink}.md`}`;
  const ask = encodeURIComponent(`Read ${mdUrl} and help me with it. I may ask follow-up questions about LiteLLM.`);
  const items = hasMarkdownUrl
    ? [
        {id: 'view', label: 'View as Markdown', sub: 'Plain text for agents', href: mdUrl},
        {id: 'claude', label: 'Open in Claude', sub: 'Ask questions about this page', href: `https://claude.ai/new?q=${ask}`},
        {id: 'chatgpt', label: 'Open in ChatGPT', sub: 'Ask questions about this page', href: `https://chatgpt.com/?hints=search&q=${ask}`},
      ]
    : [];

  return (
    <div className={actionStyles.wrap} ref={wrapRef}>
      <button
        className={clsx(styles.copyBtn, actionStyles.main, copied && styles.success)}
        onClick={handleCopy}
        title="Copy page as Markdown">
        <span className={styles.copyBtnInner}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied' : 'Copy page'}</span>
        </span>
      </button>
      {items.length > 0 && (
        <>
          <button
            className={clsx(styles.copyBtn, actionStyles.toggle)}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="More page actions">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div className={actionStyles.menu} role="menu">
              {items.map((item) => (
                <a
                  key={item.id}
                  role="menuitem"
                  className={actionStyles.item}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackPageAction(item.id);
                    setOpen(false);
                  }}>
                  <span className={actionStyles.itemLabel}>{item.label}</span>
                  <span className={actionStyles.itemSub}>{item.sub}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
  const isMainDocs = activePlugin?.pluginId === 'default';
  const actions = (
    <PageActions rawMarkdownB64={frontMatter.rawMarkdownB64} permalink={metadata.permalink} hasMarkdownUrl={isMainDocs} />
  );
  const rawMarkdownB64 = frontMatter.rawMarkdownB64;
  const showRustMigrationBanner = activePlugin?.pluginId === 'release-notes';

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {isMainDocs && (
        <Head>
          <link
            rel="alternate"
            type="text/markdown"
            href={`${metadata.permalink.endsWith('/') ? `${metadata.permalink}index` : metadata.permalink}.md`}
          />
        </Head>
      )}
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
          {rawMarkdownB64 && actions}
        </header>
      ) : (
        rawMarkdownB64 && (
          <div className={styles.copyBtnRow}>
            {actions}
          </div>
        )
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
