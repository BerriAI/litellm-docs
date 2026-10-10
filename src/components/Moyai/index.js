import React from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {ArrowRight, GitPullRequest, MessageSquare, Network, Terminal} from 'lucide-react';
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

export function MoyaiHero() {
  const moyaiLogo = useBaseUrl('/img/blog/moyai_devin_open_source/moyai-head.svg');

  return (
    <header className={styles.hero}>
      <h1>Moyai</h1>
      <p className={styles.tagline}>Run open source coding agents in your cloud.</p>
      <figure className={styles.workflow} aria-label="Send a task from Slack or the browser. Moyai works in the cloud and returns a pull request. LiteLLM supplies models and records their costs.">
        <div className={styles.workflowSteps}>
          <div className={styles.workflowStep}>
            <span className={styles.workflowIcon}><MessageSquare size={25} aria-hidden="true" /></span>
            <strong>Your task</strong>
            <span>Slack or browser</span>
          </div>
          <ArrowRight className={styles.workflowArrow} size={26} aria-hidden="true" />
          <div className={styles.cloudWorkspace}>
            <img src={moyaiLogo} alt="" width="48" height="60" />
            <div><strong>Moyai</strong><span>Your cloud workspace</span></div>
            <p>Edit code <span aria-hidden="true">·</span> Run tests <span aria-hidden="true">·</span> Use tools</p>
          </div>
          <ArrowRight className={styles.workflowArrow} size={26} aria-hidden="true" />
          <div className={styles.workflowStep}>
            <span className={styles.workflowIcon}><GitPullRequest size={25} aria-hidden="true" /></span>
            <strong>Your pull request</strong>
            <span>Ready for your review</span>
          </div>
        </div>
        <figcaption className={styles.gatewayLine}>
          <Network size={19} aria-hidden="true" />
          <span><strong>Powered by your LiteLLM gateway</strong><span>Your models. One source of truth for model costs.</span></span>
        </figcaption>
      </figure>
    </header>
  );
}

export function CostComparison() {
  return (
    <section className={styles.cost} aria-label="LiteLLM's estimated cost reduction">
      <div className={styles.costHeadline}>
        <div>
          <p className={styles.kicker}>Our team's cost comparison</p>
          <p className={styles.costTitle}>Choose where your agent budget goes.</p>
          <p className={styles.costIntro}>Run Codex, Claude Agent SDK, or Hermes with a compatible model through LiteLLM. You pay for model usage and hosting.</p>
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
    </section>
  );
}

export function BenefitGrid() {
  return (
    <div className={styles.benefits}>
      <section aria-labelledby="choose-your-stack">
        <span className={styles.number}>01</span>
        <Heading as="h3" id="choose-your-stack">Reduced costs</Heading>
        <p>Choose the agent and model for your budget. Our Moyai estimate is <strong>79% lower</strong> than our team's Devin bill, with model usage and hosting under our control.</p>
        <Link className={styles.proofLink} to="#cost-comparison">See our cost comparison <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="delegate-cloud-work">
        <span className={styles.number}>02</span>
        <Heading as="h3" id="delegate-cloud-work">Run tasks in the cloud</Heading>
        <p>Send a task from Slack or the browser. Close your laptop while Moyai edits code and runs tests. Come back to a pull request to review.</p>
        <Link className={styles.proofLink} to="#watch-a-task">Watch a real bug fix <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="budget-your-agents">
        <span className={styles.number}>03</span>
        <Heading as="h3" id="budget-your-agents">One source of truth for model costs</Heading>
        <p>LiteLLM records the model charges. Moyai uses those same charges for per-user, session, and model breakdowns, so both views add up from the same data.</p>
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
