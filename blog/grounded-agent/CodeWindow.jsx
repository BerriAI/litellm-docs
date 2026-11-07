import React, {useState} from 'react';
import Highlight, {defaultProps} from 'prism-react-renderer';
import styles from './code-window.module.css';

const theme = {
  plain: {color: '#dce6f3', backgroundColor: '#111b2b'},
  styles: [
    {types: ['comment', 'prolog'], style: {color: '#8090a9'}},
    {types: ['keyword', 'operator'], style: {color: '#c2a7ff'}},
    {types: ['string', 'attr-value'], style: {color: '#a8d7ae'}},
    {types: ['function', 'class-name'], style: {color: '#8cc7ff'}},
    {types: ['number', 'boolean'], style: {color: '#efc48c'}},
    {types: ['property', 'attr-name'], style: {color: '#92cee3'}},
    {types: ['punctuation'], style: {color: '#a6b5cc'}},
  ],
};

export default function CodeWindow({children, title = 'agent.py', language = 'python'}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const code = children.trim();
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return <figure className={styles.window}>
    <figcaption className={styles.bar}>
      <span className={styles.filename}><svg className={styles.fileIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 1.5H3v13h10V5L9.5 1.5Zm0 0V5H13M5.5 8h5m-5 3h3" /></svg>{title}</span>
      <button type="button" onClick={copyCode} aria-label={`Copy ${title} code`}><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1"/><path d="M10 5V2H2v9h3"/></svg>{copyError ? 'Select to copy' : copied ? 'Copied' : 'Copy'}</button>
    </figcaption>
    <Highlight {...defaultProps} theme={theme} code={code} language={language}>
      {({tokens, getLineProps, getTokenProps}) => <pre className={styles.pre} tabIndex={0} aria-label={`${title} code`}><code className={styles.code}>
        {tokens.map((line, index) => <span {...getLineProps({line, key: index})} className={styles.line} key={index}><span className={styles.lineNumber} aria-hidden="true">{index + 1}</span><span>{line.map((token, tokenIndex) => <span {...getTokenProps({token, key: tokenIndex})} key={tokenIndex} />)}</span></span>)}
      </code></pre>}
    </Highlight>
  </figure>;
}
