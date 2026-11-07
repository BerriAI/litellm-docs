import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ConfigEditor from './ConfigEditor';
import {loadCore, parseConfig} from './core';
import {seconds} from './format';
import {PRESETS} from './presets';
import Panel from './Panel';
import {defaultProfile} from './profiles';
import {defaultKinds} from './requests';
import RequestPanel from './RequestPanel';
import {readScenarioLink} from './Scenario';
import Simulator from './Simulator';
import styles from './styles.module.css';

// The router playground: a config editor, the deployments with how each one answers, request
// presets with the trace of the request picked, and the simulator. Everything it runs is the router core in
// ./core, compiled to WebAssembly; nothing here reimplements routing.

export default function Playground() {
  const base = useBaseUrl('/router-playground/');
  const [core, setCore] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [configText, setConfigText] = useState(PRESETS[0].config);
  const [seed, setSeed] = useState(0);
  const [model, setModel] = useState(PRESETS[0].model);
  const [focus, setFocus] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [kinds, setKinds] = useState(defaultKinds);
  const [runs, setRuns] = useState([]);
  const [state, setState] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [configJson, setConfigJson] = useState(null);
  const [info, setInfo] = useState(null);
  const [linked, setLinked] = useState(null);
  const playground = useRef(null);
  const fields = useMemo(() => (core ? JSON.parse(core.Playground.configFields()) : []), [core]);
  const counter = useRef(0);

  // A scenario link carries its own configs, profiles and seed.
  useEffect(() => {
    const scenario = readScenarioLink();
    if (!scenario) return;
    setLinked(scenario);
    if (scenario.config) setConfigText(scenario.config);
    if (scenario.model) setModel(scenario.model);
    if (scenario.seed != null) setSeed(scenario.seed);
    if (scenario.profiles) setProfiles(scenario.profiles);
    if (scenario.kinds?.length) setKinds(scenario.kinds);
  }, []);

  // Every deployment has a behaviour profile in the simulator; new ones start healthy.
  const allProfiles = useMemo(() => {
    const filled = {};
    for (const deployment of info?.deployments ?? [])
      filled[deployment.id] = profiles[deployment.id] ?? defaultProfile();
    return filled;
  }, [info, profiles]);

  useEffect(() => {
    loadCore(base).then(setCore, error => setLoadError(String(error)));
  }, [base]);

  const refresh = useCallback(() => {
    if (playground.current) setState(JSON.parse(playground.current.state()));
  }, []);

  // A new config or seed builds a new router, with a fresh clock and cache. YAML that does not
  // parse keeps the router that last did.
  const rebuild = useCallback(() => {
    if (!core) return;
    let json;
    try {
      json = JSON.stringify(parseConfig(configText));
    } catch (error) {
      setConfigError(String(error.message ?? error));
      return;
    }
    playground.current?.free();
    playground.current = null;
    setRuns([]);
    counter.current = 0;
    try {
      playground.current = new core.Playground(json, BigInt(seed));
      setConfigJson(json);
      setInfo(JSON.parse(playground.current.describe()));
      setConfigError(null);
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

  // One request, or a burst of the same request. `behaviour` replaces how providers answer for
  // each request alone, and is cleared again after it.
  const send = (count, body, behaviour, responses) => {
    const router = playground.current;
    if (!router) return;
    const one = () => {
      router.setBehaviour(JSON.stringify(behaviour));
      try {
        return JSON.parse(router.send(JSON.stringify(body)));
      } finally {
        router.setBehaviour('{}');
      }
    };
    if (count === 1) {
      const run = one();
      counter.current += 1;
      const n = counter.current;
      setRuns(previous => [{kind: 'single', id: n, n, model: body.model, request: body, responses, ...run}, ...previous].slice(0, 50));
    } else {
      const summary = {kind: 'burst', model: body.model, count, responses, picked: {}, failed: 0, retries: 0, fallbacks: 0};
      for (let i = 0; i < count; i += 1) {
        const {result} = one();
        counter.current += 1;
        if (result.ok) {
          summary.picked[result.deployment] = (summary.picked[result.deployment] ?? 0) + 1;
          summary.retries += result.retries;
          summary.fallbacks += result.fallbacks;
        } else {
          summary.failed += 1;
        }
      }
      summary.id = counter.current;
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
    setProfiles(next.profiles ? structuredClone(next.profiles) : {});
    setKinds(next.requests ? next.requests() : defaultKinds());
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

      <Panel
        id="config"
        reveal={focus?.n ?? 0}
        className={styles.panel}
        headClassName={styles.panelHead}
        title="Config"
        folded={info ? `${info.deployments.length} deployments` : null}
        extra={
          <label className={styles.inline}>
            seed
            <input type="number" value={seed} min={0} onChange={event => setSeed(Number(event.target.value) || 0)} />
          </label>
        }>
        <ConfigEditor
          text={configText}
          onChange={setConfigText}
          info={info}
          error={configError}
          profiles={profiles}
          onProfilesChange={setProfiles}
          focus={focus}
          fields={fields}
        />
      </Panel>

      <div>
        <Panel
          id="make-requests"
          className={styles.panel}
          headClassName={styles.panelHead}
          title="Make requests"
          folded={runs.length ? `${runs.length} sent` : null}
          extra={<span className={styles.clock}>t = {state ? seconds(state.now) : '…'}</span>}>
          {!core && <p className={styles.muted}>Loading the router core…</p>}
          <RequestPanel
            core={core}
            configJson={configJson}
            seed={seed}
            model={model}
            onModel={setModel}
            kinds={kinds}
            info={info}
            state={state}
            resetKey={preset.id}
            runs={runs}
            onSend={send}
            onAdvance={advance}
            onReset={rebuild}
          />
        </Panel>
      </div>

      {state && (
        <Simulator
          core={core}
          configJson={configJson}
          configText={configText}
          seed={seed}
          onSeed={setSeed}
          model={model}
          rate={preset.rate}
          kinds={kinds}
          onKinds={setKinds}
          info={info}
          profiles={allProfiles}
          onEditDeployment={id => setFocus(previous => ({id, n: (previous?.n ?? 0) + 1}))}
          defaultIncidents={preset.outages}
          initialScenario={linked}
        />
      )}

      {state && state.cache.length > 0 && (
        <Panel
          id="cache"
          className={styles.panel}
          headClassName={styles.panelHead}
          title={`Routing cache (${state.cache.length} keys)`}
          defaultOpen={false}>
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
        </Panel>
      )}
    </>
  );
}
