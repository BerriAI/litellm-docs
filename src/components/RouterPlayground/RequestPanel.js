import React, {useEffect, useMemo, useState} from 'react';
import {behaviourOf, configTimeout, requestPresets, responsesText} from './RequestPresets';
import RequestResponses from './RequestResponses';
import {newSingle, singleBody} from './requests';
import SingleRequest from './SingleRequest';
import {RunCard} from './Trace';
import styles from './Request.module.css';

// Make requests: pick a preset, send it, and read its trace underneath. The request's fields and
// how each provider answers it sit behind Customize.
export default function RequestPanel({
  core,
  configJson,
  seed,
  model,
  onModel,
  kinds,
  info,
  state,
  resetKey,
  runs,
  onSend,
  onAdvance,
  onReset,
}) {
  const ready = Boolean(state);
  const presets = useMemo(() => requestPresets({core, configJson, seed, model, info}), [core, configJson, seed, model, info]);
  const [key, setKey] = useState('normal');
  const [single, setSingle] = useState(newSingle);
  const [responses, setResponses] = useState({});
  const [edited, setEdited] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [picked, setPicked] = useState(null);

  const apply = preset => {
    setKey(preset.key);
    setSingle({...newSingle(), ...preset.single});
    setResponses(preset.responses);
    setEdited(false);
  };

  // A new config preset starts from a normal request.
  useEffect(() => {
    setKey('normal');
    setEdited(false);
    setSingle(newSingle());
    setResponses({});
  }, [resetKey]);

  // A changed config reworks the presets; follow the chosen one unless it was customized.
  useEffect(() => {
    if (edited) return;
    const preset = presets.find(item => item.key === key) ?? presets[0];
    setKey(preset.key);
    setSingle({...newSingle(), ...preset.single});
    setResponses(preset.responses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  useEffect(() => setPicked(null), [runs[0]?.id]);

  const current = presets.find(item => item.key === key);
  const config = useMemo(() => {
    try {
      return configJson ? JSON.parse(configJson) : null;
    } catch {
      return null;
    }
  }, [configJson]);

  const send = count =>
    onSend(count, singleBody(single, model), behaviourOf(responses, configTimeout(config)), responsesText(responses));

  const shown = runs.find(run => run.id === picked) ?? runs[0];
  const cooling = (state?.deployments ?? []).filter(item => item.cooldown).map(item => item.id);

  return (
    <div>
      <div className={styles.presetRow} role="radiogroup" aria-label="Request preset">
        {presets.map(preset => (
          <button
            key={preset.key}
            type="button"
            role="radio"
            aria-checked={preset.key === key}
            className={preset.key === key ? styles.chipActive : styles.chip}
            onClick={() => apply(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className={styles.sendRow}>
        <button type="button" className={styles.send} disabled={!ready} onClick={() => send(1)}>
          Send request
        </button>
        <p className={styles.about}>
          {current ? current.text : 'A custom request.'}
          {edited && <span className={styles.edited}> Customized.</span>}
        </p>
      </div>
      {cooling.length > 0 && (
        <p className={styles.cooling}>
          Cooling down from earlier requests: {cooling.join(', ')}. The router skips them until the cooldown ends; +60s
          or Reset clears it.
        </p>
      )}

      <div className={styles.quiet}>
        <button type="button" className={styles.link} aria-expanded={customize} onClick={() => setCustomize(!customize)}>
          {customize ? 'Hide' : 'Customize'} request and provider responses
        </button>
        <span className={styles.spacer} />
        <button type="button" className={styles.link} disabled={!ready} onClick={() => send(20)}>
          Send 20
        </button>
        <button type="button" className={styles.link} disabled={!ready} onClick={() => send(100)}>
          Send 100
        </button>
        <span className={styles.dot} aria-hidden="true" />
        <button type="button" className={styles.link} disabled={!ready} onClick={() => onAdvance(5)}>
          +5s
        </button>
        <button type="button" className={styles.link} disabled={!ready} onClick={() => onAdvance(60)}>
          +60s
        </button>
        <button type="button" className={styles.link} disabled={!core} onClick={onReset}>
          Reset
        </button>
      </div>

      {customize && (
        <div className={styles.customize}>
          <h3 className={styles.heading}>Request</h3>
          <SingleRequest
            value={single}
            onChange={next => {
              setSingle(next);
              setEdited(true);
            }}
            model={model}
            onModel={onModel}
            kinds={kinds}
            info={info}
          />
          <h3 className={styles.heading}>How providers respond to this request</h3>
          <RequestResponses
            info={info}
            responses={responses}
            onChange={next => {
              setResponses(next);
              setEdited(true);
            }}
          />
        </div>
      )}

      {shown && (
        <div className={styles.result}>
          {runs.length > 1 && (
            <div className={styles.history} aria-label="Earlier requests">
              {runs.slice(0, 10).map(run => (
                <button
                  key={run.id}
                  type="button"
                  aria-pressed={run.id === shown.id}
                  className={`${styles.historyItem} ${failed(run) ? styles.historyFailed : ''}`}
                  onClick={() => setPicked(run.id)}>
                  {historyLabel(run)}
                </button>
              ))}
            </div>
          )}
          <RunCard key={shown.id} run={shown} info={info} />
        </div>
      )}
    </div>
  );
}

const failed = run => (run.kind === 'burst' ? run.failed > 0 : !run.result.ok);

function historyLabel(run) {
  if (run.kind === 'burst') return `${run.count} requests`;
  return `#${run.n} ${run.result.ok ? run.result.deployment : 'failed'}`;
}
