---
slug: moyai-open-source
title: "Open Sourcing Moyai: Self-Hosted Cloud Coding Agent"
date: 2026-10-07T09:00:00
authors:
  - ishaan
  - tin
  - moe
description: "We open sourced Moyai, the self-hosted cloud coding agent we run at LiteLLM. It runs Claude Code or Codex on 100+ providers through LiteLLM, and cut our coding agent bill by 79%."
tags: [agents, open-source, infrastructure]
hide_table_of_contents: true
custom_hero: true
---

import MoyaiLaunchHero, {LogoWall, HARNESSES, PROVIDERS} from './MoyaiLaunchHero';
import CostChart from './CostChart';
import {PostByline} from '@theme/BlogPostPage';

export const sections = [
  ['the-problem', 'The problem'],
  ['the-results-79-cheaper', 'The results: 79% cheaper'],
  ['why-were-open-sourcing-it', "Why we're open sourcing it"],
  ['a-cloud-agent-that-keeps-working', 'A cloud agent that keeps working'],
  ['any-harness', 'Any harness'],
  ['any-model-any-provider', 'Any model, any provider'],
  ['get-started', 'Get started'],
];

<MoyaiLaunchHero date="October 7, 2026" sections={sections} />

<PostByline />

Today we're open sourcing [Moyai](https://github.com/BerriAI/moyai), the self-hosted cloud coding agent our team runs every day. You give it a task in Slack or the browser, and it opens a pull request while your laptop is closed. It runs Claude Code or Codex on any of the 100+ providers LiteLLM supports

{/* truncate */}

## The problem

Our Devin bill hit $101,872 in a single month, and only our own team used it. Our engineers kicked off those sessions and automations on models and routing we couldn't control

![Devin billing dashboard showing $101,872.24 spent between Aug 30 and Sep 29, with daily spend peaking above $10,000.](/img/blog/moyai_devin_open_source/devin-bill.png)

We already run a gateway that routes across 100+ providers. We wanted our coding agent on our own models and routing, paying for inference instead of seats

## The results: 79% cheaper

Moyai does the same work for about $700 a day. Over those 31 days we'd have paid about $21,700 instead of $101,872, and kept $80,000 of one month's bill

<CostChart />

## Why we're open sourcing it

Last week we wrote about [how we built our own internal Devin in 2 days](/blog/internal-devin-two-days), and most replies asked to run it themselves. Moyai is the same code we run in production at LiteLLM. You deploy it on your own infrastructure and point it at your own LiteLLM gateway, so your code and credentials stay in your accounts

## A cloud agent that keeps working

Each session gets its own cloud workspace with a terminal, a filesystem and a browser. The agent edits code and runs your tests there, then opens a pull request for you to review

You can follow along in the web app and send a correction while it works, or pick the thread back up in Slack the next morning. For large tasks, the agent splits the work across parallel workers on separate machines and collects their results

## Any harness

You pick the agent harness for each session from the composer. Moyai runs it in the same isolated workspace with the same tools and permissions

<LogoWall title="Harnesses" items={HARNESSES} />

Claude Code, Codex, OpenCode and Deep Agents run through the LiteLLM agent SDK. Adding another harness takes one registry entry

## Any model, any provider

Moyai sends model requests through LiteLLM. You can switch from GPT-6 Astra to Claude Opus 5.5 between messages, and LiteLLM attributes each request to the teammate who made it. Provider keys stay on the server, out of the sandbox

<LogoWall title="Providers" items={PROVIDERS} />

LiteLLM supports 100+ providers, and Moyai can use any of them

## Get started

You can try the local demo in a couple of minutes without API keys

```sh
git clone https://github.com/BerriAI/moyai.git
cd moyai
cp .env.example .env
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8787 --workers 1
```

To run real tasks, [set up cloud execution](https://github.com/BerriAI/moyai/blob/main/docs/deployment.md) with Modal and your LiteLLM gateway, then [connect your apps](https://github.com/BerriAI/moyai/blob/main/docs/integrations.md). Issues and PRs are welcome on [GitHub](https://github.com/BerriAI/moyai)
