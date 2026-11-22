---
slug: lens-profiles
title: "Lens Profiles: Turn Production Traffic Into Task-Level Model Evals"
date: 2026-11-19
authors: [joshua]
description: "Discover your agents' tasks, find what drives spend, and compare model cost and latency using production workloads."
tags: [lens, agent-tracing, engineering]
hide_table_of_contents: true
---

import { TaskDiscovery, WorkloadMap, CostAttribution, CapabilityMatrix, EvaluationWorkflow } from './visuals';

**Understand the work. Find the cost drivers. Evaluate the models that serve it.**

Your coding agent fixes tests, implements features, and compares designs. Each task puts different demands on the model. Knowing which tasks dominate your traffic and spend helps you decide where a model change would have the greatest impact.

The revised **Lens Profiles** discovers those tasks automatically from production traffic. It connects each category to gateway-recorded costs, shows how model deployments compare, and takes you directly to the runs behind the numbers. You get a workload-specific starting point for optimization and model evals.

{/* truncate */}

## Discover what your agents actually do

Lens samples an agent's runs, extracts the intent of each request, and groups similar work into named task categories. Requests about a failing login test and a flaky retry test can become **Debug failing tests**, even when they refer to different parts of your codebase.

<TaskDiscovery />

**You don't need to label every run or design a taxonomy from scratch.** Review the discovered categories and activate classification for new runs, with optional historical backfill. As your agent takes on new work, rediscover categories to keep the view relevant.

## See which tasks dominate your traffic

The similarity map groups sampled runs by task, so you can explore related requests and inspect the work within each category. The legend puts those clusters in context: it shows each category's total run count alongside the number plotted on the map.

<WorkloadMap />

The screenshot shows **300 sampled runs from a workload of 24,000 runs**. The debugging cluster contains 96 sampled runs; its legend entry reports **7,680 total debugging runs**, or 32% of the workload. Feature implementation accounts for another 5,760 runs. Those totals help you prioritize improvements and choose which tasks deserve substantial representation in your evals.

## Find the tasks that drive spend

Lens attributes costs from gateway spend records to the tasks behind your agent's traces. You can rank profiles by spend, compare that with their traffic share, and open the supporting runs to understand what makes a task expensive.

<CostAttribution />

**Prioritize the work with the largest opportunity.** With **Spend** selected, debugging leads the breakdown at **$4,285.44 across 7,680 runs**. That is approximately 54% of the $7,970.40 total shown above, despite representing 32% of runs. Inspect those model calls and test whether another deployment can handle representative cases at a lower cost.

You can move from a budget question to the specific work behind it, with task-level costs drawn from the same gateway records used to track model spend.

## Compare models on the tasks that matter

The **Avg cost** view below pairs each task's average request cost with the number of observed requests for each deployment. Lens also provides **Requests** and **p95 latency** views, so you can compare traffic volume, cost, and responsiveness at the task level.

<CapabilityMatrix />

In the debugging row, the dashboard displays an average request cost of **$0.01 on haiku-production** and **$0.05 on sonnet-production**, alongside 34,560 and 80,640 observed requests. Use these task-specific differences to choose **which model comparisons are worth running**, then evaluate representative cases before changing deployments.

Open a profile to inspect its model breakdown and recent runs. **Investigate these runs** prepares an investigation scoped to the selected profile, so you can examine the behavior behind a costly or slow workload.

## Build evals around real customer work

Discovered categories give your evals a structure; their underlying traces give you realistic cases. Select examples from frequent or expensive tasks, define what success means for each, and compare candidate models on work your users actually ask for.

<EvaluationWorkflow />

For debugging, that might mean checking whether a proposed fix passes the relevant tests. For structured configuration, it might mean validation against a schema. Combine those quality checks in your evaluation workflow with the task-level cost and latency Lens exposes to build a capability view specific to your workloads.

**Use production traffic to prioritize your next eval.** Focus comparisons on the tasks where better model selection could have the greatest effect on cost, responsiveness, or the user experience.

## Get started

Open **Profiles → Task discovery**, choose your discovery, embedding, and decision models, and select a period with at least 20 eligible runs. Discover the categories, review their descriptions, and start classifying new runs.

Start with your highest-spend profile. Compare its deployments, inspect representative runs, and choose the next model evaluation based on the opportunity you find.

<div className="lp-launch">
<p><strong>Put your agent traffic to work</strong></p>
<p>Follow the <a href="https://docs.litellm.ai/docs/proxy/lens">Lens setup guide</a> and the <a href="https://github.com/BerriAI/lens/blob/main/docs/task-profiles.md">Profiles reference</a> to get started.</p>
</div>
