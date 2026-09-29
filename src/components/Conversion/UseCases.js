import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import PromptButton from './PromptButton';
import SalesButton from './SalesButton';
import {USE_CASES} from './content';
import {track} from './shared';
import cv from './styles.module.css';
import styles from './usecases.module.css';

// The docs home below the path picker: one section per product, each the
// problem a reader has, then the product that solves it. The visual is always
// real text (code, a small table, or log lines), so it reads the same for a
// person and for an agent reading the page's markdown.

function Visual({v}) {
  if (v.type === 'code') {
    return (
      <CodeBlock language={v.lang} className={styles.code}>
        {v.code}
      </CodeBlock>
    );
  }
  if (v.type === 'table') {
    return (
      <div className={styles.table} role="table">
        <div className={clsx(styles.tr, styles.th)} role="row" style={{'--cols': v.head.length}}>
          {v.head.map((h) => (
            <span key={h} role="columnheader">
              {h}
            </span>
          ))}
        </div>
        {v.rows.map((r) => (
          <div key={r[0]} className={styles.tr} role="row" style={{'--cols': v.head.length}}>
            {r.map((c, i) => (
              <span key={i} role="cell" className={clsx(c === 'no access' && styles.muted)}>
                {c}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.lines}>
      {v.lines.map((l) => (
        <div key={l.join()} className={styles.line}>
          {l.map((c, i) => (
            <span key={i} className={clsx(i === l.length - 1 && styles.lineEnd, c === 'not allowed' && styles.muted)}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function UseCases({source = 'docs-home'}) {
  return (
    <section className={styles.wrap} aria-labelledby="use-cases-title">
      <h2 id="use-cases-title" className={styles.title}>
        What people use LiteLLM for
      </h2>
      <div className={styles.list}>
        {USE_CASES.map((u) => (
          <article key={u.id} className={styles.item} id={`use-${u.id}`}>
            <div className={styles.copy}>
              <p className={styles.product}>{u.product}</p>
              <h3 className={styles.problem}>{u.problem}</h3>
              <p className={styles.solution}>{u.solution}</p>
              <div className={styles.actions}>
                {u.sales ? (
                  <SalesButton source={`${source}-${u.id}`} variant="secondary" />
                ) : (
                  <Link className={cv.btnSecondary} to={u.to} onClick={() => track('docs_use_case_cta', {id: u.id, source})}>
                    {u.cta}
                  </Link>
                )}
                <PromptButton id={u.prompt} source={`${source}-${u.id}`} size="md" />
              </div>
            </div>
            <div className={styles.visual}>
              <Visual v={u.visual} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
