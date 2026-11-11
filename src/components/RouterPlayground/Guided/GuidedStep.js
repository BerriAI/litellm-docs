import React, {useEffect, useMemo, useState} from 'react';
import {caseById, caseScenario} from '../cases';
import {parseConfig} from '../core';
import {defaultProfile} from '../profiles';
import {runScenario} from '../scenarioRun';
import Simulator from '../Simulator';
import {chapterOf} from './path';
import styles from './Guided.module.css';

// One guided step: a docs case in the live run, as the case modal shows it, with a strip that runs
// Before and After to the end on the same seed so the two can be read side by side.

const percent = value => `${Math.round(value * 100)}%`;
const seconds = value => (value == null ? '–' : `${value.toFixed(value < 10 ? 1 : 0)} s`);

function splitText(result) {
  const served = Object.entries(result.servedBy).sort((a, b) => b[1] - a[1]);
  const total = served.reduce((sum, [, n]) => sum + n, 0) || 1;
  return served.map(([id, n]) => `${id} ${percent(n / total)}`).join(' · ') || 'nothing served';
}

function Outcome({label, result, measure, highlight}) {
  if (!result) return <div className={styles.outcome}>{label}: running…</div>;
  const split = measure === 'split';
  return (
    <div className={highlight ? styles.outcomeAfter : styles.outcome}>
      <span className={styles.outcomeLabel}>{label}</span>
      <span className={styles.outcomeKey}>{split ? 'Traffic served by' : 'Requests that succeeded'}</span>
      <span className={styles.outcomeMain}>{split ? splitText(result) : percent(result.success)}</span>
      <span className={styles.outcomeSub}>
        {split
          ? `${percent(result.success)} succeeded · p95 ${seconds(result.p95)} · ${result.viaFallback} via fallback`
          : `p95 ${seconds(result.p95)} · ${result.viaFallback} via fallback · served by ${splitText(result)}`}
      </span>
    </div>
  );
}

export default function GuidedStep({id, core}) {
  const scenario = useMemo(() => caseScenario(id), [id]);
  const docsCase = caseById(id);
  const measure = chapterOf(id)?.measure ?? 'success';
  const [side, setSide] = useState('before');
  const [seed, setSeed] = useState(scenario?.seed ?? 7);
  const [kinds, setKinds] = useState(scenario?.kinds ?? []);
  const [built, setBuilt] = useState(null);
  const [error, setError] = useState(null);
  const [outcomes, setOutcomes] = useState(null);

  const configText = side === 'after' ? scenario?.configB : scenario?.config;

  // The router the simulator describes; the live run opens its own sessions from the same config.
  useEffect(() => {
    if (!core || !configText) return undefined;
    let router;
    try {
      const json = JSON.stringify(parseConfig(configText));
      router = new core.Playground(json, BigInt(seed));
      setBuilt({json, info: JSON.parse(router.describe())});
      setError(null);
    } catch (caught) {
      setError(String(caught.message ?? caught));
    }
    return () => router?.free();
  }, [core, configText, seed]);

  // Both sides run start to finish off the main render, on the case's own seed.
  useEffect(() => {
    if (!core || !scenario) return undefined;
    setOutcomes(null);
    const timer = setTimeout(() => {
      try {
        const options = {
          model: scenario.model,
          kinds: scenario.kinds,
          rate: scenario.rate,
          duration: scenario.duration,
          incidents: scenario.incidents,
        };
        const run = text => runScenario(core, JSON.stringify(parseConfig(text)), scenario.seed, options);
        setOutcomes({before: run(scenario.config), after: run(scenario.configB)});
      } catch (caught) {
        setOutcomes({error: String(caught.message ?? caught)});
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [core, scenario]);

  const profiles = useMemo(() => {
    const filled = {};
    for (const deployment of built?.info.deployments ?? []) filled[deployment.id] = defaultProfile();
    return filled;
  }, [built]);

  if (!scenario || !docsCase) return <p className={styles.notice}>This step does not exist.</p>;

  return (
    <div className={styles.step}>
      {error ? (
        <p className={styles.notice}>The router could not read this config: {error}</p>
      ) : !built ? (
        <p className={styles.notice}>Loading the router core…</p>
      ) : (
        <Simulator
          liveOnly
          caseBarCompact
          core={core}
          configJson={built.json}
          configText={configText}
          seed={seed}
          onSeed={setSeed}
          model={scenario.model}
          rate={scenario.rate}
          kinds={kinds}
          onKinds={setKinds}
          info={built.info}
          profiles={profiles}
          initialScenario={scenario}
          docsCase={docsCase}
          caseSide={side}
          onCaseSide={setSide}
        />
      )}
      <section className={styles.result} aria-label="Before and after, run to the end">
        <h3 className={styles.resultTitle}>The whole run, before and after</h3>
        {outcomes?.error ? (
          <p className={styles.notice}>{outcomes.error}</p>
        ) : (
          <div className={styles.outcomes}>
            <Outcome label="Before" result={outcomes?.before} measure={measure} />
            <Outcome label="After" result={outcomes?.after} measure={measure} highlight />
          </div>
        )}
        <p className={styles.resultNote}>
          Both configs run the same {scenario.duration} s of traffic and incidents on seed {scenario.seed}. A healthy
          deployment here still fails 1 call in 200, so a clean run shows about 99%.
        </p>
      </section>
    </div>
  );
}
