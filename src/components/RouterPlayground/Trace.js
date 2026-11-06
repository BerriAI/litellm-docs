import React, {useState} from 'react';
import {seconds} from './format';
import StateDiagram from './StateDiagram';
import styles from './styles.module.css';

// Events worth a colour; everything else reads as a plain step.
const TONE = {
  Selected: 'pick',
  Succeeded: 'ok',
  AttemptFailed: 'fail',
  PickFailed: 'fail',
  LevelFailed: 'fail',
  CooldownSet: 'warn',
  Retry: 'retry',
  Fallback: 'hop',
  FallbackDone: 'hop',
  FallingBack: 'hop',
};

function Step({step}) {
  if (step.kind === 'host') {
    const detail =
      step.call === 'invoke'
        ? `${step.deployment}: ${step.answer}`
        : step.call === 'sleep'
          ? `wait ${seconds(step.seconds)}`
          : step.call === 'allow_fallback'
            ? `may fall back to ${step.target}: yes`
            : `${step.stage}: ${step.answer}`;
    return (
      <li className={`${styles.step} ${styles.host}`}>
        <span className={styles.time}>{seconds(step.t)}</span>
        <span className={styles.badge}>host.{step.call}</span>
        <span className={styles.detail}>{detail}</span>
      </li>
    );
  }
  const tone = TONE[step.event];
  return (
    <li className={`${styles.step} ${tone ? styles[tone] : ''}`}>
      <span className={styles.time}>{seconds(step.t)}</span>
      <span className={styles.badge}>{step.event}</span>
      <span className={styles.detail}>{step.detail.replace(/^\w+\s*\{?\s*/, '').replace(/\s*\}$/, '')}</span>
    </li>
  );
}

export function RunCard({run, info}) {
  const [open, setOpen] = useState(run.kind === 'single');
  const [view, setView] = useState('diagram');
  if (run.kind === 'burst') {
    return (
      <div className={styles.run}>
        <div className={styles.runHead}>
          <strong>
            {run.count} requests for <code>{run.model}</code>
          </strong>
          <span className={styles.runMeta}>
            {run.failed} failed, {run.retries} retries, {run.fallbacks} fallbacks
          </span>
        </div>
        <div className={styles.split}>
          {Object.entries(run.picked)
            .sort((a, b) => b[1] - a[1])
            .map(([id, count]) => (
              <div key={id} className={styles.splitRow}>
                <code>{id}</code>
                <span className={styles.bar}>
                  <span style={{width: `${(100 * count) / run.count}%`}} />
                </span>
                <span>{count}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }
  const {result, trace, took} = run;
  return (
    <div className={`${styles.run} ${result.ok ? '' : styles.runFailed}`}>
      <button type="button" className={styles.runHead} onClick={() => setOpen(!open)}>
        <strong>
          #{run.n} <code>{run.model}</code>{' '}
          {result.ok ? (
            <>
              served by <code>{result.deployment}</code>
            </>
          ) : (
            'failed'
          )}
        </strong>
        <span className={styles.runMeta}>
          {result.ok ? `${result.retries} retries, ${result.fallbacks} fallbacks, ` : ''}
          {seconds(took)} simulated {open ? '▾' : '▸'}
        </span>
      </button>
      {!result.ok && <p className={styles.error}>{result.error}</p>}
      {open && (
        <div className={styles.runBody}>
          {run.request && (
            <p className={styles.requestBody}>
              request <code>{JSON.stringify(run.request)}</code>
            </p>
          )}
          <div className={styles.viewTabs} role="tablist">
            <button type="button" role="tab" aria-selected={view === 'diagram'} onClick={() => setView('diagram')}>
              State diagram
            </button>
            <button type="button" role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>
              Event list
            </button>
          </div>
          {view === 'diagram' && info ? (
            <StateDiagram run={run} info={info} />
          ) : (
            <ol className={styles.trace}>
              {trace.map((step, index) => (
                <Step key={index} step={step} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
