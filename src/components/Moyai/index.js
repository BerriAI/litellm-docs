import React from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import {ArrowRight, Network, Terminal} from 'lucide-react';
import styles from './styles.module.css';

const root = '/docs/self_hosted_coding_agents/moyai';

export function GuideNav({active}) {
  return (
    <nav className={styles.nav} aria-label="Moyai guides">
      {[
        ['overview', '', 'Moyai'],
        ['setup', '/setup', 'Setup'],
        ['architecture', '/architecture', 'Architecture'],
      ].map(([id, path, label]) => (
        <Link key={id} to={`${root}${path}`} aria-current={active === id ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function CostHero() {
  return (
    <header className={styles.cost}>
      <div className={styles.costHeadline}>
        <div>
          <p className={styles.kicker}>Moyai / Open source cloud coding agent</p>
          <h1>We built Moyai after a $101,872 month on Devin.</h1>
        </div>
        <div className={styles.metric}>
          <strong>79<span>%</span></strong>
          <span>lower estimated cost<br />for the LiteLLM team</span>
        </div>
      </div>
      <figure className={styles.comparison} aria-label="LiteLLM's 31-day cost comparison">
        <div className={styles.barLabel}><span>Devin <small>Actual bill · 31 days</small></span><strong>$101,872</strong></div>
        <div className={styles.barTrack} aria-hidden="true"><div className={styles.devinBar} /></div>
        <div className={styles.barLabel}><span>Moyai <small>Estimate · 31 days</small></span><strong>~$21,700</strong></div>
        <div className={styles.barTrack} aria-hidden="true"><div className={styles.moyaiBar} /></div>
        <figcaption>
          We estimate about $700/day for Moyai, or $21,700 over 31 days. This is our internal comparison,
          not a matched-workload benchmark. Your model mix, compute, and storage affect your costs.{' '}
          <Link to="/blog/moyai-open-source#the-results-79-cheaper">Read the cost breakdown <span aria-hidden="true">↗</span></Link>
        </figcaption>
      </figure>
    </header>
  );
}

export function BenefitGrid() {
  return (
    <div className={styles.benefits}>
      <section aria-labelledby="choose-your-stack">
        <span className={styles.number}>01</span>
        <Heading as="h3" id="choose-your-stack">Run the agent and model you want.</Heading>
        <p>Choose Codex, Claude Agent SDK, Hermes, or another supported harness. Use compatible models through your LiteLLM gateway.</p>
      </section>
      <section aria-labelledby="delegate-cloud-work">
        <span className={styles.number}>02</span>
        <Heading as="h3" id="delegate-cloud-work">Close your laptop. Come back to a pull request.</Heading>
        <p>Give Moyai a task in Slack or the browser. It edits code and runs tests in a cloud workspace. You review the PR.</p>
      </section>
      <section aria-labelledby="budget-your-agents">
        <span className={styles.number}>03</span>
        <Heading as="h3" id="budget-your-agents">Put a budget on your agents.</Heading>
        <p>Set a limit on Moyai's LiteLLM key. Track model spend by teammate, session, and model. Keep provider keys on the gateway.</p>
      </section>
    </div>
  );
}

export function GuideButtons() {
  return (
    <nav className={styles.guides} aria-label="Moyai guides">
      <Link to={`${root}/setup`} className={styles.primary}>
        <Terminal size={20} aria-hidden="true" />Setup<ArrowRight size={18} aria-hidden="true" />
      </Link>
      <Link to={`${root}/architecture`} className={styles.secondary}>
        <Network size={20} aria-hidden="true" />Architecture<ArrowRight size={18} aria-hidden="true" />
      </Link>
    </nav>
  );
}
