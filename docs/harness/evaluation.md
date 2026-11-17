---
title: Evaluate agents
description: Compare agent harnesses and models on your own tasks with typed evaluations, repeatable runs, and a scorecard of success, cost and time.
---

# Evaluate agents

{/* keep-version-note */}

:::info Unreleased
This guide requires the SDK implementation in [PR #52174](https://github.com/BerriAI/litellm/pull/52174). It is not available in a published LiteLLM release yet.
:::

Use `litellm.agent_eval()` to compare harness and model combinations on the same tasks. Define each task and its success rule once, choose the targets, and get a scorecard with pass rate, cost, token usage, model calls, tool calls and duration.

An `EvalTask` describes the work and how to grade it. An `EvalTarget` selects a harness and model. Tasks can cover answers, research, writing, tool use or code changes. Files and test commands are optional.

## 1. Prepare your environment

Install the SDK checkout containing this feature into your Python environment. Replace `/path/to/litellm` with that checkout's root directory.

```bash
python -m pip install -e /path/to/litellm
```

This walkthrough uses Tool Loop, which needs no CLI runtime. Have a working [LiteLLM AI Gateway](./gateway.md) and a virtual key that can call two model groups. The examples name those groups `fast` and `accurate`; replace them with your own group names.

Set your gateway's root URL, without `/v1`, and load its virtual key from your secret manager into `LITELLM_PROXY_API_KEY`.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
```

The script below prompts for the key if the environment variable is unset. To compare Claude Code, Codex or another CLI harness, first install that harness's dependencies from the [quickstart](./quickstart.md#1-install).

## 2. Define tasks and targets

Save this complete example as `evaluate_agents.py`.

```python title="evaluate_agents.py"
import os
from getpass import getpass
from pathlib import Path

import litellm
from litellm import EvalTarget, EvalTask, Harness, PredicateCheck


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
    EvalTarget(
        harness=Harness.TOOL_LOOP,
        model="litellm_proxy/fast",
        label="fast",
    ),
    EvalTarget(
        harness=Harness.TOOL_LOOP,
        model="litellm_proxy/accurate",
        label="accurate",
    ),
]


def main() -> None:
    if not os.environ.get("LITELLM_PROXY_API_KEY"):
        os.environ["LITELLM_PROXY_API_KEY"] = getpass("Gateway virtual key: ")

    report = litellm.agent_eval(
        tasks=tasks,
        targets=targets,
        trials=1,
        max_concurrency=2,
        timeout=120,
        metadata={"experiment": "support-routing"},
    )

    print(report.to_markdown())
    Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")

    assert len(report.runs) == len(tasks) * len(targets)


if __name__ == "__main__":
    main()
```

`PredicateCheck` receives the agent's `Result` and returns a boolean. It can inspect the final text, structured output, file changes or events. Use an async predicate when grading requires async work.

Each target can use a different harness, model and harness-specific `options`. A label names that setup in the scorecard. Task IDs and resolved target labels must be unique.

## 3. Run the comparison

From the directory containing `evaluate_agents.py`, run:

```bash
python evaluate_agents.py
```

Two tasks and two targets with one trial produce four run rows. Look for summary rows named `fast` and `accurate`, each with two total attempts. A target that returns both expected categories and stops with `done` has `2/2` passed runs. `scorecard.json` contains the same results for your own analysis. Increase `trials` to repeat the comparison with independent runs.

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

Run this code after the evaluation call, inside `main()`, where `report` is defined.

Pass rate is passed runs divided by all scheduled runs, including errors. Known usage from unsuccessful runs remains in the totals. `metrics_complete=False` marks a summary whose cost or usage could not be collected for every run. Mean duration covers workspace preparation, setup, agent execution, grading and cleanup. It differs from suite wall time because runs can overlap.

Judge usage and cost appear separately from agent usage and cost. The JSON schema contains result data and identifiers, excluding authentication configuration, Python callables and raw internal event objects.

The runner attaches `agent_eval_suite`, `agent_eval_run`, `agent_eval_task`, `agent_eval_target` and `agent_eval_trial` metadata to model requests. Your metadata accompanies those fields. Use these identifiers to correlate requests in existing gateway logs. Persisted spend logs require the gateway's existing database setup.

## Async execution

Use `aagent_eval()` inside an async application or notebook. This example reuses the tasks and targets from `evaluate_agents.py`.

```python
import asyncio

import litellm
from evaluate_agents import tasks, targets


async def main() -> None:
    report = await litellm.aagent_eval(
        tasks=tasks,
        targets=targets,
        trials=3,
        max_concurrency=2,
        timeout=120,
    )
    print(report.to_markdown())


asyncio.run(main())
```

Set `LITELLM_PROXY_API_KEY` before running this script. In a notebook, call `await main()` instead of `asyncio.run(main())`.

## Grade writing or research with a model

Use `JudgeCheck` when a rubric is more useful than an exact match. Choose the judge model explicitly. The judge receives the rubric, task prompt, final answer and reported file changes. It does not inspect a workspace on its own.

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

Add `writing_task` to `tasks` and allow your virtual key to call the `judge` model group. Judge calls incur additional usage and cost. A failed or invalid judge response becomes an error row rather than a passing grade.

## Evaluate a task that changes files

Skip this section for tasks that need no starting files. Supply `workspace` when an agent needs an existing project. Each attempt gets a fresh copy, and the original directory remains unchanged. The runner excludes `.git` metadata so a copied project does not share Git state with the source.

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

`CommandCheck` runs inside the attempt's sandbox after the agent finishes. Exit code zero passes. The assertions in this example belong to the evaluator configuration, outside the editable workspace. Add `setup` commands to a task when it needs dependencies installed before execution. Setup and grading use the same sandbox as the agent.

Tool Loop has no built-in file or shell tools. Use a coding harness for this example. Caller-supplied Python tools execute in the SDK process and do not gain sandbox isolation automatically.

## Choose a sandbox and execution limits

By default, the runner creates a local sandbox in a temporary directory for each attempt. Local execution uses your user's permissions. A copied workspace separates file edits between runs; it does not isolate host installations or network access.

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
| `trials` | `1` | Independent attempts per task and target |
| `max_concurrency` | `1` | Concurrent attempts, including setup and grading |
| `timeout` | `300` | Seconds allowed for each agent execution |
| `setup_timeout` | `120` | Seconds allowed for the setup stage of each attempt |
| `CommandCheck.timeout` | `30` | Seconds allowed for the grading command |
| `JudgeCheck.timeout` | `30` | Seconds allowed for the judge request |
| `max_turns` | `None` | Existing agent turn limit, which counts tool-call events rather than model calls |

Temporary workspaces and runner-owned sandboxes close after each attempt. The scorecard retains reported file changes and check details, so inspect or export those results rather than temporary paths.

## Troubleshoot a run

| Symptom | Next action |
|---|---|
| Importing `agent_eval` fails | Use the SDK checkout containing this unreleased feature. |
| A CLI runtime is missing | Install that harness in the local environment or container image. |
| The gateway rejects a target | Check its model group name and the virtual key's allowed models. |
| A run times out | Inspect its stop reason and check detail, then adjust the corresponding execution or grading timeout. |
| The agent finishes but the run fails | Inspect the grading result. A completed agent turn alone does not mean the task succeeded. |

See the [API reference](./api_reference.md#evaluations) for the typed evaluation inputs and outputs.
