import React, {useEffect, useRef, useState} from 'react';
import examples from '@site/static/benchmarks/jevrank/query-examples.json';
import styles from './walkthrough.module.css';

const example = examples.examples.find(({id}) => id === '702');
const documents = example.documents
  .filter(({bm25Rank}) => bm25Rank <= 3)
  .sort((a, b) => a.bm25Rank - b.bm25Rank);
const steps = [
  {
    id: 'rerank-input',
    label: 'Input',
    title: 'Send a query and documents',
    text: 'Call LiteLLM’s rerank API with your query and candidate passages. Keep their input order: you will use these indexes to find each document in the response.',
    detail:
      'Follow index 2, the passage about cell polarity. It starts third in this recorded request.',
  },
  {
    id: 'rerank-scores',
    label: 'Score',
    title: 'Score each document',
    text: 'For TypeSafe Jev, LiteLLM asks the same relevance question for each passage. Jev returns a probability for each answer.',
    detail:
      'Jev assigned index 2 a score of 0.39, compared with 0.14 and 0.12 for the other two passages. These independent scores do not need to sum to one.',
  },
  {
    id: 'rerank-output',
    label: 'Rank',
    title: 'Return the ranked indexes',
    text: 'LiteLLM sorts the scores from highest to lowest and returns relevance_score with the original index. You can retrieve the matching text from your input documents.',
    detail:
      'Index 2 now ranks first. The next two results are indexes 0 and 1. The response keeps each document’s identity after the order changes.',
  },
];

const stageLabels = [
  'query + documents[]',
  'P(relevant) per passage',
  'index + relevance_score',
];

