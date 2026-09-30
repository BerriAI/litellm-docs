import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import CodeBlock from '@theme/CodeBlock';
import PromptButton from './PromptButton';
import SalesButton from './SalesButton';
import {CARD_GROUPS, PRODUCT_CARDS, USE_CASES} from './content';
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
  if (v.type === 'chat') {
    return (
      <div className={styles.chat}>
        {v.lines.map(([who, text]) => (
          <div key={who} className={clsx(styles.msg, who === 'You' && styles.msgYou)}>
            <span className={styles.who}>{who}</span>
            <span>{text}</span>
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

function Row({u, source}) {
  return (
    <article className={styles.item} id={`use-${u.id}`}>
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
          {u.prompt && <PromptButton id={u.prompt} source={`${source}-${u.id}`} size="md" />}
        </div>
      </div>
      <div className={styles.visual}>
        <Visual v={u.visual} />
      </div>
    </article>
  );
}

function Card({c, source}) {
  return (
    <article className={clsx('lite-cardgrid__cell', styles.card)} id={`use-${c.id}`}>
      <p className={styles.product}>{c.product}</p>
      <h4 className={styles.cardProblem}>{c.problem}</h4>
      <p className={styles.cardText}>{c.text}</p>
      <div className={styles.cardVisual}>
        <Visual v={c.visual} />
      </div>
      <div className={styles.cardActions}>
        <Link className={styles.cardLink} to={c.to} onClick={() => track('docs_use_case_cta', {id: c.id, source})}>
          Read the guide
        </Link>
        <PromptButton id={c.prompt} source={`${source}-${c.id}`} />
      </div>
    </article>
  );
}

// Adoption at a glance, from plugins/litellm-stats.js (fetched at build time).
function Stats() {
  const s = usePluginData('litellm-stats') || {};
  const items = [
    {value: s.stars, label: 'GitHub stars', to: 'https://github.com/BerriAI/litellm'},
    {value: s.downloadsShort, label: 'PyPI downloads last month', to: 'https://pypistats.org/packages/litellm'},
    {value: s.contributors, label: 'contributors', to: 'https://github.com/BerriAI/litellm/graphs/contributors'},
    {value: '100+', label: 'LLM providers', to: '/docs/providers'},
  ].filter((i) => i.value);
  return (
    <div className={clsx('lite-cardgrid', styles.stats)}>
      {items.map((i) => (
        <Link key={i.label} to={i.to} className={clsx('lite-cardgrid__cell', styles.stat)}>
          <span className={styles.statValue}>{i.value}</span>
          <span className={styles.statLabel}>{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

export default function UseCases({source = 'docs-home'}) {
  const [sdk, gateway, ...rest] = USE_CASES;
  return (
    <section className={styles.wrap} aria-labelledby="use-cases-title">
      <h2 id="use-cases-title" className={styles.title}>
        Why developers love LiteLLM
      </h2>
      <Stats />
      <div className={styles.list}>
        <Row u={sdk} source={source} />
        <Row u={gateway} source={source} />
      </div>
      <div className={styles.built}>
        <h3 className={styles.moreTitle}>Built on the gateway</h3>
        <p className={styles.moreLead}>
          Once your apps call the gateway, the same deployment can serve MCP tools and agents, pick the right model for each request, and be
          run from your terminal or by your coding agent.
        </p>
        {CARD_GROUPS.map((g) => (
          <div key={g.title} className={styles.group}>
            <p className={styles.groupTitle}>{g.title}</p>
            <div className={clsx('lite-cardgrid', styles.cards)}>
              {g.ids.map((id) => (
                <Card key={id} c={PRODUCT_CARDS.find((c) => c.id === id)} source={source} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={clsx(styles.list, styles.listEnd)}>
        {rest.map((u) => (
          <Row key={u.id} u={u} source={source} />
        ))}
      </div>
    </section>
  );
}
