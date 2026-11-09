import React, {useEffect, useMemo, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {caseById, caseScenario} from './cases';
import {loadCore, parseConfig} from './core';
import {defaultProfile} from './profiles';
import Simulator from './Simulator';
import styles from './CaseModal.module.css';

// A docs case over the docs page that links to it: the case bar and the live run only, with a link
// to the same case in the full playground. Opened by the click handler in src/theme/Root.js.

export default function CaseModal({id, onClose}) {
  const base = useBaseUrl('/router-playground/');
  const full = useBaseUrl(`/router-playground#case=${id}`);
  const scenario = useMemo(() => caseScenario(id), [id]);
  const docsCase = caseById(id);
  const [core, setCore] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [side, setSide] = useState('before');
  const [seed, setSeed] = useState(scenario?.seed ?? 7);
  const [kinds, setKinds] = useState(scenario?.kinds ?? []);
  const [built, setBuilt] = useState(null);
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    loadCore(base).then(setCore, error => setLoadError(String(error)));
  }, [base]);

  const configText = side === 'after' ? scenario?.configB : scenario?.config;

  // The router the simulator describes; the live run opens its own sessions from the same config.
  useEffect(() => {
    if (!core || !configText) return undefined;
    let router;
    try {
      const json = JSON.stringify(parseConfig(configText));
      router = new core.Playground(json, BigInt(seed));
      setBuilt({json, info: JSON.parse(router.describe())});
    } catch (error) {
      setLoadError(String(error.message ?? error));
    }
    return () => router?.free();
  }, [core, configText, seed]);

  const profiles = useMemo(() => {
    const filled = {};
    for (const deployment of built?.info.deployments ?? []) filled[deployment.id] = defaultProfile();
    return filled;
  }, [built]);

  // Escape closes, the page behind does not scroll, and focus returns to the link afterwards.
  useEffect(() => {
    const before = document.activeElement;
    box.current?.focus();
    // Lock the page on <html>: the docs give html overflow-x: clip, so hiding overflow on <body>
    // makes body the scroller and the page behind jumps to the top.
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key !== 'Escape') return;
      // A dialog opened inside the modal, such as a request kind's settings, closes first.
      if (box.current?.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
      if (before && document.contains(before)) before.focus?.();
    };
  }, []);

  if (!scenario || !docsCase) return null;

  return (
    <div className={styles.scrim} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div
        ref={box}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Router playground: ${docsCase.title}`}
        data-case-modal=""
        tabIndex={-1}
        onClickCapture={event => {
          // Any link out of the modal, such as Read it in the docs or the full playground, closes it.
          if (event.target instanceof Element && event.target.closest('a[href]')) onClose();
        }}>
        <div className={styles.head}>
          <span className={styles.cap}>Router playground</span>
          <span className={styles.spacer} />
          <a className={styles.full} href={full}>
            Open the full playground ↗
          </a>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          {loadError ? (
            <p className={styles.error}>The router core failed to load: {loadError}</p>
          ) : !built ? (
            <p className={styles.loading}>Loading the router core…</p>
          ) : (
            <Simulator
              liveOnly
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
        </div>
      </div>
    </div>
  );
}
