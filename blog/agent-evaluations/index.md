---
slug: agent-evaluations
title: "Evaluate agents on your own tasks"
date: 2026-11-16T09:00:00-08:00
authors: [ishaan]
description: "Compare agent harnesses and models through LiteLLM AI Gateway. Define typed tasks, repeat attempts and export a scorecard with this Python guide."
tags: [agents, python-sdk, ai-gateway, evaluations]
hide_table_of_contents: true
custom_hero: true
image: ./cover.jpg
draft: true
---

import EvaluationPage from './EvaluationPage';

<EvaluationPage>

Choose an agent setup by running it on the work you need done. With `litellm.agent_eval()`, you define typed tasks and success checks, choose harness and model targets, and compare pass rate, cost and duration in one scorecard.

:::info Release draft
The evaluation API has not shipped in a PyPI release. The code below previews the interface. This post needs a verified release version and installation command before publication.
:::

## Connect to your AI Gateway {#connect}

Use a [LiteLLM AI Gateway](/docs/harness/gateway) virtual key with access to two model groups. The examples call them `model-a` and `model-b`. Replace those names with your groups.

In Bash or Zsh, set the gateway root URL without `/v1`. Run `read`, then enter your virtual key. The terminal hides the input.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY
read -rs LITELLM_PROXY_API_KEY
```

Skip `read` if your secret manager has set the key. The first comparison uses Tool Loop, which needs no CLI runtime.

Choose an execution backend for each attempt. The script below passes `sandbox.local`, which runs with your user's permissions. Use local execution for trusted tasks. The [sandbox guide](/docs/harness/sandboxes) covers container factories and host-side Python tools.

## Define a task and its success check {#define}

Start with a support ticket. Ask the agent to choose a category and check its final answer. Save this complete script as `evaluate_agents.py`:

```python title="evaluate_agents.py"
from pathlib import Path

import litellm
from litellm import EvalTarget, EvalTask, Harness, PredicateCheck, sandbox


task = EvalTask(
    id="billing-ticket",
    prompt=(
        "Classify this ticket as billing, technical, or sales. "
        "Reply with only the category.\n"
        "Ticket: I was charged twice for my subscription."
    ),
    check=PredicateCheck(
        lambda result: result.text.strip().lower() == "billing"
    ),
)

targets = [
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-a", label="model-a"),
    EvalTarget(Harness.TOOL_LOOP, "litellm_proxy/model-b", label="model-b"),
]

report = litellm.agent_eval(
    tasks=[task],
    targets=targets,
    sandbox=sandbox.local,
    trials=3,
    max_concurrency=2,
)

print(report.to_markdown())
Path("scorecard.json").write_text(report.to_json(), encoding="utf-8")
```

An `EvalTask` holds the prompt and the rule for success. An `EvalTarget` selects the harness and model. You can keep the task fixed while changing either part of the target.

Run the script from the directory where you saved it:

```bash
python evaluate_agents.py
```

One task, two targets and three trials produce six runs. In the scorecard, each target has three attempts. The script also writes `scorecard.json` for your own analysis. Add representative tickets and their expected outcomes before choosing a production target.

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

## Compare harnesses with the same task {#harnesses}

To compare Claude Code and Codex, [install their runtimes](/docs/harness/quickstart#1-install) and replace `targets` in the script:

```python
targets = [
    EvalTarget(Harness.CLAUDE_CODE, "litellm_proxy/model-a", label="claude-code"),
    EvalTarget(Harness.CODEX, "litellm_proxy/model-b", label="codex"),
]
```

Use model groups supported by each harness. This compares two complete setups, changing both the harness and model. To measure one change, keep the other fixed where the harnesses support the same model.

The SDK runs each task against each target and repeats the pair `trials` times. Give each task a unique ID and each target a unique label.

## Choose a check for the outcome you need {#checks}

Use the same task interface for answers, writing, research and file changes:

| Check | Use it to verify |
|---|---|
| `PredicateCheck` | A final answer, tool calls or another part of the typed `Result` |
| `JudgeCheck` | An answer against a rubric, using an explicit judge model |
| `CommandCheck` | Files or project behavior with a command whose zero exit code passes |

For a writing task, replace `task` in the script and allow your key to call the `judge` model group:

```python
from litellm import JudgeCheck

task = EvalTask(
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
```

Choose a judge model that supports JSON output and budget for its calls. It receives the task prompt, answer and reported file changes with your rubric. A negative verdict produces `fail`; a failed request or invalid verdict produces `error`.

For tasks that need files, add `workspace` to the task. Each attempt gets a copy. The runner rejects symbolic links before creating the evaluation sandbox, including internal links, broken links and a linked workspace root. Local execution uses your user's permissions. Read the [workspace and sandbox guide](/docs/harness/evaluation#evaluate-a-task-that-changes-files) before running file tasks.

## Key takeaways

- Define the task and its success check once, then choose your targets.
- Use repeated trials and inspect the unsuccessful runs.
- Compare pass rate with cost and time, checking for incomplete metrics.
- Export the scorecard to JSON to keep a record of the comparison.

## Frequently asked questions

### Do tasks need a repository?

No. The support-routing and writing tasks above use prompts and checks. Add a workspace when your task needs starting files.

### Do I need a database?

The evaluation runner returns its scorecard in memory and can export it as JSON. It adds evaluation identifiers to model-request metadata so you can correlate calls in existing gateway logs. Persisted gateway spend logs use the gateway's existing database setup.

### Can I run evaluations in an async application?

Use `await litellm.aagent_eval(...)` inside your async function or notebook with the same tasks, targets and options. Replace the synchronous call in the example.

### Can I use this with LiteLLM OSS?

The evaluation API is under development in the open-source SDK. The release version will appear in this guide when it ships. [LiteLLM Enterprise](https://litellm.ai/enterprise) provides gateway controls and support for production deployments.

## Run your own comparison

Pick one task you can grade, run it against two targets, and inspect the outcomes. Expand the task set as you find failures you want future changes to catch. The [complete evaluation guide](/docs/harness/evaluation) covers setup commands, sandboxes and execution limits.

## Recommended reading

[Evaluation API reference](/docs/harness/api_reference#evaluations), [agent harness quickstart](/docs/harness/quickstart), and [connect harnesses to your AI Gateway](/docs/harness/gateway).

</EvaluationPage>

{/* truncate */}
