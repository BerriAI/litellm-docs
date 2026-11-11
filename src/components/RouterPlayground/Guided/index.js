import React, {useCallback, useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import RouterPlayground from '..';
import {caseById, caseScenario} from '../cases';
import {loadCore} from '../core';
import {scenarioLink} from '../Scenario';
import GuidedStep from './GuidedStep';
import {STORY} from './story';
import {CHAPTERS, CORE_PATH, FIRST_STEP, chapterOf, isCore, neighbours, stepTitle} from './path';
import styles from './Guided.module.css';

// The playground page in two modes. Guided walks the docs cases chapter by chapter, one at a time;
// free play (#sandbox in the URL) is the full playground. The hash picks the mode: #case=<id> is a guided step (the link the
// docs pages use), #sandbox or a #scenario= link is the sandbox, and no hash resumes the guided path.

const VISITED = 'router-playground:guided:visited';
const LAST = 'router-playground:guided:last';

function readStore(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be off; the path still works, it just forgets.
  }
}

function readHash() {
  const hash = window.location.hash;
  if (/^#(sandbox|scenario=)/.test(hash)) return {mode: 'sandbox'};
  const named = /#case=([a-z0-9-]+)/.exec(hash);
  if (named && caseById(named[1])) return {mode: 'guided', step: named[1]};
  return {mode: 'guided', step: readStore(LAST, FIRST_STEP)};
}

function Nav({step, visited}) {
  return (
    <nav className={styles.nav} aria-label="Guided path">
      <p className={styles.navTitle}>Learn the router</p>
      <ol className={styles.chapters}>
        {CHAPTERS.map((chapter, index) => {
          const ids = [chapter.core, ...chapter.variants].filter(Boolean);
          const open = ids.includes(step);
          return (
            <li key={chapter.id} className={open ? styles.chapterOpen : styles.chapter}>
              <a
                className={styles.chapterLink}
                href={`#case=${chapter.core ?? chapter.variants[0]}`}
                aria-current={open ? 'true' : undefined}>
                <span className={styles.chapterNumber}>{index + 1}</span>
                <span>{chapter.title}</span>
              </a>
              {open ? (
                <ul className={styles.steps}>
                  {ids.map(id => (
                    <li key={id}>
                      <a
                        className={id === step ? styles.stepActive : styles.stepLink}
                        href={`#case=${id}`}
                        aria-current={id === step ? 'page' : undefined}>
                        <span className={styles.mark} aria-hidden="true">
                          {visited.includes(id) ? '✓' : ''}
                        </span>
                        <span>{stepTitle(id)}</span>
                        {isCore(id) ? null : <span className={styles.optional}>optional</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
      <a className={styles.navSandbox} href="#sandbox">
        Free play: build your own config →
      </a>
    </nav>
  );
}

function MobileNav({step}) {
  return (
    <label className={styles.mobileNav}>
      <span>Step</span>
      <select value={step} onChange={event => (window.location.hash = `case=${event.target.value}`)}>
        {CHAPTERS.map((chapter, index) => (
          <optgroup key={chapter.id} label={`${index + 1}. ${chapter.title}`}>
            {[chapter.core, ...chapter.variants].filter(Boolean).map(id => (
              <option key={id} value={id}>
                {stepTitle(id)}
                {isCore(id) ? '' : ' (optional)'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function StepHeader({step}) {
  const chapter = chapterOf(step);
  const chapterNumber = CHAPTERS.indexOf(chapter) + 1;
  const coreIndex = CORE_PATH.indexOf(step);
  const story = STORY[step];
  const docsCase = caseById(step);
  return (
    <header className={styles.stepHeader}>
      <p className={styles.kicker}>
        {chapterNumber}. {chapter?.title}
        <span className={styles.kickerSep}>·</span>
        {coreIndex >= 0 ? `Step ${coreIndex + 1} of ${CORE_PATH.length}` : 'Optional'}
      </p>
      <h2 className={styles.stepTitle}>{docsCase?.title}</h2>
      {story ? (
        <div className={styles.story}>
          <div className={styles.storyCell}>
            <span className={styles.storyLabel}>The setup</span>
            <p>{story.setup}</p>
          </div>
          <div className={styles.storyCell}>
            <span className={styles.storyLabel}>The problem</span>
            <p>{story.test}</p>
          </div>
          <div className={styles.storyFix}>
            <span className={styles.storyLabel}>How LiteLLM handles it</span>
            <p>{story.fix}</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Pager({step}) {
  const {back, next} = neighbours(step);
  return (
    <div className={styles.pager}>
      {back ? (
        <a className={styles.pagerBack} href={`#case=${back}`}>
          <span className={styles.pagerHint}>Back</span>
          {stepTitle(back)}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a className={styles.pagerNext} href={`#case=${next}`}>
          <span className={styles.pagerHint}>Next</span>
          {stepTitle(next)}
        </a>
      ) : (
        <a className={styles.pagerNext} href="#sandbox">
          <span className={styles.pagerHint}>Done with the path</span>
          Try your own config in free play
        </a>
      )}
    </div>
  );
}

export default function PlaygroundShell() {
  const base = useBaseUrl('/router-playground/');
  const [route, setRoute] = useState(null);
  const [visited, setVisited] = useState([]);
  const [last, setLast] = useState(FIRST_STEP);
  const [core, setCore] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const top = useRef(null);

  useEffect(() => {
    setVisited(readStore(VISITED, []));
    setLast(readStore(LAST, FIRST_STEP));
    const open = () => setRoute(readHash());
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  // The guided steps share one core; the sandbox loads it itself, from the same memoised promise.
  useEffect(() => {
    if (route?.mode !== 'guided') return;
    loadCore(base).then(setCore, error => setLoadError(String(error)));
  }, [base, route?.mode]);

  const step = route?.mode === 'guided' ? route.step : null;
  useEffect(() => {
    if (!step) return;
    writeStore(LAST, step);
    setLast(step);
    setVisited(previous => {
      if (previous.includes(step)) return previous;
      const next = [...previous, step];
      writeStore(VISITED, next);
      return next;
    });
    if (top.current && top.current.getBoundingClientRect().top < 0) {
      top.current.scrollIntoView({block: 'start'});
    }
  }, [step]);

  const sandboxLink = useCallback(() => {
    const scenario = step ? caseScenario(step) : null;
    return scenario ? scenarioLink(scenario).replace(/^[^#]*/, '') : '#sandbox';
  }, [step]);

  return (
    <div ref={top} className={styles.shell}>
      <div className={styles.modeBar}>
        <div className={styles.modes} role="tablist" aria-label="Playground mode">
          <a
            role="tab"
            aria-selected={route?.mode !== 'sandbox'}
            className={route?.mode !== 'sandbox' ? styles.modeActive : styles.mode}
            href={`#case=${step ?? last}`}>
            Guided path
          </a>
          <a
            role="tab"
            aria-selected={route?.mode === 'sandbox'}
            className={route?.mode === 'sandbox' ? styles.modeActive : styles.mode}
            href="#sandbox">
            Free play
          </a>
        </div>
        <p className={styles.modeHint}>
          {route?.mode === 'sandbox'
            ? 'Edit any config, set how each deployment behaves, and run your own traffic.'
            : 'Six short steps. Each one shows a problem and the router setting that fixes it, running live.'}
        </p>
        {step ? (
          <a className={styles.modeAside} href={sandboxLink()}>
            Open this step in free play ↗
          </a>
        ) : null}
      </div>

      {!route ? (
        <p className={styles.notice}>Loading…</p>
      ) : route.mode === 'sandbox' ? (
        <RouterPlayground />
      ) : (
        <div className={styles.layout}>
          <Nav step={step} visited={visited} />
          <div className={styles.content}>
            <MobileNav step={step} />
            <StepHeader step={step} />
            {loadError ? (
              <p className={styles.notice}>The router core failed to load: {loadError}</p>
            ) : !core ? (
              <p className={styles.notice}>Loading the router core…</p>
            ) : (
              <GuidedStep key={step} id={step} core={core} />
            )}
            <Pager step={step} />
          </div>
        </div>
      )}
    </div>
  );
}
