---
slug: lens-cli
title: "Introducing Lens CLI: evaluate your agent's model and harness"
date: 2026-11-21
authors: [ishaan]
description: "Evaluate models, harnesses, and custom agents on your own tasks. Compare results with Lens CLI and reuse datasets from your gateway."
image: /img/lens/cli/launch.webp
tags: [lens, engineering]
hide_table_of_contents: true
custom_hero: true
draft: true
---

import LaunchHero, {PreviewNote, ReportFigure} from './Launch';

<LaunchHero />

Before, you had to write the eval loop, create temporary workspaces and collect the results in a spreadsheet. Then you changed the model or harness and repeated the work.

**Which model and harness should you use for a given task?** Lens CLI lets you run the same tasks through your agents and compare the results in one terminal report.

This is for **developers building agents** who want to evaluate models, harnesses, and their own agent code on the work their users need done.

<PreviewNote />

{/* truncate */}

<ReportFigure src="/img/lens/cli/results.webp" alt="A real Lens CLI report ranks twelve model and harness configurations on twenty-four sample legal-QA tasks.">
A real saved run: 24 synthetic legal-QA tasks, three harnesses, four models. CLI output framed in Xnapper; model costs are estimates from token usage.
</ReportFigure>

## Choose your agents and tasks

Choose representative tasks and what counts as a correct result. Compare built-in harnesses, such as a tool loop or Codex, alongside your own agent code. Keep the same tasks and grading across configurations.

The [walkthrough](/docs/proxy/lens/cli) supplies a complete configuration that connects your agents and records their answers, costs, and tool calls.

**Already have datasets on your gateway?** Open **Lens > Datasets**, select a dataset revision, and click **Export JSONL**. The walkthrough converts that snapshot into the CLI's task format while preserving the conversation and expected answers.

## Run the CLI

With the preview CLI installed and the walkthrough's files in your project directory, run:

```bash
lens run tasks.csv --config evals.py --trials 2
```

The CLI runs the task set against your configurations. Watch the progress, then read the completed report. For an exported gateway dataset, use the walkthrough's converted file:

```bash
lens run gateway-tasks.csv --config evals.py --trials 2
```

## Read the report and choose your next change

Start with the recommendation and results table. Compare pass rate and cost, then use the **Cost vs quality** chart to see the tradeoff across your model and harness choices.

<ReportFigure src="/img/lens/cli/cost-quality.webp" alt="The real Lens CLI chart compares estimated total cost with pass rate for the same twelve model and harness configurations.">
Read up and left for configurations that pass more cases at lower estimated cost.
</ReportFigure>

In this run, Claude Agent SDK with `gpt-5.4-mini` passed all 24 cases. The same model passed 22 through OpenAI Agents and 23 through Deep Agents. The result depends on these tasks and their grader, so evaluate your own workload before choosing a default.

<ReportFigure src="/img/lens/cli/failures.webp" alt="The real Lens CLI report separates wrong answers, tool misuse and execution errors, with tool-call counts beneath them.">
Inspect wrong answers, tool misuse, and errors before deciding what to change.
</ReportFigure>

Use the failures to choose your next change, then run the same cases again.

Run through your Lens-enabled gateway, then open **Lens > Traces** to inspect captured model calls. [Instrument your agent](/docs/proxy/lens/first-trace) to include tool steps.

<ReportFigure src="/img/lens/overview-traces.webp" alt="The Lens Traces UI shows captured agent runs with inputs, duration, costs, and findings.">
Lens UI shown with sample data, separate from the CLI run above.
</ReportFigure>
