import React from 'react';
import styles from './diagrams.module.css';

const benchmark = {
  before: {label: 'Before', value: '22', unit: 'round trips'},
  after: {label: 'After', value: '8', unit: 'round trips'},
  improvement: '14 fewer Redis round trips per request',
  context: 'One /v1/chat/completions request · key, team and end-user budgets · TPM and RPM limits · usage-based routing · response cache',
  metrics: [
    {label: 'Before the model call', before: '12', after: '5'},
    {label: 'After the model call', before: '10', after: '3'},
    {label: 'Streaming request', before: '24', after: '8'},
    {label: 'Response-cache hit', before: '18', after: '7'},
    {label: 'Once-a-minute auth refresh', before: '46', after: '16'},
  ],
};

const endpoints = [
  {endpoint: '/v1/chat/completions', before: '22', after: '8'},
  {endpoint: '/v1/chat/completions', variant: 'streaming', before: '24', after: '8'},
  {endpoint: '/v1/chat/completions', variant: 'simple-shuffle routing', before: '22', after: '8'},
  {endpoint: '/v1/messages', before: '21', after: '8'},
  {endpoint: '/v1/responses', before: '26', after: '9'},
  {endpoint: '/v1/chat/completions', variant: 'response-cache hit', before: '18', after: '7'},
];

const before = [
  {owner: 'identity', op: 'MGET', detail: 'team, membership'},
  {owner: 'identity', op: 'SET', detail: 'write back'},
  {owner: 'spend', op: 'MGET', detail: 'spend counters'},
  {owner: 'spend', op: 'MGET', detail: 'same counters'},
  {owner: 'spend', op: 'INCR', detail: 'reserve key'},
  {owner: 'spend', op: 'INCR', detail: 'reserve team'},
  {owner: 'spend', op: 'INCR', detail: 'reserve end user'},
  {owner: 'limits', op: 'EVALSHA', detail: 'RPM check'},
  {owner: 'limits', op: 'EVALSHA', detail: 'key TPM'},
  {owner: 'limits', op: 'EVALSHA', detail: 'team TPM'},
  {owner: 'routing', op: 'MGET', detail: 'cooldowns, usage'},
  {owner: 'cache', op: 'GET', detail: 'response cache'},
  {provider: true},
  {owner: 'cache', op: 'SET', detail: 'response cache'},
  {owner: 'spend', op: 'MGET', detail: 'spend counters'},
  {owner: 'spend', op: 'INCR', detail: 'settle reservation'},
  {owner: 'spend', op: 'MGET', detail: 'same counters'},
  {owner: 'spend', op: 'INCR', detail: 'other counters'},
  {owner: 'routing', op: 'INCR', detail: 'deployment TPM'},
  {owner: 'spend', op: 'GET', detail: 'user spend'},
  {owner: 'spend', op: 'GET', detail: 'tag spend'},
  {owner: 'spend', op: 'GET', detail: 'tag spend'},
  {owner: 'limits', op: 'EVALSHA', detail: 'token usage'},
];

const after = [
  {owner: 'mixed', op: 'PIPELINE', detail: 'identity MGET + spend MGET'},
  {owner: 'spend', op: 'PIPELINE', detail: 'reserve key, team, end user'},
  {owner: 'mixed', op: 'PIPELINE', detail: 'identity write back + routing MGET + RPM check'},
  {owner: 'limits', op: 'PIPELINE', detail: 'key TPM + team TPM'},
  {owner: 'cache', op: 'GET', detail: 'response cache'},
  {provider: true},
  {owner: 'spend', op: 'PIPELINE', detail: 'spend counters'},
  {owner: 'spend', op: 'PIPELINE', detail: 'user, tag spend'},
  {owner: 'mixed', op: 'PIPELINE', detail: 'cache SET + 8 counter INCRs + deployment TPM + token usage'},
];

const owners = [
  {id: 'identity', label: 'Identity'},
  {id: 'spend', label: 'Spend and budgets'},
  {id: 'limits', label: 'Rate limits'},
  {id: 'routing', label: 'Routing'},
  {id: 'cache', label: 'Response cache'},
  {id: 'mixed', label: 'Shared pipeline'},
];

