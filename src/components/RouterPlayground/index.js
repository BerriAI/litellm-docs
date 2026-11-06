import React, {useCallback, useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {loadCore, parseConfig} from './core';
import {seconds} from './format';
import {FAILURES, PRESETS} from './presets';
import Timeline from './Timeline';
import {RunCard} from './Trace';
import styles from './styles.module.css';

// The router playground: a config editor, the deployments with how each one answers, request
// controls, and the trace of every routing decision. Everything it runs is the router core in
// ./core, compiled to WebAssembly; nothing here reimplements routing.

export default function Playground() {
  const base = useBaseUrl('/router-playground/');
  const [core, setCore] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [configText, setConfigText] = useState(PRESETS[0].config);
  const [seed, setSeed] = useState(0);
  const [model, setModel] = useState(PRESETS[0].model);
  const [teamId, setTeamId] = useState('');
  const [behaviour, setBehaviour] = useState({});
  const [runs, setRuns] = useState([]);
  const [state, setState] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [configJson, setConfigJson] = useState(null);
  const [info, setInfo] = useState(null);
  const playground = useRef(null);
  const counter = useRef(0);

  useEffect(() => {
    loadCore(base).then(setCore, error => setLoadError(String(error)));
  }, [base]);

  const refresh = useCallback(() => {
    if (playground.current) setState(JSON.parse(playground.current.state()));
  }, []);

  // A new config or seed builds a new router, with a fresh clock and cache.
  const rebuild = useCallback(() => {
    if (!core) return;
    playground.current?.free();
    playground.current = null;
    setRuns([]);
    counter.current = 0;
    try {
      const json = JSON.stringify(parseConfig(configText));
      playground.current = new core.Playground(json, BigInt(seed));
      setConfigJson(json);
      setInfo(JSON.parse(playground.current.describe()));
      setConfigError(null);
      setBehaviour({});
      refresh();
    } catch (error) {
      setConfigError(String(error.message ?? error));
      setConfigJson(null);
      setInfo(null);
      setState(null);
    }
  }, [core, configText, seed, refresh]);

  useEffect(() => {
    const timer = setTimeout(rebuild, 300);
    return () => clearTimeout(timer);
  }, [rebuild]);

  const changeBehaviour = (id, change) => {
    const next = {...behaviour, [id]: {...behaviour[id], ...change}};
    if (!next[id].fail) delete next[id];
    setBehaviour(next);
    const payload = {};
    for (const [key, value] of Object.entries(next)) {
      payload[key] = value.fail === 'succeed' ? {fail: 'none'} : {fail: value.fail, times: value.times || undefined};
    }
    playground.current?.setBehaviour(JSON.stringify(payload));
  };

  const request = () => JSON.stringify({model, team_id: teamId || undefined});

  const send = count => {
    if (!playground.current) return;
    if (count === 1) {
      const run = JSON.parse(playground.current.send(request()));
      counter.current += 1;
      setRuns(previous =>
        [
          {kind: 'single', n: counter.current, model, request: {team_id: teamId || undefined}, ...run},
          ...previous,
        ].slice(0, 50),
      );
    } else {
      const summary = {kind: 'burst', model, count, picked: {}, failed: 0, retries: 0, fallbacks: 0};
      for (let i = 0; i < count; i += 1) {
        const {result} = JSON.parse(playground.current.send(request()));
        counter.current += 1;
        if (result.ok) {
          summary.picked[result.deployment] = (summary.picked[result.deployment] ?? 0) + 1;
          summary.retries += result.retries;
          summary.fallbacks += result.fallbacks;
        } else {
          summary.failed += 1;
        }
      }
      setRuns(previous => [summary, ...previous].slice(0, 50));
    }
    refresh();
  };

  const advance = by => {
    playground.current?.advance(by);
    refresh();
  };

  const choosePreset = next => {
    setPreset(next);
    setConfigText(next.config);
    setModel(next.model);
  };

  if (loadError) return <p className={styles.error}>The router core failed to load: {loadError}</p>;

  return (
    <>
      <div className={styles.presets} role="tablist">
        {PRESETS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === preset.id}
            className={item.id === preset.id ? styles.presetActive : styles.preset}
            onClick={() => choosePreset(item)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Config</h2>
            <label className={styles.inline}>
              seed
              <input type="number" value={seed} min={0} onChange={event => setSeed(Number(event.target.value) || 0)} />
            </label>
          </div>
          <textarea
            className={styles.editor}
            spellCheck={false}
            value={configText}
            onChange={event => setConfigText(event.target.value)}
            aria-label="Router config as YAML"
          />
          {configError && <p className={styles.error}>{configError}</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Deployments</h2>
            <span className={styles.clock}>t = {state ? seconds(state.now) : '…'}</span>
          </div>
          {!core && <p className={styles.muted}>Loading the router core…</p>}
          {state && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>id</th>
                  <th>group</th>
                  <th>answers with</th>
                  <th>rpm</th>
                  <th>cooldown</th>
                </tr>
              </thead>
              <tbody>
                {state.deployments.map(deployment => {
                  const current = behaviour[deployment.id] ?? {};
                  return (
                    <tr key={deployment.id}>
                      <td>
                        <code>{deployment.id}</code>
                      </td>
                      <td>{deployment.model_name}</td>
                      <td>
                        <select
                          value={current.fail ?? ''}
                          onChange={event => changeBehaviour(deployment.id, {fail: event.target.value})}
                          aria-label={`Behaviour of ${deployment.id}`}>
                          <option value="">its mock_response</option>
                          <option value="succeed">200 OK</option>
                          {FAILURES.map(name => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        {current.fail && current.fail !== 'succeed' && (
                          <input
                            className={styles.times}
                            type="number"
                            min={1}
                            placeholder="always"
                            title="How many attempts fail before it recovers"
                            value={current.times ?? ''}
                            onChange={event =>
                              changeBehaviour(deployment.id, {times: Number(event.target.value) || undefined})
                            }
                          />
                        )}
                      </td>
                      <td>{deployment.rpm}</td>
                      <td>
                        {deployment.cooldown ? (
                          <span className={styles.cooling}>
                            {deployment.cooldown.value.status_code} for {seconds(deployment.cooldown.remaining ?? 0)}
                          </span>
                        ) : (
                          <span className={styles.muted}>healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className={styles.controls}>
            <label className={styles.inline}>
              model
              <input value={model} onChange={event => setModel(event.target.value)} />
            </label>
            <label className={styles.inline}>
              team id
              <input value={teamId} placeholder="none" onChange={event => setTeamId(event.target.value)} />
            </label>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.primary} disabled={!state} onClick={() => send(1)}>
              Send request
            </button>
            <button type="button" disabled={!state} onClick={() => send(20)}>
              Send 20
            </button>
            <button type="button" disabled={!state} onClick={() => send(100)}>
              Send 100
            </button>
            <span className={styles.spacer} />
            <button type="button" disabled={!state} onClick={() => advance(5)}>
              +5s
            </button>
            <button type="button" disabled={!state} onClick={() => advance(60)}>
              +60s
            </button>
            <button type="button" disabled={!core} onClick={rebuild}>
              Reset
            </button>
          </div>
        </section>
      </div>

      {state && (
        <Timeline
          core={core}
          configJson={configJson}
          seed={seed}
          model={model}
          teamId={teamId}
          deployments={state.deployments}
          info={info}
          defaultOutages={preset.outages}
        />
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Trace</h2>
          <span className={styles.muted}>newest first; click a request to fold it</span>
        </div>
        {runs.length === 0 ? (
          <p className={styles.muted}>Send a request to see every routing decision and host call it makes.</p>
        ) : (
          runs.map((run, index) => <RunCard key={runs.length - index} run={run} info={info} />)
        )}
      </section>

      {state && state.cache.length > 0 && (
        <details className={styles.panel}>
          <summary>Routing cache ({state.cache.length} keys)</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>key</th>
                <th>value</th>
                <th>expires in</th>
              </tr>
            </thead>
            <tbody>
              {state.cache.map(entry => (
                <tr key={entry.key}>
                  <td>
                    <code>{entry.key}</code>
                  </td>
                  <td>
                    <code>{JSON.stringify(entry.value)}</code>
                  </td>
                  <td>{entry.ttl == null ? 'never' : seconds(entry.ttl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
