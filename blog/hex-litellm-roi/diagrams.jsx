import React from 'react';
import Link from '@docusaurus/Link';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const liveDemoUrl = 'https://app.hex.tech/01a18e4b-6e94-7328-831c-e5ab0e2e00e7/app/LiteLLM-AI-cost-and-ROI-demo-034p688gOAllaldLw72Oat/latest';

function ReportingArtwork() {
  return <svg className={styles.art} viewBox="0 0 1440 640" fill="none" aria-hidden="true">
    <defs><pattern id="hex-report-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="white" opacity=".27" /></pattern></defs>
    <rect x="500" y="30" width="940" height="610" fill="url(#hex-report-dots)" />
    <g stroke="white" strokeWidth="1" opacity=".22">
      <path d="M500 570 820 380 1110 550 1430 360M500 530 820 340 1110 510 1430 320M500 490 820 300 1110 470 1430 280M500 450 820 260 1110 430 1430 240" />
      <path d="M820 260v120m290 50v120m320-310v120M500 450v120" />
      <path d="M660 355v120m305-130v120m305-130v120" strokeDasharray="3 7" />
    </g>
    <path d="m660 314 160-95 290 170 320-190" stroke="white" strokeWidth="2" opacity=".58" />
    <g fill="white" opacity=".8"><circle cx="660" cy="314" r="3"/><circle cx="820" cy="219" r="3"/><circle cx="1110" cy="389" r="3"/><circle cx="1430" cy="199" r="3"/></g>
  </svg>;
}

export function HexPage({children}) {
  return <div className={styles.root} data-full-width>
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroMeta}><Link to="/blog">← Blog</Link><span>COST REPORTING / HEX TEMPLATE</span></div>
        <div className={styles.brands}><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="150" height="36"/><span aria-hidden="true">×</span><img src="/img/hex/hex-logo.svg" alt="Hex" width="94" height="36"/></div>
        <ReportingArtwork />
        <h1><span className={styles.title}>AI spend.</span><span className={styles.subtitle}>Cost reporting, now in Hex.<span aria-hidden="true">↘</span></span></h1>
        <div className={styles.heroBottom}><p>Connect Hex to your LiteLLM Postgres data.<br/>Set budgets and routing in LiteLLM.</p><a href={liveDemoUrl} target="_blank" rel="noopener noreferrer">View live Hex demo <span aria-hidden="true">↗</span></a></div>
        <div className={styles.heroFoot}><span>TEAMS / MODELS / BUDGETS</span><span>OPEN TEMPLATE · V2.0.0</span></div>
      </div>
    </header>
    <BoardShowcase />
    <div className={styles.article}>
      <div className={styles.byline}><PostByline horizontal /></div>
      <div className={styles.content}>{children}</div>
    </div>
  </div>;
}

export function TemplateDownloads() {
  return <div className={styles.downloads} data-template-downloads>
    <a href={liveDemoUrl} target="_blank" rel="noopener noreferrer"><span className={styles.downloadMeta}>LIVE / SYNTHETIC DATA</span><strong>Open the Hex dashboard <span aria-hidden="true">↗</span></strong><span>Explore the working demo. No sign-in or download.</span></a>
    <a href="/hex/litellm_team_cost_postgres.hex.yaml" download><span className={styles.downloadMeta}>TEMPLATE / YOUR DATABASE</span><strong>Download the template <span aria-hidden="true">↓</span></strong><span>Import this YAML project into Hex, then select your connection.</span></a>
  </div>;
}

function BoardShowcase() {
  return <section className={styles.showcase} aria-label="Hex dashboard preview">
    <div className={styles.showcaseLabel}><span>THE HEX BOARD</span><span>SYNTHETIC DEMO DATA</span></div>
    <h2>Explore the live Hex dashboard.</h2>
    <p><a href={liveDemoUrl} target="_blank" rel="noopener noreferrer">Open the working demo ↗</a> · Synthetic data · No sign-in</p>
    <img className={styles.boardPreview} src="/img/hex/public-demo.png" alt="Hex board showing project spend, request volume, unit costs and daily trends with synthetic data" />
    <figure id="cost-change-demo" className={styles.costDemo}>
      <h3>See a model change raise unit cost.</h3>
      <img src="/img/hex/cost-change.gif" width="1120" height="480" alt="Zoomed Hex demo alternating between project model mix and the cost-change table, where document-review shows an 80 percent unit-cost increase" />
      <figcaption>Model mix and seven-day cost changes in Hex. Synthetic demo data.</figcaption>
    </figure>
    <p className={styles.demoNote}>The public demo includes synthetic timing metrics. The daily team template reports recorded costs, requests and usage; daily rows do not include latency.</p>
  </section>;
}

export function SpendDataFlow() {
  return <figure className={styles.dataFlow} aria-label="LiteLLM spend logs to Hex data flow">
    <div className={styles.flowTitle}><span>READ-ONLY DATA FLOW</span><span>EXISTING DAILY AGGREGATES</span></div>
    <div className={styles.flowSteps}>
      <div className={styles.flowNode}><small>01 / YOUR POSTGRES</small><strong>Daily spend</strong><code>LiteLLM_DailyTeamSpend</code><dl><dt>date + team_id</dt><dd>Day and team</dd><dt>model + spend</dt><dd>Recorded costs</dd><dt>api_requests</dt><dd>Daily requests</dd><dt>prompt_tokens + completion_tokens</dt><dd>Token usage</dd></dl></div>
      <span className={styles.flowArrow} aria-hidden="true">→</span>
      <div className={styles.flowNode}><small>02 / HEX SOURCE QUERY</small><strong>Team names</strong><code>LiteLLM_TeamTable</code><p>Join daily totals to team display names.<br/>Keep ownership by stable team ID.</p><span className={styles.flowTag}>SQL included in the template</span><span className={styles.flowTag}>No database objects created</span></div>
      <span className={styles.flowArrow} aria-hidden="true">→</span>
      <div className={styles.flowNode}><small>03 / YOUR HEX APP</small><strong>Cost reporting</strong><div className={styles.miniBars} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div><p>Team costs. Model mix.<br/>Daily trends. Cost changes.</p><span className={styles.flowTag}>Refresh with a scheduled run</span></div>
    </div>
    <figcaption>LiteLLM writes the daily totals in Postgres. Hex reads reporting columns from these two existing tables. You change budgets and routing in LiteLLM; Hex does not write to the gateway.</figcaption>
  </figure>;
}
