import React, {useState} from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import workspace from './workspace.png';
import styles from './styles.module.css';

const sections = [
  ['1-main-architecture', 'Main architecture'],
  ['2-main-challenges', 'Main challenges'],
  ['3-whats-next-and-what-id-recommend', "What's next"],
];

const workers = [
  {y: 140, label: 'Cases 1–20', color: '#8b5cf6'},
  {y: 240, label: 'Cases 21–40', color: '#27b6e8'},
  {y: 340, label: 'Cases 41–60', color: '#e3a42b'},
  {y: 440, label: 'Cases 61–80', color: '#ec6f93'},
  {y: 540, label: 'Cases 81–100', color: '#2aa889'},
];

function Flow({path, color, reverse = false}) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={path} className={styles.track} />
      <path d={path} stroke={color} className={`${styles.particles} ${reverse ? styles.returning : ''}`} />
    </g>
  );
}

function AgentFlow() {
  return (
    <svg className={styles.flow} viewBox="0 0 1400 720" aria-hidden="true">
      <g className={styles.field}>
        {Array.from({length: 180}, (_, i) => (
          <circle key={i} cx={24 + (i * 83) % 1360} cy={22 + (i * 137) % 678}
            r={i % 4 === 0 ? 1.7 : 1.1} />
        ))}
      </g>
      <Flow path="M 92 234 C 158 234 164 326 244 326" color="#8b5cf6" />
      <Flow path="M 92 438 C 158 438 164 354 244 354" color="#27b6e8" />
      {workers.map(worker => (
        <Flow key={worker.y} path={`M 1095 340 C 1158 340 1150 ${worker.y} 1224 ${worker.y}`} color={worker.color} />
      ))}
      <Flow path="M 1236 562 C 1236 675 742 687 690 604" color="#0017b7" reverse />
      {['Slack', 'Web'].map((name, i) => (
        <g key={name} transform={`translate(64 ${i ? 438 : 234})`}>
          <circle r="26" className={styles.endpoint} />
          <circle r="5" fill={i ? '#27b6e8' : '#8b5cf6'} />
          <text y="51" className={styles.sourceLabel}>{name}</text>
        </g>
      ))}
      {workers.map((worker, i) => (
        <g key={worker.y} transform={`translate(1250 ${worker.y})`}>
          <circle r="24" className={styles.endpoint} />
          <circle r="5" fill={worker.color} />
          <text x="39" y="-3" className={styles.workerLabel}>Agent {i + 1}</text>
          <text x="39" y="18" className={styles.caseLabel}>{worker.label}</text>
        </g>
      ))}
      <text x="170" y="131" className={styles.groupLabel} textAnchor="middle">Start a conversation</text>
      <text x="1215" y="64" className={styles.groupLabel} textAnchor="middle">Isolated workspaces</text>
      <text x="960" y="695" className={styles.returnLabel} textAnchor="middle">Results return to the same session</text>
    </svg>
  );
}

export default function MoyaiHero() {
  const {metadata} = useBlogPost();
  const [paused, setPaused] = useState(false);
  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heading}>
          <time className={styles.date} dateTime="2026-10-01">October 1, 2026</time>
          <h1 className={styles.title}>{metadata.title}</h1>
          <p className={styles.subtitle}>An engineering agent our team can use from Slack or the web.</p>
        </div>
        <figure className={styles.product} data-paused={paused}>
          <div className={styles.stage}>
            <AgentFlow />
            <div className={styles.sessionLabel}>Moyai Devin<span>One shared session</span></div>
            <div className={styles.window}>
              <img src={workspace} width="2400" height="1350" loading="eager"
                alt="Moyai Devin's web interface with a chat, five worker sessions in the sidebar, and tool activity." />
            </div>
          </div>
          <figcaption>
            <span>Slack or web → Moyai Devin → five worker agents. Example session.</span>
            <button className={styles.motionToggle} onClick={() => setPaused(!paused)}
              aria-pressed={paused}>{paused ? 'Play animation' : 'Pause animation'}</button>
          </figcaption>
        </figure>
        <div className={styles.stack} aria-label="The five services">
          <span>Render</span><span>Modal</span><span>Hermes</span><span>Temporal</span><span>LiteLLM</span>
        </div>
      </header>
      <nav className={styles.contents} aria-label="In this post">
        <ol>
          {sections.map(([id, label], index) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span>[{index + 1}]</span>
                <span className={styles.dots} aria-hidden="true" />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
