---
slug: agent-evaluations
title: "Evaluate agents on your own tasks"
date: 2026-11-16T09:00:00-08:00
authors: [ishaan]
description: "Define your agent once, evaluate typed tasks, and compare variants with LiteLLM. Export pass rate, cost and duration in a scorecard."
tags: [agents, python-sdk, ai-gateway, evaluations]
hide_table_of_contents: true
custom_hero: true
image: ./cover.png
---

import EvaluationPage from './EvaluationPage';

<EvaluationPage>

Define your agent once, then pass it to `litellm.agent_eval()` with typed tasks and success checks. Run repeated attempts and read pass rate, cost and duration in one scorecard. Keep the same agent definition when you run it on an individual request.

:::info Preview
The examples below preview the reusable `Agent` and evaluation APIs. Published PyPI releases do not include these APIs yet.
:::

## Connect to your AI Gateway {#connect}

Use a [LiteLLM AI Gateway](/docs/harness/gateway) virtual key with access to a model group. The first example calls it `model-a`. Replace that name with your group. The comparison later in this guide also uses `model-b`.

In Bash or Zsh, set the gateway root URL without `/v1`. Run `read`, then enter your virtual key. The terminal hides the input.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY
read -rs LITELLM_PROXY_API_KEY
```

Skip `read` if your secret manager has set the key. The first agent uses Tool Loop, which needs no CLI runtime.

Choose an execution backend for each attempt. The script below passes `sandbox.local`, which runs with your user's permissions. Use local execution for trusted tasks. The [sandbox guide](/docs/harness/sandboxes) covers container factories and host-side Python tools.

## Define an agent and evaluate it {#define}

Create a support agent with its harness, model and instructions. Use the same `support` object for one request and for evaluation. Save this complete script as `evaluate_agents.py`:

```python title="evaluate_agents.py"
from pathlib import Path
from tempfile import TemporaryDirectory

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
ticket = "I was charged twice for my subscription."

with TemporaryDirectory() as workspace:
    result = litellm.agent(
        support,
        ticket,
        sandbox=sandbox.local(workspace),
    )
    print(result.text)

task = EvalTask(
    id="billing-ticket",
    prompt=ticket,
    check=PredicateCheck(
        lambda result: result.text.strip().lower() == "billing"
    ),
)

report = litellm.agent_eval(
    agent=support,
    tasks=[task],
    sandbox=sandbox.local,
    trials=3,
)

print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")
```

`Agent` holds the reusable definition. Creating it does not run the agent. `litellm.agent(support, ticket, ...)` runs one request and returns a `Result`; `TemporaryDirectory` creates that run's local workspace.

`agent_eval(agent=support, tasks=[task], ...)` uses the same definition for each attempt. An `EvalTask` holds the request and the rule for success. Each attempt starts in a fresh workspace, and the earlier `Result` stays separate from the evaluation.

Run the script from the directory where you saved it:

```bash
python evaluate_agents.py
```

One task and three trials produce three evaluation runs. The initial agent call is separate from those three runs and their scorecard. The script also writes `scorecard.json` for your own analysis. Add representative tickets and their expected outcomes before choosing a production agent.

## Read the failures before comparing cost {#results}

A run passes when the agent stops with `done` and its success check passes. A failed success check or turn limit produces `fail`. Setup failures, runtime errors, timeouts and grading errors produce `error`.

Inspect unsuccessful runs after the evaluation call:

```python
from litellm import EvalStatus

for run in report.runs:
    if run.status is not EvalStatus.PASS:
        print(run.task_id, run.target, run.trial, run.detail)

for summary in report.summaries:
    print(summary.target, summary.pass_rate, summary.cost)
    print("Complete metrics:", summary.metrics_complete)
```

Pass rate includes error rows in the denominator. An unavailable runtime or failed judge request therefore remains visible in the comparison.

Compare cost alongside pass rate, token usage, model calls and tool calls. Check `metrics_complete` before treating a total as complete. The report separates agent spend from judge spend. Mean duration includes workspace preparation, setup, execution, grading and cleanup; concurrent runs can overlap.

## Compare a candidate without rebuilding your agent {#harnesses}

Use `dataclasses.replace` to create a candidate with another model. It retains the support agent's instructions and other settings. Give each definition a label with `EvalTarget`:

```python
from dataclasses import replace

