---
title: Evaluate agents
description: Evaluate a reusable agent on typed tasks, repeat each attempt and compare candidate definitions by success, cost and time.
---

# Evaluate agents

{/* keep-version-note */}

:::info Preview
The examples below preview the reusable `Agent` and evaluation APIs. Published PyPI releases do not include these APIs yet.
:::

Define an `Agent` once, then pass it to `litellm.agent_eval()` with typed tasks. Keep the harness, model and instructions in the agent definition; put each request and its success check in an `EvalTask`. Read pass rate, cost and duration in the scorecard.

## 1. Configure your AI Gateway

Use a [LiteLLM AI Gateway](./gateway.md) virtual key that can call a model group. This example names it `model-a`; replace that name with your group. The agent uses Tool Loop, which needs no CLI runtime. The later comparison also uses `model-b`.

In Bash or Zsh, set your gateway's root URL, without `/v1`, and enter your virtual key after running `read`. The terminal hides the input:

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY
read -rs LITELLM_PROXY_API_KEY
```

Skip the `read` command if your secret manager has set `LITELLM_PROXY_API_KEY`. To compare CLI harnesses such as Claude Code or Codex, install their dependencies from the [quickstart](./quickstart.md#1-install).

## 2. Define your agent and tasks {#2-define-tasks-and-targets}

Save this complete example as `evaluate_agents.py`.

Choose a sandbox factory for each evaluation call. This example uses `sandbox.local` for trusted tasks that can run with your user's permissions. The runner passes a fresh temporary workspace to the factory for each attempt.

```python title="evaluate_agents.py"
from pathlib import Path

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

tasks = [
    EvalTask(
        id="billing-ticket",
        prompt="I was charged twice for my subscription.",
        check=PredicateCheck(
            lambda result: result.text.strip().lower() == "billing"
        ),
    ),
    EvalTask(
        id="technical-ticket",
        prompt="The app crashes whenever I upload a PDF.",
        check=PredicateCheck(
            lambda result: result.text.strip().lower() == "technical"
        ),
    ),
]

report = litellm.agent_eval(
    agent=support,
    tasks=tasks,
    sandbox=sandbox.local,
    trials=3,
    max_concurrency=2,
)

print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")
```

`PredicateCheck` receives the agent's `Result` and returns a boolean. Check the final answer, tool calls or another part of the result. Predicates can be sync or async.

`Agent` holds a reusable definition. Creating it does not run a request. Evaluation uses that same definition for each task and trial, with a fresh workspace for every attempt. Give each task a unique ID.

## 3. Run the evaluation

From the directory containing `evaluate_agents.py`, run:

```bash
python evaluate_agents.py
```

Two tasks, one agent and three trials produce six runs. Confirm that the summary has six attempts. An agent that returns the expected category on each attempt and stops with `done` has `6/6` passed runs. Use `scorecard.json` for your own analysis.

A run passes only when the agent stops with `stop_reason="done"` and its check passes. A failed check or turn limit produces `fail`. Setup failures, runtime errors, timeouts and cancelled agent runs produce `error` rows while the remaining runs continue. The runner skips grading when the agent does not finish with `done`. Cancelling the suite stops execution and triggers cleanup.

## 4. Inspect the results

Read the typed summaries or individual runs without parsing Markdown:

```python
from litellm import EvalStatus

for summary in report.summaries:
    print(summary.target, summary.pass_rate, summary.cost)

for run in report.runs:
    if run.status is not EvalStatus.PASS:
        print(run.task_id, run.target, run.trial, run.detail)
```

Add this code after the evaluation call in `evaluate_agents.py`.

Pass rate is passed runs divided by scheduled runs, including errors. Totals include known usage from unsuccessful runs. Check `metrics_complete` before treating a cost total as complete. A false value means some usage or cost is unavailable.

Mean duration covers workspace preparation, setup, agent execution, grading and cleanup. Compare it separately from total suite time, since runs can overlap.

Compare agent and judge costs in separate columns. JSON exports include result data and identifiers. They omit authentication configuration, Python callables and raw events.

The runner attaches `agent_eval_suite`, `agent_eval_run`, `agent_eval_task`, `agent_eval_target` and `agent_eval_trial` metadata to model requests. Pass `metadata={"experiment": "support-routing"}` to add your own label. Use these identifiers to correlate requests in existing gateway logs. Persisted spend logs require the gateway's existing database setup.

## Run the same agent on one request

Pass the `support` object to `litellm.agent()` when you need one answer. `TemporaryDirectory` creates an existing local directory for that run:

```python
from tempfile import TemporaryDirectory

with TemporaryDirectory() as workspace:
    result = litellm.agent(
        support,
        "I was charged twice for my subscription.",
        sandbox=sandbox.local(workspace),
    )
    print(result.text)
```

This returns a `Result`. Evaluation takes the `Agent` definition and typed tasks, then runs new attempts. The individual request stays separate from the evaluation scorecard.

## Compare a candidate

Use `dataclasses.replace` to change one setting while keeping the rest of the definition. Label the original and candidate with `EvalTarget`:

```python
from dataclasses import replace

from litellm import EvalTarget

candidate = replace(support, model="litellm_proxy/model-b")

comparison = litellm.agent_eval(
    tasks=tasks,
    targets=[
        EvalTarget(agent=support, label="production"),
        EvalTarget(agent=candidate, label="candidate"),
    ],
    sandbox=sandbox.local,
    trials=3,
    max_concurrency=2,
)

