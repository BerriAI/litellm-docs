import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const evaluationSource = (asynchronous) => `from pathlib import Path
from tempfile import TemporaryDirectory
import litellm
from litellm import EvalTask, EvalTarget, Harness, PredicateCheck, sandbox

harness = Harness.TOOL_LOOP
model = "litellm_proxy/model-a"
prompt = "Classify: I was charged twice. Reply only with billing, technical, or sales."

# Run the agent.
with TemporaryDirectory() as workspace:
    result = ${asynchronous ? 'await litellm.aagent' : 'litellm.agent'}(
        harness, prompt, model=model, sandbox=sandbox.local(workspace),
    )
print(result.text)

# Evaluate the same setup and a second model.
task = EvalTask(
    id="billing-ticket",
    prompt=prompt,
    check=PredicateCheck(lambda result: result.text.strip().lower() == "billing"),
)
targets = [
    EvalTarget(harness, model, label="model-a"),
    EvalTarget(harness, "litellm_proxy/model-b", label="model-b"),
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
          <p className={styles.command}>{asynchronous ? 'Notebook cell output' : '$ python evaluate.py'}</p>
          <pre aria-label="Sample evaluation scorecard">{sampleScorecard}</pre>
          <div className={styles.export}><span>JSON export</span><code>scorecard.json</code></div>
        </div>
        <p className={styles.outputCaption}>Recorded SDK example with mocked answers. No live model calls.</p>
      </div>
      <figcaption className={styles.demoCaption}>
        <span>{asynchronous ? 'Run both calls with top-level await in a notebook, or inside an async function.' : 'Run your agent, then evaluate the same setup and compare a second model.'}</span>
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
