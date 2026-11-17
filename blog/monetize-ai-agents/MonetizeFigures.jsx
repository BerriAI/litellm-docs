import React from 'react';
import styles from './monetize-figures.module.css';

const shell = styles;
import {useLoopClock} from './useLoopClock';

const clamp = value => Math.max(0, Math.min(1, value));

function WindowHeader({label}) {
  return <div className={shell.windowHeader}>
    <span className={shell.windowDots} aria-hidden="true"><i /><i /><i /></span>
    <span>{label}</span>
    <img src="/img/brand/litellm-logo-white.png" width="80" height="15" alt="LiteLLM" className={shell.windowLogo} />
  </div>;
}

function FlowLine() {
  return <svg className={shell.windowFlow} viewBox="0 0 640 320" preserveAspectRatio="none" aria-hidden="true">
    <path d="M1,280 V48 Q1,30 20,30 H255" className={shell.flowTrack} />
    <path d="M1,280 V48 Q1,30 20,30 H255" className={shell.flowPacket} pathLength="1" />
  </svg>;
}

function Segments({value, max, count = 24, capped = false, tone = 'blue'}) {
  return <div className={styles.segments} data-tone={tone} data-capped={capped} aria-hidden="true">
    {Array.from({length: count}, (_, index) => <i key={index}><b style={{width: `${clamp(value / max * count - index) * 100}%`}} /></i>)}
  </div>;
}

// Per-seat plan: each seat pays $100 a month; its template sets the cap on model spend.
const SEAT_PRICE = 100;
const TEMPLATES = {'default-user': 60, 'power-user': 90};
const SEATS = [
  {name: 'Ana', template: 'default-user', start: 18, end: 44},
  {name: 'Ben', template: 'default-user', start: 30, end: 72},
  {name: 'Chen', template: 'power-user', start: 40, end: 86},
  {name: 'Dana', template: 'default-user', start: 10, end: 31},
  {name: 'Eli', template: 'power-user', start: 25, end: 70},
];

export function getSeatState(elapsed) {
  const time = ((elapsed % 10) + 10) % 10;
  const progress = clamp((time - 0.6) / 6);
  const opacity = time < 0.4 ? time / 0.4 : time > 9.5 ? (10 - time) / 0.5 : 1;
  const seats = SEATS.map(seat => {
    const cap = TEMPLATES[seat.template];
    const spend = Math.min(cap, Math.round(seat.start + (seat.end - seat.start) * progress));
    return {...seat, cap, spend, paused: spend >= cap, margin: SEAT_PRICE - spend};
  });
  return {seats, opacity, paid: SEAT_PRICE * seats.length, cost: seats.reduce((sum, seat) => sum + seat.spend, 0)};
}

export function SeatAllowances() {
  const {ref, elapsed, playing} = useLoopClock({initial: 0, still: 8});
  const state = getSeatState(elapsed);
  const margin = Math.round((state.paid - state.cost) / state.paid * 100);
  const paused = state.seats.filter(seat => seat.paused).map(seat => seat.name);
  return <figure ref={ref} className={shell.figure} data-monetize-graphic="seats" data-cost={state.cost} data-paused={paused.join(',')} aria-label="Illustrative per-seat plan. Five seats each pay $100 a month. Default-user seats have a $60 model spend cap and power-user seats have $90. Ben reaches the $60 cap and pauses while the other seats keep working. Across the five seats, model cost stays under what the firm pays.">
    <div className={shell.window} data-playing={playing}>
      <WindowHeader label="Per-seat plan · $100 per seat" />
      <FlowLine />
      <div className={styles.body}>
        <div className={styles.seatHead}><span>Seat</span><span>Template</span><span>Model spend vs cap</span><span>Seat margin</span></div>
        {state.seats.map(seat => <div key={seat.name} className={styles.seatRow} data-paused={seat.paused}>
          <strong>{seat.name}</strong>
          <span className={styles.template} data-template={seat.template}>{seat.template} · ${seat.cap}</span>
          <div className={styles.seatMeter}>
            <Segments value={seat.spend} max={TEMPLATES['power-user']} count={18} capped={seat.paused} tone={seat.template === 'power-user' ? 'cyan' : 'blue'} />
            <span style={{opacity: state.opacity}}>{seat.paused ? 'Cap reached · paused' : `$${seat.spend}`}</span>
          </div>
          <em style={{opacity: state.opacity}}>${seat.margin}</em>
        </div>)}
        <div className={styles.totals} style={{opacity: state.opacity}}>
          <span>Firm pays <strong>${state.paid}</strong></span>
          <span>Model cost <strong>${state.cost}</strong></span>
          <span>Margin <strong className={styles.good}>{margin}%</strong></span>
        </div>
      </div>
    </div>
    <figcaption>Illustrative seats and prices. The default-user template caps a seat at $60 and power-user at $90; a capped seat pauses while the rest of the firm keeps working.</figcaption>
  </figure>;
}

