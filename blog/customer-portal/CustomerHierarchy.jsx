import React, {useEffect, useRef, useState} from 'react';
import styles from './customer-hierarchy.module.css';

function WindowHeader({label, branded = false}) {
  return <div className={styles.windowHeader}>
    <span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span>
    <span>{label}</span>
    {branded && <img src="/img/brand/litellm-logo-white.png" width="80" height="15" alt="LiteLLM" className={styles.windowLogo} />}
  </div>;
}

function FlowLine() {
  return <svg className={styles.windowFlow} viewBox="0 0 640 320" preserveAspectRatio="none" aria-hidden="true">
    <path d="M1,280 V48 Q1,30 20,30 H255" className={styles.flowTrack} />
    <path d="M1,280 V48 Q1,30 20,30 H255" className={styles.flowPacket} pathLength="1" />
  </svg>;
}

export function CostComplexity() {
  return <figure className={styles.figure} data-customer-graphic="complexity">
    <div className={styles.window}>
      <WindowHeader label="B2B agent costs" />
      <FlowLine />
      <div className={styles.complexityBody}>
        <div className={styles.formula} aria-label="Models multiplied by providers multiplied by parameters">
          {['Models', 'Providers', 'Parameters'].map((label, index) => <React.Fragment key={label}>
            {index > 0 && <span className={styles.multiply} aria-hidden="true">×</span>}
            <span className={styles.factorLabel}>{label}</span>
          </React.Fragment>)}
        </div>
      </div>
    </div>
    <figcaption>Model, provider, and parameter combinations add more costs to track.</figcaption>
  </figure>;
}

export function CustomerHierarchyBreakdown() {
  return <figure className={styles.figure} data-customer-graphic="hierarchy">
    <div className={styles.window}>
      <WindowHeader label="Your customer hierarchy" />
      <FlowLine />
      <div className={styles.complexityBody}>
        <div className={styles.customerHierarchy}>
          <span>Customer organization</span><i className={styles.connector} aria-hidden="true" /><span>Customer teams</span><i className={styles.connector} aria-hidden="true" /><span>Customer members</span>
        </div>
      </div>
    </div>
    <figcaption>Track spend and budgets at each level of your customer's organization.</figcaption>
  </figure>;
}

const MARGIN_STAGES = {
  uncontrolled: {
    title: 'Before customer budgets',
    charge: 100,
    cost: 140,
    note: 'AI model cost rises above your price.',
  },
  budget: {
    title: 'With LiteLLM customer budgets',
    charge: 100,
    cost: 60,
    note: 'New requests stop at the $60 cap.',
  },
  increase: {
    title: 'After an approved increase',
    charge: 150,
    cost: 90,
    note: 'Your app charges $150; you approve a temporary $90 cap.',
  },
  workflow: {
    title: 'Budget alert → temporary increase',
    charge: 150,
    cost: 90,
  },
};

function getWorkflowPhase(time) {
  if (time < 2.4) return 'running';
  if (time < 3.2) return 'capped';
  if (time < 5.2) return 'webhook';
  if (time < 6) return 'approved';
  if (time < 8.4) return 'resuming';
  return 'capped_after_increase';
}

