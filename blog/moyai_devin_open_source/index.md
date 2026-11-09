---
slug: moyai-open-source
title: "Open Sourcing Moyai: Self-Hosted Cloud Coding Agent"
date: 2026-10-07T09:00:00
authors:
  - ishaan
  - tin
  - moe
description: "Run cloud coding agents on your own infrastructure with Moyai. Choose your agent and models through LiteLLM, track costs, and follow the setup guide."
tags: [agents, open-source, infrastructure]
hide_table_of_contents: true
custom_hero: true
---

import MoyaiLaunchHero, {LogoWall, HARNESSES, PROVIDERS} from './MoyaiLaunchHero';
import CostChart from './CostChart';
import BugWorkflowDemo from '../internal-devin-two-days/BugWorkflowDemo';
import {PostByline} from '@theme/BlogPostPage';

export const sections = [
  ['the-problem', 'The problem'],
  ['the-results-79-cheaper', 'Our cost estimate'],
  ['why-were-open-sourcing-it', "Why we're open sourcing it"],
  ['a-cloud-agent-that-keeps-working', 'A cloud agent that keeps working'],
  ['any-harness', 'Choose your agent'],
  ['any-model-any-provider', 'Choose your models'],
  ['one-source-of-truth-for-model-costs', 'Know what you spend'],
  ['get-started', 'Set up your first task'],
];

<MoyaiLaunchHero date="October 7, 2026" sections={sections} />

<PostByline />

Today we're open sourcing [Moyai](https://github.com/BerriAI/moyai), the cloud coding agent our team runs at LiteLLM. Give it a task in Slack or the browser, then come back to a pull request with code and test results to review. You choose the agent and compatible model, run it on your infrastructure, and track the cost through LiteLLM.

[Set up your first cloud task](/docs/self_hosted_coding_agents/moyai/setup), or see the cost comparison and a real bug fix below.

{/* truncate */}

## The problem

Our Devin bill hit $101,872 in a single month, and only our own team used it. Our engineers kicked off those sessions and automations on models and routing we couldn't control.

![Devin billing dashboard showing $101,872.24 spent between Aug 30 and Sep 29, with daily spend peaking above $10,000.](/img/blog/moyai_devin_open_source/devin-bill.png)

We already run a gateway that routes across 100+ providers. We wanted to choose the model and routing for each coding task, with the usage visible in our own gateway.

## Our estimate: 79% lower costs {#the-results-79-cheaper}

We estimate about $700 a day to run Moyai for our team. Over 31 days, that comes to about $21,700 against our $101,872 Devin bill: roughly $80,000 less, or 79% lower estimated cost. This is an internal comparison, not a matched-workload benchmark. Your model mix, workload, compute, and storage determine your costs.

<CostChart />

## Why we're open sourcing it

Last week we wrote about [how we built our own internal Devin in 2 days](/blog/internal-devin-two-days), and most replies asked to run it themselves. Moyai is the same code we run in production at LiteLLM. You deploy it on your infrastructure and point it at your LiteLLM gateway. You control the installation and provider access; model requests still go to the provider you select.

## A cloud agent that keeps working

Each session gets its own cloud workspace with a terminal, a filesystem, and a browser. The agent edits code and runs your tests there, then opens a pull request for you to review. Closing your laptop leaves the cloud task running.

You can follow along in the web app and send a correction while it works, or pick the thread back up in Slack the next morning. For large tasks, the agent can split work across parallel workers and collect their results.

Watch a real bug fix move from a Slack request through investigation and regression tests to a pull request:

<BugWorkflowDemo />

## Choose the agent for the task {#any-harness}

Pick a supported agent such as Codex, Claude Agent SDK, or Hermes when you start a session. Moyai runs it in a cloud workspace with the connections you enable.

<LogoWall title="Harnesses" items={HARNESSES} />

Check the [agent and model compatibility table](/docs/self_hosted_coding_agents/moyai/setup#configure-litellm) when choosing a combination for your gateway.

## Choose your models through LiteLLM {#any-model-any-provider}

Moyai sends model requests through LiteLLM. Choose a compatible model for the task and your budget, with provider keys kept on the gateway. Moyai attributes each tracked request to the teammate who sent the message.

<LogoWall title="Providers" items={PROVIDERS} />

LiteLLM supports 100+ providers. Your selected agent needs a model and gateway endpoint that support its protocol and tool calls.

## One source of truth for model costs

Moyai uses LiteLLM's reported charges for its per-user, session, and model breakdowns. You can see which teammates and tasks account for spend, then check a tracked request against the same gateway cost. See the [spend dashboard](/docs/self_hosted_coding_agents/moyai#see-agent-spend) and [cost accounting details](/docs/self_hosted_coding_agents/moyai/architecture#cost-accounting).

## Set up your first cloud task {#get-started}

Bring a Modal account, a reachable LiteLLM gateway, and a key for your chosen model. [Follow the setup guide](/docs/self_hosted_coding_agents/moyai/setup) to deploy Moyai, verify a cloud task, and connect one repository. Give it a small bug your team already understands. Review the PR, test output, and model cost before expanding the rollout.

You own the installation, updates, credentials, and backups. You pay for model usage and cloud infrastructure. Read the [architecture guide](/docs/self_hosted_coding_agents/moyai/architecture) for the system design, checkpoints, and recovery behavior.

<details>
<summary>Preview the interface locally first</summary>

The local demo lets you explore the interface without model credentials. Demo tasks are simulated; they do not verify cloud execution.

```sh
git clone https://github.com/BerriAI/moyai.git
cd moyai
cp .env.example .env
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8787 --workers 1
```

</details>

Issues and PRs are welcome on [GitHub](https://github.com/BerriAI/moyai).