function WalkthroughScene({stage, animated = false}) {
  const visibleDocuments =
    stage === 2 && !animated
      ? [...documents].sort((a, b) => a.jevRank - b.jevRank)
      : documents;
  return (
    <div className={styles.scene} data-stage={stage + 1}>
      <div className={styles.sceneTop}>
        <span>
          0{stage + 1} / {steps[stage].label}
        </span>
        <span>{stageLabels[stage]}</span>
      </div>
      <div className={styles.query}>
        <span className={styles.fieldLabel}>QUERY 702</span>
        <p>{example.query}</p>
      </div>
      <div className={styles.modelConnection}>
        <svg viewBox="0 0 600 54" preserveAspectRatio="none" aria-hidden="true">
          <path d="M300 0V11M300 43V54M300 49H14V54M300 49H586V54" />
          <circle cx="300" cy="5" r="2" />
          <circle cx="300" cy="49" r="2" />
        </svg>
        <span className={styles.model}>
          <img src="/img/jevrank/typesafe.png" alt="" width="20" height="20" />
          TypeSafe Jev 1.13.0
        </span>
      </div>
      <div className={styles.documents}>
        {visibleDocuments.map((document) => {
          const index = document.bm25Rank - 1;
          const slot = stage === 2 ? document.jevRank - 1 : index;
          return (
            <div
              key={document.id}
              className={`${styles.document} ${index === 2 ? styles.followed : ''}`}
              style={{'--slot': slot, '--score': document.relevanceScore}}
              data-document-index={index}
            >
              <div className={styles.documentText}>
                <div className={styles.documentIdentity}>
                  <span>
                    {stage === 2 ? `index: ${index}` : `documents[${index}]`}
                  </span>
                  {index === 2 && <span>Follow this passage</span>}
                </div>
                <span className={styles.documentTitle}>{document.title}</span>
              </div>
              <div className={styles.score} aria-hidden={stage === 0}>
                <span>{document.relevanceScore.toFixed(2)}</span>
                <span className={styles.scoreLabel}>score</span>
                <span className={styles.scoreTrack}>
                  <span />
                </span>
              </div>
              <span className={styles.rank} aria-hidden={stage !== 2}>
                Rank {document.jevRank}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.sceneFooter}>
        <span>
          {stage === 2
            ? 'Returned order: [2, 0, 1]'
            : 'Original indexes: [0, 1, 2]'}
        </span>
        <span>
          {stage === 0 ? '3 of 20 passages shown' : 'Score scale: 0–1'}
        </span>
      </div>
    </div>
  );
}

export default function RerankWalkthrough({children}) {
  const storyRef = useRef(null);
  const stepRefs = useRef([]);
  const [activeStep, setActiveStep] = useState(0);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia(
      '(min-width: 981px) and (min-height: 800px) and (prefers-reduced-motion: no-preference)',
    );
    const update = () => setEnhanced(preference.matches && storyRef.current.clientWidth >= 981);
    const observer = new ResizeObserver(update);
    observer.observe(storyRef.current);
    update();
    preference.addEventListener('change', update);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enhanced) return undefined;
    let frame = 0;
    let visible = true;
    const story = storyRef.current;

    const update = () => {
      frame = 0;
      const centers = stepRefs.current.map((step) => {
        const bounds = step.getBoundingClientRect();
        return bounds.top + bounds.height / 2;
      });
      const focus = window.innerHeight * 0.54;
      const closest = centers.reduce(
        (best, center, index) =>
          Math.abs(center - focus) < Math.abs(centers[best] - focus)
            ? index
            : best,
        0,
      );
      const progress = Math.max(
        0,
        Math.min(1, (focus - centers[0]) / (centers[2] - centers[0])),
      );
      story.style.setProperty('--walkthrough-progress', progress);
      setActiveStep(closest);
    };
    const schedule = () => {
      if (visible && !frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      },
      {rootMargin: '100px 0px'},
    );
    observer.observe(story);
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [enhanced]);

  return (
    <section
      id="how-it-works"
      className={styles.section}
      aria-labelledby="method-title"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>03 / SCORING</span>
        <h2 id="method-title">How JevRank works</h2>
        <p>
          Follow one recorded TypeSafe Jev request from input to ranking. We
          show three of the 20 passages from SciFact query 702.
        </p>
      </div>
      <div className={styles.accessibleExample}>
        <p>Recorded query: {example.query}</p>
        <ol>
          {documents.map((document) => (
            <li key={document.id}>
              Input index {document.bm25Rank - 1}: {document.title}. Jev
              relevance score {document.relevanceScore.toFixed(2)}; output rank{' '}
              {document.jevRank}.
            </li>
          ))}
        </ol>
      </div>
      <div ref={storyRef} className={styles.story} data-enhanced={enhanced}>
        <div className={styles.stickyVisual}>
          <nav className={styles.stepNav} aria-label="Reranking walkthrough">
            {steps.map((step, index) => (
              <a
                key={step.id}
                href={`#${step.id}`}
                aria-current={index === activeStep ? 'step' : undefined}
              >
                <span>0{index + 1}</span> {step.label}
              </a>
            ))}
          </nav>
          <div className={styles.progress} aria-hidden="true">
            <span />
          </div>
          <div aria-hidden="true">
            <WalkthroughScene stage={activeStep} animated />
          </div>
          <p className={styles.recordedNote}>
            Recorded · TypeSafe Jev 1.13.0 · Scroll to follow the passage
          </p>
        </div>
        <div className={styles.steps}>
          {steps.map((step, index) => (
            <div
              id={step.id}
              key={step.id}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className={styles.step}
              data-active={index === activeStep}
            >
              <span className={styles.stepNumber}>0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <p className={styles.stepDetail}>{step.detail}</p>
              <div className={styles.linearVisual}>
                <WalkthroughScene stage={index} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.sourceNote}>
        Recorded example, no model calls. Scores describe the model’s assessment
        of relevance. They do not establish whether the query’s claim is true.{' '}
        <a href="/benchmarks/jevrank/query-examples.json">
          Inspect the saved query and all 20 results ↗
        </a>
      </p>
      {children}
    </section>
  );
}
