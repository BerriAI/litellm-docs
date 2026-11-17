import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const examples = [
  {
    label: 'Supported answer',
    question: 'How much can I spend on my home office?',
    document: 'Home office equipment policy',
    sourceId: 'home-office',
    amount: '$500',
    evidence: 'Employees receive a one-time home office equipment allowance of $500. Submit receipts within 30 days of purchase.',
    answer: <>You receive a one-time home office allowance of <mark>$500</mark>. Submit your receipts within 30 days of purchase.</>,
    supported: true,
    reason: 'The policy supports the allowance and receipt deadline.',
  },
  {
    label: 'Unsupported answer',
    question: 'Do we get unlimited remote work?',
    document: 'Remote work handbook',
    sourceId: 'remote-work',
    amount: '3 days',
    evidence: 'Employees can work remotely up to three days each week.',
    answer: <>You can work remotely <mark>every day with no limit</mark>. Office attendance is optional.</>,
    supported: false,
    reason: 'The handbook allows up to three remote days per week.',
  },
];

function CheckIcon({supported = true}) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={supported ? 'm5 12 4 4L19 6' : 'm7 7 10 10m0-10L7 17'} /></svg>;
}

function GuardrailGraphic() {
  return <svg className={styles.gate} viewBox="0 0 280 230" fill="none" aria-hidden="true">
    <path className={styles.gateGuide} d="M0 55h280M0 175h280M80 0v230M200 0v230" />
    <path className={styles.gateStream} d="M0 115h78M202 115h78M0 85h52l28 30m120 0 28 30h52M0 145h52l28-30m120 0 28-30h52" />
    <g className={styles.gateFrame}><ellipse cx="129" cy="115" rx="40" ry="76" /><ellipse cx="140" cy="115" rx="40" ry="76" /><ellipse cx="151" cy="115" rx="40" ry="76" /><path d="M129 39h22m-22 152h22M89 115h102" /></g>
    <path className={styles.gateCheck} d="m123 115 12 12 24-29" />
    {[76, 115, 154].map((y) => <g key={y} className={styles.gateParticles}><circle cx="38" cy={y} r="2" /><circle cx="242" cy={y} r="2" /></g>)}
    <text x="140" y="18" textAnchor="middle">ANSWER + EVIDENCE</text><text x="140" y="220" textAnchor="middle">YOUR GUARDRAIL</text>
  </svg>;
}

function GroundingHero() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const example = examples[selected];
  return <header className={styles.hero}>
    <div className={styles.heroInner}>
      <div className={styles.heroNav}>
        <div className={styles.brand}><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="150" height="36" /><span>/ AGENTS</span></div>
        <Link to="/blog">Back to the blog <span aria-hidden="true">↗</span></Link>
      </div>
      <div className={styles.heroMeta}><span><i aria-hidden="true" /> A DEVELOPER GUIDE BY LITELLM</span><span>PYTHON SDK / OCTOBER 2026</span></div>
      <h1 className={styles.heroTitle}><span>BUILD AN AGENT WITH</span><strong>GROUNDING<svg className={styles.heroArrow} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M10 90 90 10M37 10h53v53" /></svg></strong></h1>
      <div className={styles.heroIntro}>
        <p>Grounding checks whether an answer is supported<br className={styles.desktopBreak} /> by the documents you give it.</p>
        <a className={styles.startLink} href="#step-1-connect-to-your-gateway">Start building <span aria-hidden="true">↗</span></a>
      </div>
      <div className={styles.heroStage} data-playing={playing} data-supported={example.supported}>
        <div className={styles.sourcePanel}>
          <span className={styles.stageLabel}>01 / YOUR EVIDENCE</span>
          <svg className={styles.documentIcon} viewBox="0 0 58 66" fill="none" aria-hidden="true"><path d="M34 3H7v60h44V20L34 3Zm0 0v18h17M17 33h23M17 43h23M17 53h15" /></svg>
          <span className={styles.sourceAmount}>{example.amount}</span>
          <strong>{example.document}</strong><p>{example.evidence}</p>
          <span className={styles.sourceId}>{example.sourceId}</span>
        </div>
        <div className={styles.gatePanel}><GuardrailGraphic /><span className={styles.gateNative}>native structured findings</span></div>
        <div className={styles.chatPanel}>
          <div className={styles.chatTop}><span><img src="/img/brand/litellm-monogram-blue.svg" alt="" width="20" height="20" /> WORKPLACE ASSISTANT</span><span className={styles.chatExample}>Recorded fixture</span></div>
          <div className={styles.chatQuestion}>{example.question}</div>
          <div className={styles.chatAnswer}><span className={styles.assistantName}>YOUR AGENT</span><p>{example.answer}</p></div>
          <div className={styles.heroVerdict} key={selected} role="status" aria-live="polite"><CheckIcon supported={example.supported} /><div><strong>{example.supported ? 'Grounded in your documents' : 'Not supported by your documents'}</strong><p>{example.reason}</p><span>source_ids: ["{example.sourceId}"]</span></div><code>{example.supported ? 'true' : 'false'}</code></div>
        </div>
      </div>
      <div className={styles.heroFoot}>
        <div className={styles.exampleSwitch} role="group" aria-label="Recorded grounding example">{examples.map((item, index) => <button type="button" key={item.label} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}<span aria-hidden="true">↗</span></button>)}</div>
        <div className={styles.motionControl}><span>RECORDED FIXTURE / NO MODEL CALLS</span><button type="button" aria-pressed={!playing} onClick={() => setPlaying(!playing)}>{playing ? 'Pause motion' : 'Play motion'}</button></div>
      </div>
    </div>
  </header>;
}

export function VerdictStates() {
  return <div className={styles.verdictStates} aria-label="Three grounding states in your product">
    <div data-status="grounded"><span>01 / SUPPORTED</span><strong>Grounded</strong><p>Show the source and the check's explanation.</p><code>is_grounded: true</code></div>
    <div data-status="unsupported"><span>02 / UNSUPPORTED</span><strong>Not supported</strong><p>Explain the gap or ask the agent to retry.</p><code>is_grounded: false</code></div>
    <div data-status="unavailable"><span>03 / CHECK FAILED</span><strong>Unavailable</strong><p>Keep this separate from a completed check.</p><code>no valid verdict</code></div>
  </div>;
}

export default function GroundedPage({children}) {
  return <div className={styles.root} data-full-width>
    <GroundingHero />
    <nav className={styles.tutorialNav} aria-label="Four tutorial steps">
      <a href="#step-1-connect-to-your-gateway"><span>01</span>Connect your gateway<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></a>
      <a href="#step-2-retrieve-the-evidence"><span>02</span>Retrieve evidence<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></a>
      <a href="#step-3-generate-and-check-the-answer"><span>03</span>Generate and check<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></a>
      <a href="#step-4-show-the-result-in-chat"><span>04</span>Show the verdict<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></a>
    </nav>
    <div className={styles.article}><div className={styles.byline}><PostByline horizontal /></div><div className={styles.content}>{children}</div></div>
  </div>;
}