print(comparison.to_markdown())
```

Two tasks, two targets and three trials produce twelve runs. Give each target a unique label. Pass either `agent` for one definition or `targets` for a comparison. Each target can carry its own harness, model, instructions and harness-specific options through its `Agent`.

## Async execution

In an async function or notebook, use `aagent_eval()` with the same agent and tasks:

```python
report = await litellm.aagent_eval(
    agent=support,
    tasks=tasks,
    sandbox=sandbox.local,
    trials=3,
    max_concurrency=2,
)

print(report.to_markdown())
```

## Grade writing or research with a model

Use `JudgeCheck` to grade against a rubric. Choose a judge model that supports JSON output. The judge receives the task prompt, answer and reported file changes, together with your rubric. It can grade file diffs but cannot read other workspace files.

```python
from dataclasses import replace

from litellm import EvalTask, JudgeCheck

writer = replace(
    support,
    instructions="Write clear customer support replies. Do not guarantee refunds.",
)

writing_task = EvalTask(
    id="support-reply",
    prompt=(
        "Write a reply to a customer who was charged twice. "
        "Explain that support will investigate without promising a refund."
    ),
    check=JudgeCheck(
        model="litellm_proxy/judge",
        rubric=(
            "The reply acknowledges the duplicate charge, gives a clear next "
            "step and does not guarantee a refund."
        ),
        timeout=30,
    ),
)

writing_report = litellm.agent_eval(
    agent=writer,
    tasks=[writing_task],
    sandbox=sandbox.local,
)

print(writing_report.to_markdown())
```

The writing variant keeps the original model and changes the instructions. Allow your virtual key to call the `judge` model group, and budget for those calls in addition to the agent runs.

A valid negative verdict produces `fail`. A failed judge request or invalid verdict produces `error`.

## Evaluate a task that changes files

For a task that needs starting files, pass a project directory as `workspace`. Each attempt gets a copy. The agent edits that copy, and the runner excludes `.git` metadata to keep Git state separate from the source.

Use a real directory for `workspace`. The runner rejects symlinks in the copied project before creating a sandbox, including links within the project and broken links. It also rejects a symlink used as the workspace root.

Create `calculator/calc.py` with a bug:

```python title="calculator/calc.py"
def add(a, b):
    return a - b
```

Replace the `support` definition and `tasks` in `evaluate_agents.py` with this example. Install the CLI runtime first using the [quickstart](./quickstart.md#1-install), and use a model group available to your key.

```python
from pathlib import Path

from litellm import Agent, CommandCheck, EvalTask, Harness

support = Agent(
    harness=Harness.CODEX,
    model="litellm_proxy/coder",
    instructions="Complete the requested file change and verify it.",
)

tasks = [
    EvalTask(
        id="fix-calculator",
        prompt="Fix calc.py so add(a, b) returns the sum of a and b.",
        workspace=Path(__file__).resolve().parent / "calculator",
        check=CommandCheck(
            [
                "python",
                "-c",
                "from calc import add; "
                "assert add(2, 3) == 5; "
                "assert add(-2, 2) == 0",
            ],
            timeout=30,
        ),
    ),
]
```

Use `CommandCheck` to run a grading command in the same sandbox after the agent finishes. Exit code zero passes. This example keeps assertions in the evaluation script, outside the copied project. Use a task's `setup` commands to install dependencies before the agent starts.

Tool Loop has no built-in file or shell tools. Use a coding harness for this example. Caller-supplied Python tools execute in the SDK process with its permissions.

## Choose a sandbox and execution limits

Both evaluation functions require an explicit `sandbox` factory. Pass `sandbox=sandbox.local` for trusted tasks that can run with your user's permissions. For CLI harnesses, use a container to isolate the runtime and its dependencies.

For container execution, pass a factory that receives each attempt's fresh workspace:

```python
from litellm import sandbox

report = litellm.agent_eval(
    agent=support,
    tasks=tasks,
    sandbox=lambda workspace: sandbox.docker(
        "my-eval-runtime:latest",
        mounts={str(workspace): "/workspace"},
        workdir="/workspace",
    ),
)
```

Replace `my-eval-runtime:latest` with an image you built containing the required CLI runtimes and project dependencies. Docker must be running. See [Sandboxes](./sandboxes.md) for the sandbox contract.

| Option | Default | Meaning |
|---|---|---|
| `sandbox` | Required | Factory that receives each attempt's fresh workspace and returns a sandbox |
| `trials` | `1` | Independent attempts per task and target |
| `max_concurrency` | `1` | Concurrent attempts, including setup and grading |
| `timeout` | Agent setting, else `300` | Seconds allowed for each agent execution |
| `setup_timeout` | `120` | Seconds allowed for the setup stage of each attempt |
| `CommandCheck.timeout` | `30` | Seconds allowed for the grading command |
| `JudgeCheck.timeout` | `30` | Seconds allowed for the judge request |
| `max_turns` | Agent setting, else `None` | Turn limit, which counts tool-call events rather than model calls; explicit `None` clears the limit |

The runner closes its sandboxes and removes temporary workspaces after each attempt. Inspect file changes and check details in the scorecard, or export them to JSON.

## Troubleshoot a run

| Symptom | Next action |
|---|---|
| Importing `agent_eval` fails | This API is unreleased. Run these examples after a release includes it. |
| A CLI runtime is missing | Install that harness in the local environment or container image. |
| A workspace error mentions symbolic links | Use a real directory for `workspace` and replace links with the files or directories the task needs. |
| The gateway rejects a target | Check its model group name and the virtual key's allowed models. |
| A run times out | Inspect its stop reason and check detail, then adjust the corresponding execution or grading timeout. |
| The agent finishes but the run fails | Inspect the grading result. A completed agent turn alone does not mean the task succeeded. |

See the [API reference](./api_reference.md#evaluations) for the typed evaluation inputs and outputs.
