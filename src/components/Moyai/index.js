import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';
import {ArrowDown, ArrowRight, GitPullRequest, Network, Terminal} from 'lucide-react';
import CloudWorkstationHero from '@site/blog/internal-devin-two-days/CloudWorkstationHero';
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
  const [paused, setPaused] = useState(false);
  return (
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Moyai / Open source cloud coding agent</p>
      <h1>Run coding tasks in your cloud.<br />Review the pull request.</h1>
      <p className={styles.intro}>
        Give Moyai a task in Slack or your browser. It works in a cloud workspace,
        edits code, runs tests, and opens a PR. Choose the agent harness and model
        through your LiteLLM gateway.
      </p>
      <div className={styles.actions}>
        <Link className={styles.primary} to={`${root}/setup`}>Set up Moyai</Link>
        <Link className={styles.secondary} to="#watch-a-task">Watch a task</Link>
        <Link className={styles.source} to="https://github.com/BerriAI/moyai">View source</Link>
      </div>
      <div className={styles.artwork}>
        <CloudWorkstationHero paused={paused} setPaused={setPaused}
          caption="LiteLLM's deployment uses Render and Temporal. The setup guide starts with Modal."
          title="Moyai illustration: Slack and web tasks, a cloud workspace, and parallel agents; Render and Temporal power LiteLLM's deployment"
        />
      </div>
    </header>
  );
}

export function GuideCards() {
  return (
    <nav className={styles.guides} aria-label="Moyai guides">
      <Link to={`${root}/setup`} className={styles.guideCard}>
        <Terminal size={26} aria-hidden="true" />
        <div><h2>Setup</h2><p>Deploy Moyai. Run your first cloud task.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
      <Link to={`${root}/architecture`} className={styles.guideCard}>
        <Network size={26} aria-hidden="true" />
        <div><h2>Architecture</h2><p>Explore sandboxes, checkpoints, and recovery.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
    </nav>
  );
}

export function CostProof() {
  return (
    <section className={styles.cost} aria-labelledby="lower-agent-costs">
      <div className={styles.costHeadline}>
        <div>
          <span className={styles.kicker}>01 / Lower your agent bill</span>
          <Heading as="h3" id="lower-agent-costs">We built Moyai after a $101,872 month on Devin.</Heading>
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
      <div className={styles.budget}>
        <div><strong>Put a budget on your agents.</strong><p>Set a limit on Moyai's LiteLLM key. Track model spend by teammate, session, and model.</p></div>
        <Link to={`${root}/setup#track-spend`}>Set up spend tracking <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

function Logo({file, label}) {
  const source = useBaseUrl(`/img/blog/moyai_devin_open_source/logos/${file}`);
  return <span className={styles.logo}><img src={source} alt="" loading="lazy" width="22" height="22" />{label}</span>;
}

export function ModelChoice() {
  return (
    <section className={styles.modelChoice} aria-labelledby="choose-your-stack">
      <div className={styles.featureCopy}>
        <span className={styles.kicker}>02 / Choose your stack</span>
        <Heading as="h3" id="choose-your-stack">Run the agent and model you want.</Heading>
        <p>Choose Codex, Claude Agent SDK, Hermes, or another supported harness for each session. Route compatible models through your LiteLLM gateway.</p>
        <p>Keep your provider accounts and negotiated rates. Store provider keys on the gateway, outside the agent sandbox.</p>
        <Link to={`${root}/setup#configure-litellm`}>Connect your models <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <figure className={styles.stack}>
        <div className={styles.stackLayer}>
          <span className={styles.stackLabel}>Your agent harness</span>
          <div className={styles.logos}>
            <Logo file="openai.svg" label="Codex" />
            <Logo file="anthropic.svg" label="Claude Agent SDK" />
            <Logo file="hermes.png" label="Hermes" />
            <Logo file="opencode.svg" label="OpenCode" />
          </div>
        </div>
        <ArrowDown className={styles.stackArrow} size={24} aria-hidden="true" />
        <div className={styles.gateway}>Your LiteLLM gateway</div>
        <ArrowDown className={styles.stackArrow} size={24} aria-hidden="true" />
        <div className={styles.stackLayer}>
          <span className={styles.stackLabel}>Your model providers</span>
          <div className={styles.logos}>
            <Logo file="openai.svg" label="OpenAI" />
            <Logo file="anthropic.svg" label="Anthropic" />
            <Logo file="google.svg" label="Gemini" />
          </div>
        </div>
        <figcaption>Choose a model that supports your harness's API.</figcaption>
      </figure>
    </section>
  );
}

export function CloudWork({children}) {
  return (
    <section className={styles.cloudWork} aria-labelledby="watch-a-task">
      <span className={styles.kicker}>03 / Delegate the work</span>
      <Heading as="h3" id="watch-a-task">Close your laptop.<br />Come back to a pull request.</Heading>
      <p>Give Moyai a task in Slack or the browser. It edits code, runs tests, and uses a browser in a cloud workspace. Follow its progress or send a correction from the same conversation.</p>
      <div className={styles.workflow} aria-label="Task workflow">
        <span>Send a task</span><ArrowRight size={20} aria-hidden="true" />
        <span>Run it in your cloud</span><ArrowRight size={20} aria-hidden="true" />
        <span><GitPullRequest size={18} aria-hidden="true" />Review the PR</span>
      </div>
      {children}
      <p className={styles.workflowNote}>Connect GitHub, Slack, Linear, and Notion. Add your team's instructions as skills, and split independent work across agents. You review the code and test results before merging.</p>
    </section>
  );
}

export function StartCard() {
  return (
    <section className={styles.start} aria-labelledby="prerequisites">
      <div>
        <span className={styles.kicker}>Start with one task</span>
        <Heading as="h2" id="prerequisites">Give Moyai a place to work.</Heading>
        <p>Bring a Modal account, a reachable LiteLLM gateway, and a key for your chosen model. Deploy Moyai, run a cloud task, then connect your repository.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} to={`${root}/setup`}>Set up Moyai <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link className={styles.source} to="https://github.com/BerriAI/moyai">Explore the source</Link>
        </div>
      </div>
    </section>
  );
}