export function getCustomerMarginState(stage, elapsed) {
  const example = MARGIN_STAGES[stage];
  const workflow = stage === 'workflow';
  const duration = workflow ? 14 : 10;
  const time = Math.round((((elapsed % duration) + duration) % duration) * 1e9) / 1e9;
  if (workflow) {
    const approved = time >= 5.2;
    const price = approved ? 150 : 100;
    const cap = approved ? 90 : 60;
    const demand = time < 6
      ? 20 + 40 * Math.max(0, Math.min(1, (time - 0.6) / 1.8))
      : 60 + 30 * Math.max(0, Math.min(1, (time - 6) / 2.4));
    const cost = Math.min(cap, Math.floor((demand + 1e-8) / 5) * 5);
    const phase = getWorkflowPhase(time);
    const paused = phase === 'capped' || phase === 'webhook' || phase === 'approved' || phase === 'capped_after_increase';
    const statuses = {
      running: 'Model requests arriving',
      capped: '$60 cap reached · Requests paused',
      webhook: 'Webhook sent · Review the alert',
      approved: 'Increase approved in your product',
      resuming: 'Requests resumed · Temporary $90 cap',
      capped_after_increase: '$90 cap reached · Requests paused',
    };
    return {
      price, cap, cost, paused, phase, approved,
      contribution: price - cost,
      profitMargin: Math.round((price - cost) / price * 1000) / 10,
      eventTriggered: time >= 3.2,
      opacity: time < 0.4 ? time / 0.4 : time > 13.5 ? (14 - time) / 0.5 : 1,
      status: statuses[phase],
    };
  }
  const progress = Math.max(0, Math.min(1, (time - 0.6) / 5.4));
  const demand = 20 + 120 * progress;
  const controlled = stage !== 'uncontrolled';
  const requestedCost = Math.floor((demand + 1e-8) / 5) * 5;
  const cost = controlled ? Math.min(requestedCost, example.cost) : requestedCost;
  const paused = controlled && cost >= example.cost;
  return {
    price: example.charge,
    cap: controlled ? example.cost : null,
    cost,
    contribution: Math.round((example.charge - cost) * 100) / 100,
    profitMargin: Math.round((example.charge - cost) / example.charge * 1000) / 10,
    paused,
    phase: paused ? 'capped' : cost > example.charge ? 'loss' : 'running',
    eventTriggered: false,
    approved: false,
    opacity: time < 0.4 ? time / 0.4 : time > 9.5 ? (10 - time) / 0.5 : 1,
    status: paused ? 'Budget reached · Requests paused' : cost > example.charge ? 'Model cost exceeds your price' : 'Model requests arriving',
  };
}

function useMarginAnimation(elementRef) {
  const [elapsed, setElapsed] = useState(9);
  const [playing, setPlaying] = useState(false);
  const clock = useRef(0);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let animationId;
    let previousTime;
    let lastRender = 0;
    const animate = now => {
      if (previousTime !== undefined) clock.current += Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      if (now - lastRender >= 1000 / 15) {
        setElapsed(clock.current);
        lastRender = now;
      }
      animationId = window.requestAnimationFrame(animate);
    };
    const update = () => {
      window.cancelAnimationFrame(animationId);
      previousTime = undefined;
      const shouldPlay = visible && !document.hidden && !motion.matches;
      setPlaying(shouldPlay);
      if (motion.matches) setElapsed(9);
      if (shouldPlay) animationId = window.requestAnimationFrame(animate);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, {threshold: 0.15});
    observer.observe(elementRef.current);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.cancelAnimationFrame(animationId);
    };
  }, [elementRef]);

  return {elapsed, playing};
}

function SegmentedBar({value, charge, controlled, cost = false}) {
  return <div className={styles.segmentedBar} data-bar={cost ? 'cost' : 'price'} data-value={value} data-active-segments={value / 5} aria-hidden="true">
    {Array.from({length: 30}, (_, index) => <i key={index} className={index * 5 >= value ? styles.emptySegment : cost && !controlled && index * 5 >= charge ? styles.overrunSegment : cost && controlled ? styles.budgetSegment : styles.filledSegment} />)}
  </div>;
}

