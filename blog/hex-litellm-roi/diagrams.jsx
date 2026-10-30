import React from 'react';
import Link from '@docusaurus/Link';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

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
        <div className={styles.heroBottom}><p>Track costs through LiteLLM.<br/>Explore them in your own Hex board.</p><a href="#get-the-template">Get the template <span aria-hidden="true">↓</span></a></div>
        <div className={styles.heroFoot}><span>PROJECTS / TEAMS / MODELS</span><span>OPEN TEMPLATE · V1.0.0</span></div>
      </div>
    </header>
    <div className={styles.article}>
      <div className={styles.byline}><PostByline horizontal /></div>
      <div className={styles.content}>{children}</div>
    </div>
  </div>;
}

export function TemplateDownloads() {
  return <div className={styles.downloads} data-template-downloads>
    <a href="/hex/litellm_roi_demo.hex.yaml" download><span className={styles.downloadMeta}>01 / SYNTHETIC DATA</span><strong>Try the demo <span aria-hidden="true">↗</span></strong><span>Explore the board before connecting a database.</span></a>
    <a href="/hex/litellm_roi_postgres.hex.yaml" download><span className={styles.downloadMeta}>02 / YOUR SPEND LOGS</span><strong>Connect Postgres <span aria-hidden="true">↗</span></strong><span>Build a report from your LiteLLM spend logs.</span></a>
  </div>;
}