from litellm import EvalTarget

candidate = replace(support, model="litellm_proxy/model-b")

comparison = litellm.agent_eval(
    tasks=[task],
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

This separate comparison produces six runs: one task, two targets and three trials. Pass either a single `agent` or a sequence of `targets` to an evaluation call.

To change the harness, [install its runtime](/docs/harness/quickstart#1-install) and create the candidate before the comparison call:

```python
candidate = replace(
    support,
    harness=Harness.CODEX,
    model="litellm_proxy/coder",
)
```

Use a model group supported by the chosen harness. This variant changes both harness and model. Keep one fixed when you want to measure the other. Give tasks unique IDs and targets unique labels.

## Choose a check for the outcome you need {#checks}

Use the same task interface for answers, writing, research and file changes:

| Check | Use it to verify |
|---|---|
| `PredicateCheck` | A final answer, tool calls or another part of the typed `Result` |
| `JudgeCheck` | An answer against a rubric, using an explicit judge model |
| `CommandCheck` | Files or project behavior with a command whose zero exit code passes |

For a writing task, create a writing variant of `support` and allow your key to call the `judge` model group:

```python
from dataclasses import replace

from litellm import JudgeCheck

writer = replace(
    support,
    instructions="Write clear customer support replies. Do not guarantee refunds.",
)
writing_task = EvalTask(
    id="support-reply",
    prompt="Reply to a customer who was charged twice. Do not promise a refund.",
    check=JudgeCheck(
        model="litellm_proxy/judge",
        rubric=(
            "Acknowledge the duplicate charge, give a clear next step, "
            "and do not guarantee a refund."
        ),
    ),
)

writing_report = litellm.agent_eval(
    agent=writer,
    tasks=[writing_task],
    sandbox=sandbox.local,
)

print(writing_report.to_markdown())
```

Choose a judge model that supports JSON output and budget for its calls. It receives the task prompt, answer and reported file changes with your rubric. A negative verdict produces `fail`; a failed request or invalid verdict produces `error`.

For tasks that need files, add `workspace` to the task. Each attempt gets a copy. The runner rejects symbolic links before creating the evaluation sandbox, including internal links, broken links and a linked workspace root. Local execution uses your user's permissions. Read the [workspace and sandbox guide](/docs/harness/evaluation#evaluate-a-task-that-changes-files) before running file tasks.

## Key takeaways

- Define an `Agent` once and pass it to evaluation with typed tasks.
- Use repeated trials and inspect the unsuccessful runs.
- Compare pass rate with cost and time, checking for incomplete metrics.
- Export the scorecard to JSON to keep a record of the comparison.

## Frequently asked questions

### Do tasks need a repository?

No. The support-routing and writing tasks above use prompts and checks. Add a workspace when your task needs starting files.

### Do I need a database?

The evaluation runner returns its scorecard in memory and can export it as JSON. It adds evaluation identifiers to model-request metadata so you can correlate calls in existing gateway logs. Persisted gateway spend logs use the gateway's existing database setup.

### Can I run evaluations in an async application?

Use `await litellm.aagent(support, ticket, ...)` for one request and `await litellm.aagent_eval(agent=support, tasks=[task], ...)` for evaluation inside your async function or notebook.

### Can I use this with LiteLLM OSS?

The reusable agent and evaluation APIs are under development in the open-source SDK. The release version will appear in this guide when it ships. [LiteLLM Enterprise](https://litellm.ai/enterprise) provides gateway controls and support for production deployments.

## Run your own comparison

Pass your agent and one task you can grade to evaluation, then inspect the outcomes. Add tasks as you find failures you want future changes to catch. The [complete evaluation guide](/docs/harness/evaluation) covers setup commands, sandboxes and execution limits.

## Recommended reading

[Evaluation API reference](/docs/harness/api_reference#evaluations), [agent harness quickstart](/docs/harness/quickstart), and [connect harnesses to your AI Gateway](/docs/harness/gateway).

</EvaluationPage>

{/* truncate */}
