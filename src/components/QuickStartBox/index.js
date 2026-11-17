import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {PROMPTS, QUICKSTART} from '../Conversion/content';
import {IconAgent, IconCheck, IconCopy} from '../Conversion/icons';
import {track, useCopy} from '../Conversion/shared';
import styles from './styles.module.css';

// The one command that gets someone started, in the site's code block style:
// Gateway or SDK on the left, "Quick Start" in the middle, the operating
// system on the right, and a Copy button that is always on screen.
// variant="gateway" drops the Gateway and SDK choice, for gateway pages.
// showTitle={false} drops the label, for a page whose title already says it.
// With a heading or child text, the box sits in a tinted panel with the text
// below the command and the agent prompt button beside it.
export default function QuickStartBox({variant = 'full', showTitle = true, heading, children, source = 'docs'}) {
  const [product, setProduct] = useState('gateway');
  const [os, setOs] = useState('mac');
  const [copied, copy] = useCopy();
  const [promptCopied, copyPrompt] = useCopy();
  const [clipped, setClipped] = useState(false);
  const preRef = useRef(null);

  // Windows visitors see the PowerShell command first.
  useEffect(() => {
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    if (/win/i.test(platform)) setOs('windows');
  }, []);

  const command = product === 'sdk' ? QUICKSTART.sdk : QUICKSTART.gateway[os];

  // Fade the right edge only when the command is wider than the box.
  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return undefined;
    const measure = () => setClipped(pre.scrollWidth > pre.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pre);
    return () => ro.disconnect();
  }, [command]);

  const tab = (label, on, onClick, short) => (
    <button type="button" aria-pressed={on} className={clsx(styles.tab, on && styles.tabOn)} onClick={onClick}>
      {short ? (
        <>
          <span className={styles.long}>{label}</span>
          <span className={styles.short}>{short}</span>
        </>
      ) : (
        label
      )}
    </button>
  );

  const promptButton = (
    <button
      type="button"
      className={styles.prompt}
      onClick={() => {
        copyPrompt(PROMPTS[product].text);
        track('docs_agent_prompt_copied', {prompt: product, source});
      }}>
      {promptCopied ? <IconCheck size={13} /> : <IconAgent size={13} />}
      {promptCopied ? 'Copied' : 'Copy agent prompt'}
    </button>
  );
  const panel = Boolean(heading || children);

  return (
    <div className={clsx(styles.wrap, panel && styles.panel)}>
      {heading && <p className={styles.heading}>{heading}</p>}
      <div className={clsx('theme-code-block', styles.box)}>
        <div className={styles.head}>
          {variant === 'full' && (
            <div className={styles.group} role="group" aria-label="What to start">
              {tab('Gateway', product === 'gateway', () => setProduct('gateway'))}
              {tab('SDK', product === 'sdk', () => setProduct('sdk'))}
            </div>
          )}
          {showTitle && <span className={styles.title}>Quick Start</span>}
          {product === 'gateway' && (
            <div className={clsx(styles.group, styles.right)} role="group" aria-label="Operating system">
              {tab('macOS & Linux', os === 'mac', () => setOs('mac'), 'macOS/Linux')}
              {tab('Windows', os === 'windows', () => setOs('windows'))}
            </div>
          )}
        </div>
        <div className={styles.run}>
          <pre ref={preRef} className={clsx(styles.cmd, clipped && styles.clipped)}>
            <code>{command}</code>
          </pre>
          <button
            type="button"
            className={clsx(styles.copy, copied && styles.copyDone)}
            aria-label={copied ? 'Command copied' : 'Copy command'}
            onClick={() => {
              copy(command);
              track('docs_install_copied', {kind: product, os: product === 'sdk' ? undefined : os, source});
            }}>
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            <span className={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      {panel ? (
        <div className={styles.footer}>
          <div className={styles.text}>{children}</div>
          <div className={styles.footerAction}>{promptButton}</div>
        </div>
      ) : (
        <div className={styles.below}>{promptButton}</div>
      )}
    </div>
  );
}
