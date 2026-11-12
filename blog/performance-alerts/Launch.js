import React from 'react';
import Link from '@docusaurus/Link';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const dailySpend = [160, 180, 220, 200, 240, 180, 220, 1200];
const checks = [
  ['Spend', 'A rise in daily spend compared with your recent average.'],
  ['Traffic', 'A sharp increase or drop in request volume.'],
  ['Response time', 'Requests taking longer to complete.'],
  ['Error rate', 'A larger share of requests failing.'],
];

export default function Launch() {
  return (
    <div className={styles.root} data-full-width>
      <header className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.masthead}>
            <Link to="/blog" aria-label="Back to the LiteLLM blog">
              <img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="136" />
            </Link>
            <span>AI GATEWAY / NOVEMBER 2026</span>
          </div>
          <div className={styles.opening}>
            <h1>Performance<br />alerts</h1>
            <p className={styles.subtitle}>See what changed<br />in your gateway.</p>
            <figure className={styles.chart} aria-label="Illustrative daily spend. Seven days average $200, followed by $1,200 yesterday. The final day is six times the baseline.">
              <div className={styles.bars} aria-hidden="true">
                {dailySpend.map((value, index) => (
                  <div key={index} className={index === 7 ? styles.spike : styles.bar} style={{height: `${value / 12}%`}}>
                    {index === 7 && <span className={styles.spikeValue}>$1,200<span>Yesterday</span></span>}
                  </div>
                ))}
                <div className={styles.baseline}><span>$200 daily average</span></div>
              </div>
              <figcaption><span>Previous 7 days</span><span>Illustrative spend data</span></figcaption>
            </figure>
          </div>
          <div className={styles.heroFooter}><span>Spend. Traffic. Response time. Errors.</span><a href="#alerts">Read the announcement</a></div>
        </div>
      </header>

      <div className={styles.article} id="alerts">
        <div className={styles.byline}><PostByline horizontal /></div>
        <div className={styles.intro}>
          <p>Performance alerts flag changes in your gateway’s usage, so you can see which resource needs a closer look.</p>
          <p>Open <strong>Alerts</strong> in LiteLLM to review findings alongside model deprecations. Monitoring is on by default for gateways with a database and recorded Usage. You do not need to write rules.</p>
        </div>

        <section className={styles.section} aria-labelledby="checks-title">
          <h2 id="checks-title">Four things to watch</h2>
          <div>
            <p>LiteLLM compares the last complete day with the previous seven days across your gateway, model groups, teams, users, and virtual keys.</p>
            <dl className={styles.checks}>
              {checks.map(([name, description]) => <div key={name}><dt>{name}</dt><dd>{description}</dd></div>)}
            </dl>
            <p className={styles.caption}>These are daily findings based on recorded Usage. Detection is best effort, and missing Usage can affect the comparison.</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="review-title">
          <h2 id="review-title">From a change <br />to its context</h2>
          <div>
            <p>Select an alert to see the daily graph, the baseline, and the affected resource. Follow its link to inspect activity or model routing. Mark it resolved after addressing it, or dismiss it if no action is needed.</p>
            <p>The notification bell shows up to five open alerts. Select one to open it, or <strong>See all</strong> for the full inbox.</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="availability-title">
          <h2 id="availability-title">On by default <br />Five alerts free</h2>
          <div>
            <p>You get five saved performance alerts per gateway database. After the fifth, monitoring stops until you add an Enterprise license. Your saved alerts remain available.</p>
            <p>Enterprise includes continued monitoring. Resolving or dismissing an alert does not reset the free allowance, and model deprecations do not count toward it.</p>
            <p>You can opt out with the <strong>Performance monitoring</strong> switch on the Alerts page.</p>
          </div>
        </section>

        <footer className={styles.end}>
          <a href="https://docs.litellm.ai/docs/proxy/alerts/performance">Read the performance alerts guide</a>
          <Link to="/docs/enterprise">LiteLLM Enterprise</Link>
        </footer>
      </div>
    </div>
  );
}
