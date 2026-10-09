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
          <h1>Cut the cost of cloud coding agents.</h1>
          <p className={styles.costIntro}>Run Codex, Claude Agent SDK, or Hermes on your own infrastructure. Choose your models through LiteLLM and pay for model usage and hosting.</p>
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
          Our Devin bill was $101,872 for 31 days. We estimate about $700/day for Moyai, or $21,700 over the same period. This is our internal comparison,
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
        <p>Choose Codex, Claude Agent SDK, Hermes, or another supported agent. Pick a compatible model through LiteLLM to fit the task and your budget.</p>
        <Link className={styles.proofLink} to={`${root}/setup#configure-litellm`}>See supported agents and models <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="delegate-cloud-work">
        <span className={styles.number}>02</span>
        <Heading as="h3" id="delegate-cloud-work">Close your laptop. Come back to a pull request.</Heading>
        <p>Send a task from Slack or the browser, then step away. Moyai edits code and runs tests in a cloud workspace. You review the pull request.</p>
        <Link className={styles.proofLink} to="#watch-a-task">Watch a real bug fix <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="budget-your-agents">
        <span className={styles.number}>03</span>
        <Heading as="h3" id="budget-your-agents">One source of truth for model costs.</Heading>
        <p>See who spent what, on which session and model. Moyai adds up LiteLLM's reported charges, so both views use the same cost data.</p>
        <Link className={styles.proofLink} to="#see-agent-spend">See the spend breakdown <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}

export function GuideCards() {
  return (
    <nav className={styles.guides} aria-label="Moyai guides">
      <Link to={`${root}/setup`} className={styles.guideCard}>
        <Terminal size={26} aria-hidden="true" />
        <div><h3>Setup</h3><p>Deploy Moyai. Run your first cloud task.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
      <Link to={`${root}/architecture`} className={styles.guideCard}>
        <Network size={26} aria-hidden="true" />
        <div><h3>Architecture</h3><p>Explore sandboxes, checkpoints, and recovery.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
    </nav>
  );
}

export function SetupCallout() {
  return (
    <section className={styles.setupCallout} aria-labelledby="try-moyai">
      <div>
        <Heading as="h2" id="try-moyai">Run your first cloud task.</Heading>
        <p>Connect your gateway, verify a task, then give Moyai a small repository change. Review the work and its cost before rolling it out to your team.</p>
      </div>
      <Link className={styles.setupButton} to={`${root}/setup`}>Set up Moyai <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
  );
}
