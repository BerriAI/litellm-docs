import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SignupButton from './SignupButton';
import styles from './styles.module.css';

const assetPath = '/img/cloud-agent-workshop/';

export function WorkshopImage({file, ...props}) {
  return <img src={useBaseUrl(`${assetPath}${file}`)} {...props} />;
}

export function LiteLLMLogo({className = '', ...props}) {
  const blueLogo = useBaseUrl('/img/brand/litellm-logo-blue.png');
  const whiteLogo = useBaseUrl('/img/brand/litellm-logo-white.png');
  return <>
    <img src={blueLogo} alt="LiteLLM" className={`${className} ${styles.brandLight}`} {...props} />
    <img src={whiteLogo} alt="LiteLLM" className={`${className} ${styles.brandDark}`} {...props} />
  </>;
}

export function WorkshopShell({children}) {
  return <div className={styles.workshop}>{children}</div>;
}

export function WorkshopHero() {
  const agents = [
    ['Claude Code', 'claude-code.svg'],
    ['Codex', 'codex.svg'],
    ['Hermes', 'hermes-agent.svg'],
    ['OpenClaw', 'openclaw-static.svg'],
  ];
  return <section className={styles.hero} aria-labelledby="workshop-title">
    <div className={styles.brandRow}>
      <LiteLLMLogo className={styles.logo} width="174" height="33" />
      <Link to="/blog" className={styles.backLink}>← Blog</Link>
    </div>
    <h1 id="workshop-title">Workshop: Build a<br className={styles.titleBreak} /> self-hosted cloud agent.</h1>
    <p className={styles.heroLead}>Build and deploy with the LiteLLM team, on infrastructure your team controls.</p>
    <div className={styles.heroActions}>
      <SignupButton className={styles.signup} />
      <p className={styles.facts}>Remote <span aria-hidden="true">·</span> 2 weeks <span aria-hidden="true">·</span> October 19–30, 2026</p>
    </div>
    <div className={styles.harnessRow}>
      <p>Work with your preferred agent</p>
      <div className={styles.harnesses} aria-label="Agent options">
        {agents.map(([name, file]) => <div className={styles.harness} key={name}>
          <WorkshopImage file={file} className={file === 'hermes-agent.svg' ? styles.monochromeHarness : undefined} alt="" width="26" height="26" />
          <span>{name}</span>
        </div>)}
      </div>
    </div>
    <figure className={styles.blueprint}>
      <div className={styles.blueprintFrame}>
        <WorkshopImage file="blueprint.png" className={styles.blueprintImage} alt="A Slack request reaches an agent harness and sandbox in your cloud, then produces a pull request." width="1254" height="1254" fetchPriority="high" />
        <WorkshopImage file="slack.svg" className={styles.blueprintSlack} alt="" width="51" height="51" />
      </div>
    </figure>
    <div className={styles.heroActions}>
      <SignupButton className={styles.signup} />
    </div>
  </section>;
}

export function AudienceTeams() {
  const teams = [
    ['AI platform teams', 'Build around your model providers, sandboxes, and cloud infrastructure.'],
    ['Developer productivity teams', 'Give engineers an internal agent for coding tasks and pull requests.'],
    ['Agent platform teams', 'Run your chosen harnesses in a platform your team operates.'],
  ];
  return <div className={styles.teams}>
    {teams.map(([title, text], index) => <article className={styles.team} key={title}>
      <span className={styles.teamNumber}>0{index + 1}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>)}
  </div>;
}

export function Timeline({children}) {
  return <ol className={styles.timeline}>{children}</ol>;
}

export function Milestone({number, id, stage, date, visual, children}) {
  return <li className={styles.timelineItem}>
    <span className={styles.timelineNode} aria-hidden="true">{number}</span>
    <section className={styles.milestone} id={id} aria-label={`${stage}: ${date}`}>
      <div className={styles.milestoneCopy}>
        <p className={styles.milestoneMeta}><span>{stage}</span><span>{date}</span></p>
        {children}
      </div>
      {visual}
    </section>
  </li>;
}

export function Result({label, children}) {
  return <div className={styles.result}><span>{label}</span><p>{children}</p></div>;
}

export function Closing() {
  return <section className={styles.closing} aria-labelledby="closing-title">
    <div>
      <h2 id="closing-title">Build with the LiteLLM team.</h2>
      <p>Remote for two weeks. Want us at your office for several days? Tell us in the signup form.</p>
      <p className={styles.signupNote}>Tell us what you hope to achieve. We’ll follow up to arrange a 30-minute intake.</p>
    </div>
    <SignupButton className={styles.signup} />
  </section>;
}
