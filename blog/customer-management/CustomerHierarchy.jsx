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

function EntityGlyph({scope, active = false}) {
  return <g className={`${styles.entityGlyph} ${active ? styles.activeGlyph : ''}`}>
    {scope === 'customer_org' ? <>
      <rect x="-10" y="-12" width="20" height="24" rx="1" />
      {[-5, 3].flatMap(x => [-7, -2, 3].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" className={styles.glyphDetail} />))}
      <path d="M-2,12 V7 H2 V12" />
    </> : scope === 'customer_team' ? <>
      <circle cy="-6" r="4" /><circle cx="-9" cy="-3" r="3" /><circle cx="9" cy="-3" r="3" />
      <path d="M-8,12 C-8,1 8,1 8,12 M-15,10 C-15,3 -11,1 -7,4 M15,10 C15,3 11,1 7,4" />
    </> : <>
      <circle cy="-6" r="4.5" /><path d="M-9,12 C-9,-1 9,-1 9,12" />
    </>}
  </g>;
}

function HierarchyTree({compact}) {
  const orgX = compact ? 150 : 300;
  const teams = compact ? [75, 225] : [160, 440];
  const members = compact ? [35, 115, 185, 265] : [80, 240, 360, 520];
  const memberY = compact ? 212 : 199;
  const treePaths = [
    ...teams.map(x => `M${orgX},64 C${orgX},80 ${x},70 ${x},88`),
    ...members.map((x, index) => `M${teams[Math.floor(index / 2)]},158 C${teams[Math.floor(index / 2)]},175 ${x},169 ${x},${memberY - 16}`),
  ];
  const activePath = `M${members[0]},${memberY - 16} C${members[0]},169 ${teams[0]},175 ${teams[0]},158 M${teams[0]},88 C${teams[0]},70 ${orgX},80 ${orgX},64`;
  return <svg viewBox={compact ? '0 0 300 270' : '0 0 600 250'} role="img" aria-label="A customer organization contains Sales and Engineering customer teams. Each team has two customer members. The blue path links the selected member to Sales and the organization." className={compact ? styles.mobileHierarchy : styles.desktopHierarchy}>
    <g className={styles.treeConnections}>{treePaths.map(path => <path key={path} d={path} />)}</g>
    <path d={activePath} className={styles.selectedTreePath} />
    <path d={activePath} className={styles.treePacket} aria-hidden="true" />
    <g transform={`translate(${orgX} 22)`}><EntityGlyph scope="customer_org" active /></g>
    <text x={orgX} y="54" className={styles.treeScope}>Customer organization</text>
    {teams.map((x, index) => <g key={x}>
      <g transform={`translate(${x} 103)`}><EntityGlyph scope="customer_team" active={index === 0} /></g>
      <text x={x} y="132" className={styles.treeName}>{index === 0 ? 'Sales' : 'Engineering'}</text>
      <text x={x} y="148" className={styles.treeScope}>Customer team</text>
    </g>)}
    {members.map((x, index) => <g key={x}>
      <g transform={`translate(${x} ${memberY})`}><EntityGlyph scope="customer_member" active={index === 0} /></g>
      {compact ? <text x={x} y={memberY + 30} className={styles.treeScope}><tspan x={x}>Customer</tspan><tspan x={x} dy="13">member</tspan></text> : <text x={x} y="236" className={styles.treeScope}>Customer member</text>}
    </g>)}
  </svg>;
}

export function CustomerHierarchyBreakdown() {
  return <figure className={styles.figure} data-customer-graphic="hierarchy">
    <div className={styles.window}>
      <WindowHeader label="Your customers" />
      <FlowLine />
      <div className={styles.hierarchyBody}>
        <HierarchyTree />
        <HierarchyTree compact />
      </div>
    </div>
    <figcaption>The blue path links a customer's member to their team and organization.</figcaption>
  </figure>;
}

const MARGIN_STAGES = {
  uncontrolled: {
    title: 'Before customer budgets',
    charge: 100,
    cost: 140,
    note: 'Actual spend exceeds the credits your customer bought.',
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
    note: 'Customer credits reach $150; you approve a temporary $90 cap.',
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
    status: paused ? 'Budget reached · Requests paused' : cost > example.charge ? 'Actual spend exceeds customer credits' : 'Model requests arriving',
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
  return <figure ref={figureRef} className={styles.figure} data-margin-stage={stage} data-spend={state.cost} data-price={state.price} data-cap={state.cap ?? undefined} data-profit-margin={state.profitMargin} data-contribution={state.contribution} data-phase={state.phase} data-webhook-event={state.eventTriggered ? 'budget_crossed' : undefined} data-approved={state.approved} data-status={state.paused ? 'paused' : state.contribution < 0 ? 'loss' : 'running'} aria-label={workflow ? 'Illustrative budget workflow. At $60 actual spend, requests pause and LiteLLM sends a budget_crossed event. Your receiver formats the alert. The customer buys $50 more in credits, bringing their total to $150. Your app approves a temporary $90 cap. Requests resume until $90 actual spend, leaving 40% profit margin before other expenses.' : `${example.title}. Illustrative purchased credits per member, expressed in dollars: $${example.charge}; final actual spend${controlled ? ' cap' : ''}: $${example.cost}; profit margin before other expenses: ${(example.charge - example.cost) / example.charge * 100}%.`}>
    <div className={styles.window} data-playing={playing} data-paused={state.paused} data-workflow={workflow}>
      <WindowHeader label="Customer credits and spend" branded={controlled} />
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
            <div className={styles.chartLabels}><span>Customer Credits</span><span>Actual spend</span></div>
          </div>
          <div className={styles.marginSummary}>
            {controlled && <div className={styles.fixedCap}>Budget cap: ${state.cap}</div>}
            <div className={`${styles.contribution} ${state.profitMargin < 0 ? styles.negative : styles.positive}`} style={{opacity: state.opacity}} aria-hidden="true">
              <span>Profit margin</span>
              <strong>{state.profitMargin < 0 ? '−' : ''}{format(Math.abs(state.profitMargin))}%</strong>
              <small>after actual spend</small>
            </div>
            <div className={`${styles.requestStatus} ${state.paused ? styles.pausedStatus : ''}`} aria-hidden="true"><i />{state.status}</div>
            {workflow ? <div className={styles.workflowNotice} style={{visibility: state.eventTriggered ? 'visible' : 'hidden'}} aria-hidden="true">
              <strong>budget_crossed</strong>
              <small>Your receiver → Slack</small>
              <span>{state.approved ? '$150 credits · $90 cap' : 'Member hit the $60 cap.'}</span>
            </div> : <p className={styles.marginNote}>{example.note}</p>}
          </div>
        </div>
        {workflow && <div className={styles.workflowPath} aria-label="Cap, webhook, approved increase">
          <span data-complete={state.phase !== 'running'}>Cap</span><i className={styles.connector} aria-hidden="true" /><span data-complete={state.eventTriggered}>Webhook</span><i className={styles.connector} aria-hidden="true" /><span data-complete={state.approved}>Approved increase</span>
        </div>}
      </div>
    </div>
    <figcaption>Credits shown at their purchase value. Illustrative profit margin excludes other expenses.{workflow && ' Your receiver formats Slack alerts; your app approves increases.'}</figcaption>
  </figure>;
}

export function CustomerBudgetAlert() {
  return <CustomerMargin stage="workflow" />;
}

export function getCustomerFallbackState(elapsed) {
  const time = ((elapsed % 12) + 12) % 12;
  const primarySpend = Math.min(40, 20 + Math.floor(20 * Math.max(0, Math.min(1, (time - 0.6) / 2.4))));
  const rerouted = time >= 3;
  const fallbackSpend = rerouted ? Math.floor(10 * Math.max(0, Math.min(1, (time - 3) / 4.5))) : 0;
  return {primarySpend, fallbackSpend, rerouted, spend: primarySpend + fallbackSpend};
}

function FallbackSpendBar({primary, fallback}) {
  return <div className={styles.fallbackSpendBar} aria-hidden="true">
    {Array.from({length: 20}, (_, index) => {
      const primaryFill = Math.max(0, Math.min(5, primary - index * 5));
      const fallbackFill = Math.max(0, Math.min(5, primary + fallback - index * 5) - primaryFill);
      return <i key={index}><b style={{height: `${primaryFill * 20}%`}} /><em style={{height: `${fallbackFill * 20}%`, bottom: `${primaryFill * 20}%`}} /></i>;
    })}
  </div>;
}

export function CustomerBudgetFallback() {
  const figureRef = useRef(null);
  const {elapsed, playing} = useMarginAnimation(figureRef);
  const state = getCustomerFallbackState(elapsed);
  return <figure ref={figureRef} className={styles.figure} data-customer-graphic="fallback" data-primary-spend={state.primarySpend} data-fallback-spend={state.fallbackSpend} data-spend={state.spend} data-active-model={state.rerouted ? 'economy' : 'opus'} aria-label="Illustrative model budget fallback on a dedicated virtual key. Opus actual spend reaches its $40 model allowance. Subsequent requests use a lower-cost model and add $10, for $50 total actual spend against $100 in purchased customer credits. The customer still has room under their $60 hard cap. Fallback does not bypass that cap.">
    <div className={styles.window} data-playing={playing} data-rerouted={state.rerouted}>
      <WindowHeader label="Model budget fallback" />
      <FlowLine />
      <div className={styles.fallbackBody}>
        <div className={styles.modelRoutes}>
          <svg className={styles.routeLines} viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M300,30 H105" className={styles.premiumRoute} />
            <path d="M300,30 H495" className={styles.economyRoute} />
            <path d={state.rerouted ? 'M300,30 H495' : 'M300,30 H105'} className={`${styles.routePacket} ${state.rerouted ? styles.economyPacket : styles.premiumPacket}`} pathLength="1" />
          </svg>
          <div className={styles.modelNode}><img src="/img/providers/anthropic.svg" width="28" height="28" alt="Anthropic" /><strong>Opus 5.5</strong><small>{state.rerouted ? 'Allowance reached' : 'Primary model'}</small></div>
          <div className={styles.gatewayNode}><img src="/img/brand/litellm-logo-white.png" width="80" height="15" alt="LiteLLM Gateway" /><small>Routes the next request</small></div>
          <div className={styles.modelNode}><img src="/img/providers/openai_small.svg" width="28" height="28" alt="OpenAI" /><strong>GPT-6 Luna</strong><small>{state.rerouted ? 'Serving requests' : 'Lower-cost fallback'}</small></div>
        </div>
        <div className={styles.fallbackComparison}>
          <div className={styles.fallbackCharts}>
            <div><strong>$100</strong><div className={styles.fallbackCredits}><EntityBudgetBar spend={100} cap={100} /></div><span>Customer Credits</span></div>
            <div><strong>${state.spend}</strong><div className={styles.fallbackActualPlot}><FallbackSpendBar primary={state.primarySpend} fallback={state.fallbackSpend} /></div><span>Actual spend</span></div>
          </div>
          <div className={styles.fallbackSummary}>
            <p className={styles.premiumLabel}>Opus: ${state.primarySpend} / $40 allowance</p>
            <p className={styles.economyLabel}>Fallback: ${state.fallbackSpend} spend</p>
            <strong>{100 - state.spend}% <small>profit margin</small></strong>
            <span>${60 - state.spend} left in customer budget</span>
          </div>
        </div>
      </div>
    </div>
    <figcaption>Illustrative recorded spend and purchased credit value, before other expenses. Per-model key allowances trigger the switch; customer hard caps still apply.</figcaption>
  </figure>;
}

const CUSTOMER_ENTITY_BUDGETS = [
  {scope: 'customer_org', label: 'organization', cap: 1000, baseline: 300},
  {scope: 'customer_team', label: 'team', cap: 250, baseline: 100},
  {scope: 'customer_member', label: 'member', cap: 60, baseline: 0},
];

function EntityBudgetBar({spend, cap}) {
  return <div className={styles.entityBudgetBar} aria-hidden="true">
    {Array.from({length: 20}, (_, index) => <i key={index}><b style={{height: `${Math.max(0, Math.min(1, spend / cap * 20 - index)) * 100}%`}} /></i>)}
  </div>;
}

export function CustomerEntityBudgets() {
  const figureRef = useRef(null);
  const {elapsed, playing} = useMarginAnimation(figureRef);
  const state = getCustomerMarginState('budget', elapsed);
  return <figure ref={figureRef} className={styles.figure} data-customer-graphic="entity-budgets" data-member-spend={state.cost} data-price="100" data-profit-margin={state.profitMargin} data-status={state.paused ? 'paused' : 'running'} data-limiting-scope={state.paused ? 'customer_member' : undefined} aria-label="Illustrative customer budget checks. A member's actual spend rises from $20 to $60. Organization spend rises from $320 to $360 against a $1,000 cap; team spend rises from $120 to $160 against a $250 cap. The $60 member cap pauses requests while the parents retain headroom. Against $100 in purchased member credits, profit margin is 40% before other expenses. These scopes overlap; do not add their spend together.">
    <div className={styles.window} data-playing={playing} data-paused={state.paused}>
      <WindowHeader label="Customer budget checks" branded />
      <FlowLine />
      <div className={styles.entityBudgetsBody}>
        <div className={styles.entityLegend}><span>% of each entity budget</span><span>$100 in member credits</span></div>
        <div className={styles.entityBudgetColumns}>
          {CUSTOMER_ENTITY_BUDGETS.map(entity => {
            const spend = entity.baseline + state.cost;
            const headroom = entity.cap - spend;
            const limiting = entity.scope === 'customer_member' && state.paused;
            return <div key={entity.scope} className={styles.entityBudgetColumn} data-entity={entity.scope} data-scope={entity.scope} data-cap={entity.cap} data-spend={spend} data-headroom={headroom} data-percent={Math.round(spend / entity.cap * 1000) / 10} data-rollup-base={entity.baseline} data-limiting={limiting}>
              <div className={styles.entityColumnHead}>
                <svg viewBox="-16 -16 32 32" aria-hidden="true"><EntityGlyph scope={entity.scope} active /></svg>
                <span>Customer<br />{entity.label}</span>
              </div>
              <div className={styles.entityAmounts}><strong>${spend}</strong><span>/ ${entity.cap.toLocaleString('en-US')}</span></div>
              <div className={styles.entityPlot}>
                <div className={styles.entityCapMarker} aria-hidden="true" />
                <EntityBudgetBar spend={spend} cap={entity.cap} />
              </div>
              <div className={styles.entityHeadroom}>{limiting ? 'Limit reached' : `$${headroom} left`}</div>
            </div>;
          })}
        </div>
        <div className={styles.entityBudgetSummary}>
          <span>{state.paused ? 'Member cap reached · Requests paused' : 'Member spend → Team → Organization'}</span>
          <span>Profit margin <strong>{state.profitMargin}%</strong> <small>after actual spend</small></span>
        </div>
      </div>
    </div>
    <figcaption>Illustrative overlapping views of the same member usage. Do not add organization, team, and member spend together.</figcaption>
  </figure>;
}
