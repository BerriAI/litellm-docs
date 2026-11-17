import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {PostByline} from '@theme/BlogPostPage';
import styles from './launch.module.css';

const evaluationSource = (asynchronous) => `from pathlib import Path
import litellm
from litellm import Agent, EvalTask, Harness, PredicateCheck, sandbox

support = Agent(
    harness=Harness.TOOL_LOOP,
    model="litellm_proxy/model-a",
    instructions=(
        "Classify tickets as billing, technical, or sales. "
        "Reply with only the category."
    ),
)

task = EvalTask(
    id="billing-ticket",
    prompt="I was charged twice for my subscription.",
    check=PredicateCheck(lambda result: result.text.strip().lower() == "billing"),
)

report = ${asynchronous ? 'await litellm.aagent_eval' : 'litellm.agent_eval'}(
    agent=support, tasks=[task], sandbox=sandbox.local, trials=3,
)
print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")`;

const sampleScorecard = `Target                         Passed Rate   Errors
tool_loop:litellm_proxy/model-a 3/3    100.0% 0

Selected run
Task     billing-ticket
Trial    1
Result   pass
Detail   predicate passed`;

function EvaluationDemo() {
  const [asynchronous, setAsynchronous] = useState(false);
  return (
    <figure className={styles.demo} aria-label="Reusable agent definition, evaluation code and sample report">
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
        <span>{asynchronous ? 'Use top-level await in a notebook, or run evaluation inside an async function.' : 'Define your agent once. Pass it to evaluation with typed tasks.'}</span>
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
            <h1 id="agent-evaluations-title">Define your agent, then evaluate it</h1>
            <p>One reusable agent, typed tasks, and a report you can inspect.</p>
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
