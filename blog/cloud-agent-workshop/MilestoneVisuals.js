import React from 'react';
import {LiteLLMLogo, WorkshopImage} from './Workshop';
import styles from './styles.module.css';

function Icon({name, size = 18, className}) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    brief: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 15h6" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" /></>,
    monitor: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8m-4-5v5" /></>,
    down: <path d="M12 3v18m-6-6 6 6 6-6" />,
    right: <path d="M3 12h18m-6-6 6 6-6 6" />,
    left: <path d="M21 12H3m6-6-6 6 6 6" />,
    both: <path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4" />,
    cloud: <path d="M6 18a4 4 0 0 1-.3-8 6.5 6.5 0 0 1 12.5-1.5A4.8 4.8 0 0 1 18 18H6Z" />,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" /></>,
    trace: <><path d="M5 3v16h5M5 7h5" /><rect x="10" y="4" width="10" height="6" rx="1" /><rect x="10" y="16" width="10" height="6" rx="1" /></>,
    users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5v1" /></>,
  };
  return <svg className={className} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Visual({label, title, icon, badge, children}) {
  return <figure className={styles.visual} aria-label={label}>
    <figcaption className={styles.visualHeading}><Icon name={icon} size={17} /><span>{title}</span>{badge && <span className={styles.visualBadge}>{badge}</span>}</figcaption>
    {children}
  </figure>;
}

export function IntakeVisual() {
  return <Visual label="The intake produces a build brief covering your use case, stack, and success criteria." title="Your build brief" icon="brief" badge="Intake">
    {[
      ['Use case', 'The first workflow to build'],
      ['Stack', 'Providers, sandbox, and cloud'],
      ['Success criteria', 'What a useful v0 needs to do'],
    ].map(([title, text]) => <div className={styles.briefRow} key={title}><Icon name="check" size={15} /><div><strong>{title}</strong><span>{text}</span></div></div>)}
  </Visual>;
}

export function BuildVisual() {
  return <Visual label="A web app and Slack connect to an agent harness running inside a sandbox, powered by LiteLLM." title="Your working v0" icon="code">
    <div className={styles.clients}><div><Icon name="monitor" size={15} />Web app</div><div><WorkshopImage file="slack.svg" alt="" width="15" height="15" />Slack</div></div>
    <div className={styles.join}><Icon name="down" size={15} /></div>
    <div className={styles.sandbox}><span className={styles.sandboxLabel}>Sandbox</span><div className={styles.harnessModule}><Icon name="code" size={17} /><span>Agent harness</span></div></div>
    <div className={styles.powered}><span>Powered by</span><LiteLLMLogo width="72" height="14" /></div>
  </Visual>;
}

export function BetaVisual() {
  return <Visual label="Deploy to your cloud, run internal tasks, review traces, and improve the agent in an internal beta." title="Internal beta" icon="cloud" badge="Your cloud">
    <div className={styles.betaFlow}>
      <div className={styles.flowStep}><Icon name="cloud" /><strong>Deploy</strong></div>
      <Icon className={styles.flowArrow} name="right" size={17} />
      <div className={styles.flowStep}><Icon name="play" /><strong>Run tasks</strong></div>
      <div className={styles.flowTurn}><Icon name="down" size={17} /></div>
      <div className={styles.flowStep}><Icon name="refresh" /><strong>Improve</strong></div>
      <Icon className={styles.flowArrow} name="left" size={17} />
      <div className={styles.flowStep}><Icon name="trace" /><strong>Review traces</strong></div>
    </div>
    <p className={styles.visualCaption}>Test with your team’s real workflows.</p>
  </Visual>;
}

export function SupportVisual() {
  return <Visual label="Your team and the LiteLLM team continue reviewing feedback and planning improvements together." title="Keep building together" icon="users">
    <div className={styles.collaboration}>
      <div className={styles.visualTeam}><span className={styles.teamIcon}><Icon name="users" size={22} /></span><strong>Your team</strong></div>
      <Icon className={styles.teamArrow} name="both" size={26} />
      <div className={styles.visualTeam}><span className={`${styles.teamIcon} ${styles.brandIcon}`}><LiteLLMLogo width="73" height="14" /></span><strong>LiteLLM team</strong></div>
    </div>
    <div className={styles.supportNotes}><span><Icon name="check" size={13} />Review feedback</span><span><Icon name="right" size={13} />Next improvements</span></div>
  </Visual>;
}