// Usage plan: daily model cost accumulates over a month; your billing applies the markup.
const MARKUP = 1.3;
const HARD_CAP = 500;
const DAILY = Array.from({length: 30}, (_, day) => 7 + ((day * 37 + 11) % 17) * 0.5 + (day % 7 > 4 ? -3 : 0));

export function getUsageState(elapsed) {
  const time = ((elapsed % 10) + 10) % 10;
  const days = Math.floor(30 * clamp((time - 0.5) / 6.5));
  const cost = DAILY.slice(0, days).reduce((sum, value) => sum + value, 0);
  const opacity = time < 0.4 ? time / 0.4 : time > 9.5 ? (10 - time) / 0.5 : 1;
  return {days, cost, invoice: cost * MARKUP, opacity, closed: days === 30};
}

export function UsageInvoice() {
  const {ref, elapsed, playing} = useLoopClock({initial: 0, still: 8});
  const state = getUsageState(elapsed);
  const peak = Math.max(...DAILY);
  return <figure ref={ref} className={shell.figure} data-monetize-graphic="usage" data-days={state.days} data-cost={Math.round(state.cost)} aria-label={`Illustrative usage plan. Daily model cost for one customer accumulates over 30 days to $${Math.round(DAILY.reduce((a, b) => a + b, 0))}. Your billing system applies a 1.3 times markup to invoice the customer, for a 23 percent margin. A $500 hard cap limits the month.`}>
    <div className={shell.window} data-playing={playing}>
      <WindowHeader label="Usage plan · Initech · November" />
      <FlowLine />
      <div className={styles.body}>
        <div className={styles.usageGrid}>
          <div className={styles.dailyChart} aria-hidden="true">
            {DAILY.map((value, day) => <i key={day} data-recorded={day < state.days}><b style={{height: `${value / peak * 100}%`}} /></i>)}
          </div>
          <dl className={styles.invoice} style={{opacity: state.opacity}}>
            <div><dt>Model cost from usage API</dt><dd>${state.cost.toFixed(2)}</dd></div>
            <div><dt>Your markup</dt><dd>× {MARKUP}</dd></div>
            <div className={styles.invoiceTotal}><dt>Invoice</dt><dd>${state.invoice.toFixed(2)}</dd></div>
            <div><dt>Margin</dt><dd className={styles.good}>23%</dd></div>
          </dl>
        </div>
        <div className={styles.capRow} style={{opacity: state.opacity}}>
          <span>Hard cap ${HARD_CAP}</span>
          <Segments value={state.cost} max={HARD_CAP} count={30} />
          <span>{state.closed ? 'Month closed · invoice sent' : `Day ${Math.max(1, state.days)} of 30`}</span>
        </div>
      </div>
    </div>
    <figcaption>Illustrative daily spend and markup. LiteLLM reports the model cost; your billing system applies the markup and sends the invoice.</figcaption>
  </figure>;
}

const loopTime = (elapsed, seconds) => ((elapsed % seconds) + seconds) % seconds;
const fade = (time, seconds) => time < 0.4 ? time / 0.4 : time > seconds - 0.5 ? (seconds - time) / 0.5 : 1;
const lerp = (from, to, progress) => from + (to - from) * clamp(progress);

// Use case 1: credits are bought, spend runs to the cap, and LiteLLM pauses requests.
const CREDIT_EVENTS = [
  {at: 0, label: 'Customer buys $100 in credits', detail: 'You set a $60 cap on model spend'},
  {at: 1, label: 'Requests flow', detail: 'LiteLLM records the cost of each request'},
  {at: 6, label: 'Spend reaches $60', detail: 'LiteLLM pauses new requests'},
  {at: 7, label: '$40 stays as margin', detail: 'Model spend cannot go past the cap'},
];

export function getCreditState(elapsed) {
  const time = loopTime(elapsed, 12);
  const credits = 100;
  const cap = 60;
  const spend = Math.round(lerp(0, 60, (time - 1) / 5));
  return {time, credits, cap, spend, paused: spend >= cap, margin: Math.round((credits - spend) / credits * 100), opacity: fade(time, 12)};
}

