import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CloudWorkstationHero from '@site/blog/internal-devin-two-days/CloudWorkstationHero';
import styles from './styles.module.css';

const root = '/docs/self_hosted_coding_agents/moyai';

export function GuideNav({active}) {
  return (
    <nav className={styles.nav} aria-label="Moyai guides">
      {[
        ['overview', '', 'Why Moyai'],
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

export function Benefits() {
  return (
    <div className={styles.benefits}>
      <section>
        <span className={styles.number}>01 / Keep work moving</span>
        <h3>Close your laptop. Follow the task in Slack.</h3>
        <p>Run code, tests, and a browser on a cloud machine. Return to the chat to inspect activity, review files, or ask for a follow-up.</p>
      </section>
      <section>
        <span className={styles.number}>02 / Choose your stack</span>
        <h3>Your harness, model, and cloud account.</h3>
        <p>Use Codex, Claude Agent SDK, Hermes, or another supported harness. Route compatible models through LiteLLM and keep provider keys on the gateway.</p>
      </section>
      <section>
        <span className={styles.number}>03 / Make costs visible</span>
        <h3>See who spent what on each task.</h3>
        <p>Set a budget on Moyai's gateway key. Inspect model costs by teammate, session, and model, and trace requests in LiteLLM logs.</p>
      </section>
      <section>
        <span className={styles.number}>04 / Keep your workflow</span>
        <h3>Bring the tools your team uses.</h3>
        <p>Connect GitHub, Slack, Linear, and Notion. Save team instructions as skills and split independent work across agents.</p>
      </section>
    </div>
  );
}