const flows = [
  {
    id: 'before',
    label: 'Before',
    title: 'Each subsystem reads, decides and writes before the next one starts',
    stages: [
      {label: 'Auth', detail: 'Read identity rows, write them back, read the spend counters'},
      {label: 'Budgets', detail: 'Read the same spend counters again, then reserve with three increments'},
      {label: 'Rate limits', detail: 'Run the RPM script, then the key TPM script, then the team TPM script'},
      {label: 'Routing and cache', detail: 'Read cooldowns and usage, pick a deployment, read the response cache'},
    ],
  },
  {
    id: 'after',
    label: 'After',
    title: 'Declare, flush once, decide',
    stages: [
      {label: 'Declare', detail: 'Auth, budgets, rate limits and routing queue their reads and scripts on the request batch and get a handle each'},
      {label: 'Flush', detail: 'The first await sends everything queued as one pipeline per Redis backend; every command gets its own reply'},
      {label: 'Decide', detail: 'Each subsystem reads its reply and runs the same checks in the same order; a failed command fails only its owner'},
      {label: 'Settle', detail: 'After the model call, writes collect in a post-call batch and leave in one pipeline once the callbacks finish'},
    ],
  },
];

function Arrow({className}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResultsTable({label, rows}) {
  return (
    <table className={styles.metrics} aria-label={`${label}: Redis round trips before and after`}>
      <thead>
        <tr>
          <th scope="col">{label}</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <th scope="row">
              {row.endpoint ? <code>{row.endpoint}</code> : row.label}
              {row.variant && <span className={styles.requestVariant}>{row.variant}</span>}
            </th>
            <td>{row.before}</td>
            <td>{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EndpointResults() {
  return (
    <figure className={styles.figure}>
      <ResultsTable label="Request" rows={endpoints} />
    </figure>
  );
}

export function PerformanceResults() {
  return (
    <figure className={styles.figure}>
      <div className={styles.results}>
        <div className={styles.resultHeading}>
          <p className={styles.eyebrow}>Redis round trips per request</p>
          <span className={styles.improvement}>{benchmark.improvement}</span>
        </div>
        <div className={styles.timing}>
          {[benchmark.before, benchmark.after].map((result, index) => (
            <React.Fragment key={result.label}>
              {index > 0 && <Arrow className={styles.timingArrow} />}
              <div className={index === 0 ? styles.beforeTime : styles.afterTime}>
                <span className={styles.timeLabel}>{result.label}</span>
                <span className={styles.timeValue}>{result.value}<span className={styles.timeUnit}> {result.unit}</span></span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <ResultsTable label="Redis round trips" rows={benchmark.metrics} />
      </div>
      <figcaption className={styles.caption}>{benchmark.context}</figcaption>
    </figure>
  );
}

function Lane({name, count, trips, after}) {
  return (
    <div className={after ? `${styles.lane} ${styles.laneAfter}` : styles.lane}>
      <div className={styles.laneLabel}>
        <div className={styles.laneHeading}>
          <span className={styles.laneName}>{name}</span>
          <span className={styles.laneTotal}>
            <strong>{trips.filter(trip => !trip.provider).length}</strong> round trips
          </span>
        </div>
        <span className={styles.laneCount}>{count}</span>
      </div>
      <ol className={styles.trips} aria-label={`${name} Redis round trips`}>
        {trips.map((trip, index) =>
          trip.provider ? (
            <li className={styles.provider} key={`provider-${index}`}>model call</li>
          ) : (
            <li className={styles.trip} data-owner={trip.owner} key={`${trip.op}-${index}`}>
              <span className={styles.tripOp}>{trip.op}</span>
              <span className={styles.tripDetail}>{trip.detail}</span>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

export function RoundTripTimeline() {
  return (
    <figure className={styles.figure}>
      <div className={styles.timeline}>
        <Lane name="Before" count="12 before the model call, 10 after" trips={before} />
        <Lane name="After" count="5 before the model call, 3 after" trips={after} after />
        <div className={styles.legend}>
          {owners.map(owner => (
            <span className={styles.legendItem} key={owner.id}>
              <span className={styles.swatch} data-owner={owner.id} />
              {owner.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className={styles.caption}>Every box is one wait on Redis. Same request, same checks, same writes.</figcaption>
    </figure>
  );
}

export function BatchLifecycle() {
  return (
    <figure className={styles.figure}>
      <div className={styles.flows}>
        {flows.map(flow => (
          <div className={flow.id === 'after' ? `${styles.flow} ${styles.after}` : styles.flow} key={flow.id}>
            <div>
              <span className={styles.flowLabel}>{flow.label}</span>
              <p className={styles.flowTitle}>{flow.title}</p>
            </div>
            <ol className={styles.stages} aria-label={`${flow.label} request flow`}>
              {flow.stages.map((stage, index) => (
                <li className={styles.stage} key={stage.label}>
                  {index > 0 && <Arrow className={styles.flowArrow} />}
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <span className={styles.stageDetail}>{stage.detail}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <figcaption className={styles.caption}>Only the I/O scheduling changed. Every check still runs in the module that owns it.</figcaption>
    </figure>
  );
}