export function CreditWallet() {
  const {ref, elapsed, playing} = useLoopClock({still: 9});
  const state = getCreditState(elapsed);
  const levels = 20;
  return <figure ref={ref} className={shell.figure} data-monetize-graphic="credits" data-spend={state.spend} data-cap={state.cap} data-credits={state.credits} aria-label="Illustrative prepaid credits. A customer buys $100 in credits and you cap model spend at $60. Spend rises to $60, LiteLLM pauses new requests, and $40 stays as margin.">
    <div className={shell.window} data-playing={playing}>
      <WindowHeader label="Prepaid credits · one member" />
      <FlowLine />
      <div className={`${styles.body} ${styles.creditGrid}`}>
        <div className={styles.tank} aria-hidden="true">
          {Array.from({length: levels}, (_, index) => {
            // Rows render top to bottom, so the top row is $100 and spend fills up from $0.
            const value = (levels - index) * 5;
            const state_ = value <= state.spend ? (state.paused ? 'paused' : 'spent') : value <= state.credits ? 'credit' : 'empty';
            return <i key={index} data-level={state_} data-cap={value === state.cap} />;
          })}
          <span className={styles.tankLabel}>$100</span>
          <span className={`${styles.tankLabel} ${styles.tankLabelEnd}`}>$0</span>
        </div>
        <div className={styles.creditSide}>
          <ol className={styles.events}>
            {CREDIT_EVENTS.map(event => <li key={event.at} data-on={state.time >= event.at}>
              <strong>{event.label}</strong><span>{event.detail}</span>
            </li>)}
          </ol>
          <div className={styles.totals} style={{opacity: state.opacity}}>
            <span>Credits <strong>${state.credits}</strong></span>
            <span>Spend <strong className={state.paused ? styles.warn : ''}>${state.spend}</strong></span>
            <span>Margin <strong className={styles.good}>{state.margin}%</strong></span>
          </div>
        </div>
      </div>
    </div>
    <figcaption>Illustrative amounts. Grey is unspent credit, blue is model spend, and the bright line is the $60 cap. Your product sells the credits; LiteLLM enforces the cap.</figcaption>
  </figure>;
}

// Use case 4: a Starter member crosses the soft budget, hits the cap, and upgrades to Pro.
const UPGRADE_STEPS = [
  {at: 3, event: 'soft_budget_crossed', action: 'Show an upgrade prompt'},
  {at: 4.5, event: 'budget_crossed', action: 'Requests pause · member asks for more'},
  {at: 6.5, event: 'increase approved', action: 'Customer is on Pro · cap $90'},
];

export function getUpgradeState(elapsed) {
  const time = loopTime(elapsed, 14);
  const pro = time >= 6.5;
  const spend = Math.round(time < 6.5 ? lerp(12, 60, (time - 0.5) / 4) : lerp(60, 82, (time - 7) / 4));
  return {time, pro, cap: pro ? 90 : 60, soft: 48, spend, paused: !pro && spend >= 60, opacity: fade(time, 14)};
}

export function PlanUpgrade() {
  const {ref, elapsed, playing} = useLoopClock({still: 12});
  const state = getUpgradeState(elapsed);
  const scale = 100;
  return <figure ref={ref} className={shell.figure} data-monetize-graphic="upgrade" data-spend={state.spend} data-plan={state.pro ? 'pro' : 'starter'} aria-label="Illustrative upgrade path. A Starter member has a $48 soft budget and a $60 cap. Crossing $48 sends soft_budget_crossed, which your app uses to show an upgrade prompt. At $60, budget_crossed fires and requests pause. After the customer upgrades, you approve an increase and the cap becomes $90.">
    <div className={shell.window} data-playing={playing}>
      <WindowHeader label="Plan upgrade · cap_policy: pause_allow_increase" />
      <FlowLine />
      <div className={styles.body}>
        <div className={styles.planRow}>
          <span className={styles.planBadge} data-plan={state.pro ? 'pro' : 'starter'}>{state.pro ? 'Pro' : 'Starter'}</span>
          <span style={{opacity: state.opacity}}>Member spend <strong className={state.paused ? styles.warn : ''}>${state.spend}</strong> of ${state.cap}</span>
        </div>
        <div className={styles.track} aria-hidden="true">
          <Segments value={state.spend} max={scale} count={40} capped={state.paused} tone={state.pro ? 'cyan' : 'blue'} />
          <i className={styles.marker} data-kind="soft" style={{left: `${state.soft / scale * 100}%`}}><span>soft ${state.soft}</span></i>
          <i className={styles.marker} data-kind="cap" data-hit={state.paused} style={{left: `${state.cap / scale * 100}%`}}><span>cap ${state.cap}</span></i>
        </div>
        <ol className={styles.steps}>
          {UPGRADE_STEPS.map(step => <li key={step.event} data-on={state.time >= step.at}>
            <code>{step.event}</code><span>{step.action}</span>
          </li>)}
        </ol>
      </div>
    </div>
    <figcaption>Illustrative plan limits. LiteLLM sends the events to your budget webhook; your app shows the prompt, takes the upgrade, and approves the increase.</figcaption>
  </figure>;
}

