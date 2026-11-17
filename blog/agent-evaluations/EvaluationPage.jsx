import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const evaluationSource = (asynchronous) => `from pathlib import Path
import litellm
from litellm import EvalTask, EvalTarget, Harness, PredicateCheck, sandbox

task = EvalTask(
    id="billing-ticket",
    prompt="Classify: I was charged twice. Reply only with billing, technical, or sales.",
    check=PredicateCheck(lambda result: result.text.strip().lower() == "billing"),
)
targets = [
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-a", label="model-a"),
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-b", label="model-b"),
]

report = ${asynchronous ? 'await litellm.aagent_eval' : 'litellm.agent_eval'}(
    tasks=[task], targets=targets, trials=3, max_concurrency=2,
    sandbox=sandbox.local,
)
print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")`;

const sampleScorecard = `Target    Passed   Rate     Errors
model-a   3/3      100.0%   0
model-b   0/3      0.0%     0

Selected run
Task     billing-ticket
Target   model-b
Trial    1
Result   fail
Detail   predicate failed`;

function EvaluationDemo() {
  const [asynchronous, setAsynchronous] = useState(false);
  return (
    <figure className={styles.demo} aria-label="Agent evaluation SDK code and sample report">
      <div className={styles.editor}>
        <div className={styles.editorBar}>
          <span>{asynchronous ? 'evaluate.ipynb' : 'evaluate.py'}</span>
          <div className={styles.modes} role="group" aria-label="Python execution mode">
            <button type="button" aria-pressed={!asynchronous} onClick={() => setAsynchronous(false)}>Sync</button>
            <button type="button" aria-pressed={asynchronous} onClick={() => setAsynchronous(true)}>Async</button>
          </div>
        </div>
        <CodeBlock language="python">{evaluationSource(asynchronous)}</CodeBlock>
      </div>
      <div className={styles.output}>
        <div className={styles.outputBar}><span>{asynchronous ? 'Notebook output' : 'Terminal'}</span><span>selected columns</span></div>
        <div className={styles.outputBody}>
          <p className={styles.command}>{asynchronous ? 'In [1]: await litellm.aagent_eval(...)' : '$ python evaluate.py'}</p>
          <pre aria-label="Sample evaluation scorecard">{sampleScorecard}</pre>
          <div className={styles.export}><span>JSON export</span><code>scorecard.json</code></div>
        </div>
        <p className={styles.outputCaption}>Recorded SDK example with mocked answers. No live model calls.</p>
      </div>
      <figcaption className={styles.demoCaption}>
        <span>{asynchronous ? 'Use top-level await in a notebook, or place the call inside an async function.' : 'Define your task once. Run it against both model targets and export the report.'}</span>
        <a href="#connect">Set up the example</a>
      </figcaption>
    </figure>
  );
}

export default function EvaluationPage({children}) {
  return (
    <div className={styles.root} data-full-width>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.masthead}>
            <Link to="/blog" aria-label="Back to the LiteLLM blog">
              <img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="126" />
            </Link>
            <span>PYTHON SDK / AGENT EVALUATIONS</span>
          </div>
          <div className={styles.opening}>
            <h1 id="agent-evaluations-title">Compare agents on your tasks</h1>
            <p>Typed tasks, harness and model targets, and a report you can inspect.</p>
          </div>
          <EvaluationDemo />
        </div>
      </header>
      <div className={styles.article}>
        <div className={styles.byline}><PostByline horizontal /></div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
