import React, {useId} from 'react';
import styles from './customer-hierarchy.module.css';

function Member({x, y, compact}) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r="27" className={styles.memberRing} />
    <circle cy="-7" r="6" className={styles.person} />
    <path d="M-12,13 C-12,-1 12,-1 12,13" className={styles.person} />
    <text className={styles.memberLabel} y="58">
      <tspan x="0">Customer</tspan><tspan x="0" dy={compact ? 25 : 20}>member</tspan>
    </text>
  </g>;
}

function Source({x, y}) {
  return <g transform={`translate(${x} ${y})`}>
    <text y="-43" className={styles.sourceLabel}>Your AI agent</text>
    <path d="M-16,-13 L-30,0 L-16,13 M16,-13 L30,0 L16,13 M5,-20 L-5,20" className={styles.agent} />
  </g>;
}

function Gateway({x, y}) {
  return <g transform={`translate(${x} ${y})`}>
    <image href="/img/brand/litellm-logo-white.png" x="-85" y="-17" width="170" height="32" preserveAspectRatio="xMidYMid meet" />
    <text y="50" className={styles.gatewayLabel}>AI Gateway</text>
  </g>;
}

function Team({x, y, name, allowance}) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="-135" y="-100" width="270" height="93" fill="#020304" />
    <text y="-80" className={styles.scopeLabel}>Customer team</text>
    <text y="-47" className={styles.teamName}>{name}</text>
    <text y="-18" className={styles.allowance}>${allowance} / member / month</text>
    <circle r="5" className={styles.junction} />
  </g>;
}

function HierarchyScene({compact, titleId}) {
  const trunk = compact
    ? 'M177,110 H317 M425,136 C560,136 560,345 285,345'
    : 'M150,330 H258 M442,330 H470 C500,330 500,200 540,200 H820';
  const teams = compact
    ? 'M285,345 C285,395 145,380 145,540 M285,345 C285,395 435,380 435,540'
    : 'M820,200 C820,240 650,225 650,340 M820,200 C820,240 1000,225 1000,340';
  const members = compact
    ? 'M145,540 C145,605 75,595 75,663 M145,540 C145,605 195,595 195,663 M435,540 C435,605 385,595 385,663 M435,540 C435,605 505,595 505,663'
    : 'M650,340 C650,390 590,385 590,423 M650,340 C650,390 710,385 710,423 M1000,340 C1000,390 940,385 940,423 M1000,340 C1000,390 1060,385 1060,423';
  const orgX = compact ? 285 : 820;
  const orgY = compact ? 345 : 200;

  return <svg viewBox={compact ? '0 0 580 820' : '0 0 1200 570'} role="img" aria-labelledby={titleId} className={compact ? styles.mobile : styles.desktop}>
    <title id={titleId}>Your AI agent sends requests through LiteLLM AI Gateway. Attribute spend to a customer organization, its Sales and Engineering teams, and their customer members. In this example, Sales members have a $100 monthly profile and Engineering members have a $500 monthly profile.</title>
    <g className={styles.connections}>
      <path d={trunk} /><path d={teams} /><path d={members} />
    </g>
    <g className={styles.traffic} aria-hidden="true">
      <path d={trunk} /><path d={teams} /><path d={members} />
    </g>
    <Source x={compact ? 125 : 105} y={compact ? 110 : 330} />
    <Gateway x={compact ? 425 : 350} y={compact ? 110 : 330} />
    <g transform={`translate(${orgX} ${orgY})`}>
      <text y="-132" className={styles.eyebrow}>YOUR CUSTOMERS</text>
      <text y="-69" className={styles.organizationLabel}>Customer organization</text>
      <text y="-35" className={styles.organizationDetail}>Overall spend and budget</text>
      <circle r="6" className={styles.junction} />
    </g>
    <Team x={compact ? 145 : 650} y={compact ? 540 : 340} name="Sales" allowance={100} />
    <Team x={compact ? 435 : 1000} y={compact ? 540 : 340} name="Engineering" allowance={500} />
    {(compact ? [75, 195, 385, 505] : [590, 710, 940, 1060]).map(x => <Member key={x} x={x} y={compact ? 690 : 450} compact={compact} />)}
  </svg>;
}

export default function CustomerHierarchy() {
  const id = useId().replace(/:/g, '');
  return <figure data-full-width className={styles.figure}>
    <HierarchyScene titleId={`customer-hierarchy-${id}-desktop`} />
    <HierarchyScene compact titleId={`customer-hierarchy-${id}-mobile`} />
    <figcaption>Example member profiles: $100 per month for Sales, $500 for Engineering. Each member's usage also counts toward its customer team and customer organization.</figcaption>
  </figure>;
}

export function CustomerBudgetAlert() {
  return <figure data-full-width className={`${styles.figure} ${styles.alertFigure}`}>
    <div className={styles.alertPreview}>
      <div className={styles.previewLabel}>ILLUSTRATIVE SLACK NOTIFICATION</div>
      <div className={styles.channel}># customer-budget-alerts</div>
      <div className={styles.message}>
        <div className={styles.messageSource}>Your billing service</div>
        <div className={styles.messageBody}>
          <p className={styles.messageTitle}>Customer member budget alert</p>
          <p className={styles.profile}>Default member profile · Monthly budget</p>
          <div className={styles.spend}><strong>$80</strong><span>of $100</span></div>
          <meter min="0" max="100" value="80" aria-label="Customer member has spent $80 of a $100 monthly budget" className={styles.spendMeter}>80%</meter>
          <p className={styles.threshold}>80% soft threshold reached</p>
        </div>
      </div>
      <div className={styles.workflow} aria-label="The budget webhook reaches your workflow, which can notify your team or request a budget increase review.">
        <span>Budget webhook</span><span aria-hidden="true">→</span><span>Your workflow</span><span aria-hidden="true">→</span><span>Notify or review an increase</span>
      </div>
    </div>
    <figcaption>Illustrative Slack message your webhook receiver can send. LiteLLM sends a JSON budget event; your workflow formats the notification and handles any budget change.</figcaption>
  </figure>;
}
