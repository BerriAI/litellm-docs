---
title: Evaluate agents with litellm.agent_eval()
sidebar_label: Evaluate agents
description: Use litellm.agent_eval() to compare agent harnesses and models on repeatable tasks and score their success, cost, and time.
---

# Evaluate agents with `litellm.agent_eval()`

{/* keep-version-note */}

:::info Unreleased API preview
`agent_eval()` and `aagent_eval()` are not available in a published LiteLLM release yet. The examples below preview the API. This guide needs a verified release version and installation instructions before publication.
:::

Compare agent harnesses and models on your own tasks with `litellm.agent_eval()`. Define the work and its success check in an `EvalTask`, then choose a harness and model with an `EvalTarget`. Compare pass rate, cost and duration in the scorecard.

## 1. Configure your AI Gateway

Use a [LiteLLM AI Gateway](./gateway.md) virtual key that can call two model groups. This example names them `model-a` and `model-b`. Replace those names with your groups. Both targets use Tool Loop, which needs no CLI runtime.

In Bash or Zsh, set your gateway's root URL, without `/v1`, and enter your virtual key after running `read`. The terminal hides the input:

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY
read -rs LITELLM_PROXY_API_KEY
```

Skip the `read` command if your secret manager has set `LITELLM_PROXY_API_KEY`. To compare CLI harnesses such as Claude Code or Codex, install their dependencies from the [quickstart](./quickstart.md#1-install).

## 2. Define tasks and targets

Save this complete example as `evaluate_agents.py`.

Choose a sandbox factory for each evaluation call. This example uses `sandbox.local` for trusted tasks that can run with your user's permissions. The runner passes a fresh temporary workspace to the factory for each attempt.

```python title="evaluate_agents.py"
from pathlib import Path

import litellm
from litellm import EvalTarget, EvalTask, Harness, PredicateCheck, sandbox


tasks = [
    EvalTask(
        id="billing-ticket",
        prompt=(
            "Classify this ticket as billing, technical, or sales. "
            "Reply with only the category.\n"
            "Ticket: I was charged twice for my subscription."
        ),
        check=PredicateCheck(
            lambda result: result.text.strip().lower() == "billing"
        ),
    ),
    EvalTask(
        id="technical-ticket",
        prompt=(
            "Classify this ticket as billing, technical, or sales. "
            "Reply with only the category.\n"
            "Ticket: The app crashes whenever I upload a PDF."
        ),
        check=PredicateCheck(
            lambda result: result.text.strip().lower() == "technical"
        ),
    ),
]

targets = [
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-a", label="model-a"),
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-b", label="model-b"),
]

report = litellm.agent_eval(
    tasks=tasks,
    targets=targets,
    sandbox=sandbox.local,
    max_concurrency=2,
)

print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")
```

`PredicateCheck` receives the agent's `Result` and returns a boolean. Check the final answer, tool calls or another part of the result. Predicates can be sync or async.

Each target can use a different harness, model and harness-specific `options`. Use a label to identify each setup in the scorecard. Task IDs and resolved target labels must be unique.

## 3. Run the comparison

From the directory containing `evaluate_agents.py`, run:

```bash
python evaluate_agents.py
```

Two tasks and two targets produce four runs. In the `model-a` and `model-b` summaries, confirm that each target has two attempts. A target that returns both expected categories and stops with `done` has `2/2` passed runs. Use `scorecard.json` for your own analysis.

Set `trials=3` to repeat each task and target three times. This example then produces twelve runs.

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

## Async execution

In an async function or notebook, use `aagent_eval()` with the same tasks and targets:

```python
report = await litellm.aagent_eval(
    tasks=tasks,
    targets=targets,
    sandbox=sandbox.local,
    max_concurrency=2,
)

print(report.to_markdown())
```

## Grade writing or research with a model

Use `JudgeCheck` to grade against a rubric. Choose a judge model that supports JSON output. The judge receives the task prompt, answer and reported file changes, together with your rubric. It can grade file diffs but cannot read other workspace files.

```python
from litellm import EvalTask, JudgeCheck

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
```

Add `writing_task` to `tasks` and allow your virtual key to call the `judge` model group. Budget for these calls in addition to the agent runs.

A valid negative verdict produces `fail`. A failed judge request or invalid verdict produces `error`.

## Evaluate a task that changes files

For a task that needs starting files, pass a project directory as `workspace`. Each attempt gets a copy. The agent edits that copy, and the runner excludes `.git` metadata to keep Git state separate from the source.

Use a real directory for `workspace`. The runner rejects symlinks in the copied project before creating a sandbox, including links within the project and broken links. It also rejects a symlink used as the workspace root.

Create `calculator/calc.py` with a bug:

```python title="calculator/calc.py"
def add(a, b):
    return a - b
```

Replace the tasks and targets in `evaluate_agents.py` with this example. Install the CLI runtimes first using the [quickstart](./quickstart.md#1-install), and use model groups available to your key.

```python
from pathlib import Path

from litellm import CommandCheck, EvalTarget, EvalTask, Harness

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

targets = [
    EvalTarget(Harness.CLAUDE_CODE, "litellm_proxy/claude"),
    EvalTarget(Harness.CODEX, "litellm_proxy/gpt"),
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
    tasks=tasks,
    targets=targets,
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
| `timeout` | `300` | Seconds allowed for each agent execution |
| `setup_timeout` | `120` | Seconds allowed for the setup stage of each attempt |
| `CommandCheck.timeout` | `30` | Seconds allowed for the grading command |
| `JudgeCheck.timeout` | `30` | Seconds allowed for the judge request |
| `max_turns` | `None` | Existing agent turn limit, which counts tool-call events rather than model calls |

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
