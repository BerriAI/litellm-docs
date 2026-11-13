import React from 'react';
import styles from './customer-hierarchy.module.css';

export function CostComplexity() {
  return <figure data-full-width className={`${styles.figure} ${styles.complexityFigure}`}>
    <div className={styles.formula} aria-label="Models multiplied by providers multiplied by parameters">
      {['Models', 'Providers', 'Parameters'].map((label, index) => <React.Fragment key={label}>
        {index > 0 && <span className={styles.multiply} aria-hidden="true">×</span>}
        <div className={styles.factor}>
          <span className={styles.factorLabel}>{label}</span>
          <span className={`${styles.combinations} ${index === 2 ? styles.manyCombinations : ''}`} aria-hidden="true">
            {Array.from({length: 3 ** (index + 1)}, (_, dot) => <i key={dot} />)}
          </span>
        </div>
      </React.Fragment>)}
    </div>
    <figcaption>More combinations of model rates, provider pricing, and request settings to account for.</figcaption>
  </figure>;
}

const MARGIN_STAGES = {
  uncontrolled: {
    title: 'Before customer budgets',
    charge: 100,
    cost: 140,
    contribution: -40,
    costLabel: 'AI model cost / member',
    note: "Your customer's model usage costs more than you charge.",
  },
  budget: {
    title: 'With LiteLLM customer budgets',
    charge: 100,
    cost: 60,
    contribution: 40,
    costLabel: 'AI cost cap / member',
    note: "Pause new requests after the member's recorded spend reaches the $60 budget.",
  },
  increase: {
    title: 'After an approved increase',
    charge: 150,
    cost: 90,
    contribution: 60,
    costLabel: 'AI cost cap / member',
    note: 'Your app sets the $150/month member plan; you approve a temporary $90 cap.',
  },
};

/** @param {{stage: 'uncontrolled' | 'budget' | 'increase'}} props */
export function CustomerMargin({stage = 'uncontrolled'}) {
  const example = MARGIN_STAGES[stage];
  const controlled = stage !== 'uncontrolled';
  return <figure data-full-width className={`${styles.figure} ${styles.marginFigure}`}>
    <div className={styles.marginEyebrow}>
      <div className={styles.previewLabel}>ILLUSTRATIVE MODEL COSTS</div>
      {controlled && <img src="/img/brand/litellm-logo-white.png" width="106" height="20" alt="LiteLLM" className={styles.marginLogo} />}
    </div>
    <div className={styles.marginTitle}>{example.title}</div>
    <div className={styles.scopeLine}>{controlled ? 'Customer organization → Customer team → Customer member' : 'Customer revenue and model spend'}</div>
    <div className={styles.comparison}>
      <div className={styles.comparisonRow}>
        <span>You charge / member</span>
        <strong>${example.charge}</strong>
        <div className={styles.barTrack} aria-hidden="true"><div className={styles.revenueBar} style={{width: `${example.charge / 150 * 100}%`}} /></div>
      </div>
      <div className={styles.comparisonRow}>
        <span>{example.costLabel}</span>
        <strong>${example.cost}</strong>
        <div className={styles.barTrack} aria-hidden="true">
          <div className={controlled ? styles.budgetBar : styles.costBar} style={{width: `${example.cost / 150 * 100}%`}} />
          {!controlled && <div className={styles.overrunBar} style={{left: `${example.charge / 150 * 100}%`, width: `${(example.cost - example.charge) / 150 * 100}%`}} />}
        </div>
      </div>
      <div className={`${styles.contribution} ${controlled ? styles.positive : styles.negative}`}>
        <span>Contribution before other costs</span>
        <strong>{example.contribution < 0 ? '−' : ''}${Math.abs(example.contribution)}</strong>
      </div>
    </div>
    <p className={styles.marginNote}>{example.note}</p>
    <figcaption>Illustrative revenue minus AI model cost, before other expenses.</figcaption>
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
          <div className={styles.spend}><strong>$48</strong><span>of $60</span></div>
          <meter min="0" max="60" value="48" aria-label="Customer member has spent $48 of a $60 monthly budget" className={styles.spendMeter}>80%</meter>
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