// Use case 5: premium requests until the per-model allowance runs out, then the lower-cost model.
const EMIT_EVERY = 0.4;
const SWITCH_AT = 4.2;

export function getTierState(elapsed) {
  const time = loopTime(elapsed, 12);
  const premium = Math.round(lerp(14, 40, (time - 0.5) / (SWITCH_AT - 0.5)));
  const economy = time < SWITCH_AT ? 0 : Math.round(lerp(0, 12, (time - SWITCH_AT) / 5));
  const packets = [];
  for (let emitted = -1.2; emitted < time; emitted += EMIT_EVERY) {
    const progress = (time - emitted) / 1.2;
    if (progress >= 0 && progress <= 1) packets.push({progress, lane: emitted + 0.6 < SWITCH_AT ? 'premium' : 'economy', key: Math.round(emitted * 10)});
  }
  return {time, premium, economy, spend: premium + economy, switched: time >= SWITCH_AT, packets, opacity: fade(time, 12)};
}

const LANES = {premium: 'M40,85 C150,85 170,38 300,38 H470', economy: 'M40,85 C150,85 170,132 300,132 H470'};
const LANE_POINTS = lane => t => {
  // Sample the lane path in JS so packets stay deterministic across renders.
  const y = lane === 'premium' ? 38 : 132;
  if (t < 0.55) {
    const u = t / 0.55;
    const ease3 = u * u * (3 - 2 * u);
    return [40 + 260 * u, 85 + (y - 85) * ease3];
  }
  return [300 + 170 * (t - 0.55) / 0.45, y];
};

export function ModelTiers() {
  const {ref, elapsed, playing} = useLoopClock({fps: 24, still: 9});
  const state = getTierState(elapsed);
  return <figure ref={ref} className={shell.figure} data-monetize-graphic="tiers" data-spend={state.spend} data-active-lane={state.switched ? 'economy' : 'premium'} aria-label="Illustrative premium model tier. Requests use the premium model until its $40 per-model allowance is spent, then route to a lower-cost model. Total spend stays under the customer's $60 hard cap.">
    <div className={shell.window} data-playing={playing}>
      <WindowHeader label="Premium tier · per-model allowance" />
      <FlowLine />
      <div className={`${styles.body} ${styles.tierGrid}`}>
        <svg className={styles.lanes} viewBox="0 0 600 170" aria-hidden="true">
          {Object.entries(LANES).map(([lane, d]) => <path key={lane} d={d} className={styles.lane} data-active={(lane === 'economy') === state.switched} />)}
          <circle cx="40" cy="85" r="6" className={styles.source} />
          <text x="40" y="112" textAnchor="middle" className={styles.laneText}>agent</text>
          {state.packets.map(packet => {
            const [x, y] = LANE_POINTS(packet.lane)(packet.progress);
            return <rect key={packet.key} x={x - 7} y={y - 2} width="14" height="4" className={styles.packet} data-lane={packet.lane} />;
          })}
          <g className={styles.node} data-active={!state.switched} transform="translate(476 18)">
            <rect width="118" height="40" rx="6" /><text x="12" y="17">Premium model</text><text x="12" y="31" className={styles.nodeSub}>{state.switched ? 'allowance used' : 'serving'}</text>
          </g>
          <g className={styles.node} data-active={state.switched} transform="translate(476 112)">
            <rect width="118" height="40" rx="6" /><text x="12" y="17">Lower-cost model</text><text x="12" y="31" className={styles.nodeSub}>{state.switched ? 'serving' : 'fallback'}</text>
          </g>
        </svg>
        <div className={styles.tierMeters} style={{opacity: state.opacity}}>
          <div><span>Premium allowance <strong>${state.premium} / $40</strong></span><Segments value={state.premium} max={40} count={20} capped={state.switched} /></div>
          <div><span>Customer hard cap <strong>${state.spend} / $60</strong></span><Segments value={state.spend} max={60} count={20} tone="cyan" /></div>
        </div>
      </div>
    </div>
    <figcaption>Illustrative amounts. The per-model allowance triggers the switch; the customer's hard cap still applies. Per-model key budgets require LiteLLM Enterprise.</figcaption>
  </figure>;
}
