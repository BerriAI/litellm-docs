---
slug: moyai-open-source
title: "Moyai is now open source"
date: 2026-10-07T09:00:00
authors:
  - ishaan
  - tin
  - moe
description: "Moyai is now open source: a self-hosted cloud agent that works with Claude Code and Codex across 100+ providers through LiteLLM."
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

Today we're open sourcing [Moyai](https://github.com/BerriAI/moyai), the self-hosted cloud agent our team uses every day. It works with Claude Code and Codex, runs on 100+ providers through LiteLLM, and turns a task from Slack or the browser into a pull request while your laptop is closed

{/* truncate */}

## The problem

Our Devin bill hit $101,872 in a single month, and it was only being used internally. Most of that spend came from sessions and automations our own engineers kicked off, on models and routing we had no control over

![Devin billing dashboard showing $101,872.24 spent between Aug 30 and Sep 29, with daily spend peaking above $10,000.](/img/blog/moyai_devin_open_source/devin-bill.png)

We already run a gateway that routes across 100+ providers. We wanted to point our coding agent at our own models and our own routing logic, and pay for inference instead of seats

## The results: 79% cheaper

Moyai does the same work for about $700 a day. Over the same 31 days that's roughly $21,700 instead of $101,872, so we kept about $80,000 of a single month's bill

<CostChart />

## Why we're open sourcing it

Last week we wrote about [how we built our own internal Devin in 2 days](/blog/internal-devin-two-days). The response was mostly one question: can we run it too?

Now you can. Moyai is the same code we run in production at LiteLLM. Deploy it on your own infrastructure, point it at your own LiteLLM gateway, and keep your code, credentials and spend inside your own accounts

## A cloud agent that keeps working

Every session gets its own cloud workspace with a terminal, a filesystem and a browser. The agent edits code, runs your tests and prepares a pull request for review, all without touching anyone's laptop

Sessions are durable. You can follow along from the web app, send a correction mid-task, or pick the thread back up in Slack the next morning. Large tasks can fan out to parallel worker agents, each on its own machine, and come back together when they finish

<p className="moyai-big">Start a task in Slack. Come back to a PR.</p>

## Any harness

The agent loop is a choice, not a lock-in. Pick the harness for each session from the composer, and Moyai runs it in the same isolated workspace with the same tools, connections and permissions

<LogoWall title="Harnesses" items={HARNESSES} />

Hermes is the default. Claude Code, Codex, OpenCode and Deep Agents run through the LiteLLM agent SDK, so adding the next harness is a registry entry instead of a rewrite

## Any model, any provider

Every model request goes through LiteLLM. Switch from GPT-6 Astra to Claude Opus 5.5 to GLM-5.3 between messages, and every request is attributed to the teammate who made it. Provider keys stay on the server; the sandbox never sees them

<LogoWall title="Providers" items={PROVIDERS} />

That's 100+ providers out of the box. If LiteLLM can call it, Moyai can use it

## Get started

Clone the repo and try the local demo in a couple of minutes, no API keys required

```sh
git clone https://github.com/BerriAI/moyai.git
cd moyai
cp .env.example .env
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8787 --workers 1
```

Then [set up cloud execution](https://github.com/BerriAI/moyai/blob/main/docs/deployment.md) with Modal and your LiteLLM gateway, and [connect your apps](https://github.com/BerriAI/moyai/blob/main/docs/integrations.md). Star the [repo on GitHub](https://github.com/BerriAI/moyai), open an issue, or send us a PR. Moyai will probably review it