/** @param {{stage: 'uncontrolled' | 'budget' | 'increase' | 'workflow'}} props */
export function CustomerMargin({stage = 'uncontrolled'}) {
  const figureRef = useRef(null);
  const {elapsed, playing} = useMarginAnimation(figureRef);
  const example = MARGIN_STAGES[stage];
  const controlled = stage !== 'uncontrolled';
  const workflow = stage === 'workflow';
  const state = getCustomerMarginState(stage, elapsed);
  const format = value => Number.isInteger(value) ? value : value.toFixed(1);
  return <figure ref={figureRef} className={styles.figure} data-margin-stage={stage} data-spend={state.cost} data-price={state.price} data-cap={state.cap ?? undefined} data-profit-margin={state.profitMargin} data-contribution={state.contribution} data-phase={state.phase} data-webhook-event={state.eventTriggered ? 'budget_crossed' : undefined} data-approved={state.approved} data-status={state.paused ? 'paused' : state.contribution < 0 ? 'loss' : 'running'} aria-label={workflow ? 'Illustrative budget workflow. At $60 spend, requests pause and LiteLLM sends a budget_crossed event. Your receiver formats the alert. Your app approves a $150 member plan and a temporary $90 cap. Requests resume until $90 spend, leaving 40% profit margin after AI costs, before other expenses.' : `${example.title}. Illustrative monthly price per member: $${example.charge}; final model cost${controlled ? ' cap' : ''}: $${example.cost}; profit margin after AI costs, before other expenses: ${(example.charge - example.cost) / example.charge * 100}%.`}>
    <div className={styles.window} data-playing={playing} data-paused={state.paused} data-workflow={workflow}>
      <WindowHeader label="Per member / month" branded={controlled} />
      <FlowLine />
      <div className={styles.marginBody}>
        <div className={styles.marginTitle}>{example.title}</div>
        <div className={styles.comparison}>
          <div className={styles.chart}>
            <div className={styles.plot}>
              <div className={styles.priceGuide} style={{bottom: `calc(var(--plot-height) * ${state.price / 150})`}} aria-hidden="true" />
              {controlled && <div className={styles.capGuide} style={{bottom: `calc(var(--plot-height) * ${state.cap / 150})`}} aria-hidden="true" />}
              <div className={styles.barColumn}>
                <strong>${state.price}</strong>
                <SegmentedBar value={state.price} charge={state.price} controlled={controlled} />
              </div>
              <div className={styles.barColumn} style={{opacity: state.opacity}} aria-hidden="true">
                <strong>${format(state.cost)}</strong>
                <SegmentedBar value={state.cost} charge={state.price} controlled={controlled} cost />
              </div>
            </div>
            <div className={styles.chartLabels}><span>Your price</span><span>{controlled ? 'AI spend' : 'AI model cost'}</span></div>
          </div>
          <div className={styles.marginSummary}>
            {controlled && <div className={styles.fixedCap}>Budget cap: ${state.cap}</div>}
            <div className={`${styles.contribution} ${state.profitMargin < 0 ? styles.negative : styles.positive}`} style={{opacity: state.opacity}} aria-hidden="true">
              <span>Profit margin</span>
              <strong>{state.profitMargin < 0 ? '−' : ''}{format(Math.abs(state.profitMargin))}%</strong>
              <small>after AI costs</small>
            </div>
            <div className={`${styles.requestStatus} ${state.paused ? styles.pausedStatus : ''}`} aria-hidden="true"><i />{state.status}</div>
            {workflow ? <div className={styles.workflowNotice} style={{visibility: state.eventTriggered ? 'visible' : 'hidden'}} aria-hidden="true">
              <strong>budget_crossed</strong>
              <small>Your receiver → Slack</small>
              <span>{state.approved ? '$150 plan · $90 cap' : 'Member hit the $60 cap.'}</span>
            </div> : <p className={styles.marginNote}>{example.note}</p>}
          </div>
        </div>
        {workflow && <div className={styles.workflowPath} aria-label="Cap, webhook, approved increase">
          <span data-complete={state.phase !== 'running'}>Cap</span><i className={styles.connector} aria-hidden="true" /><span data-complete={state.eventTriggered}>Webhook</span><i className={styles.connector} aria-hidden="true" /><span data-complete={state.approved}>Approved increase</span>
        </div>}
      </div>
    </div>
    <figcaption>Illustrative profit margin after AI costs, before other expenses.{workflow && ' Your receiver formats Slack alerts; your app approves increases.'}</figcaption>
  </figure>;
}

export function CustomerBudgetAlert() {
  return <CustomerMargin stage="workflow" />;
}
