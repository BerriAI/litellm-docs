---
slug: litellm-lens-launch
title: "Launching LiteLLM Lens"
date: 2026-10-01T09:00:00
authors:
  - ishaan
  - moe
  - tin
  - yujonglee
description: "LiteLLM Lens turns the traces flowing through your gateway into findings your agents can act on. Built for agent swarms generating 200K+ traces."
image: /img/blog/litellm_lens_launch/lens_hero.gif
tags: [lens, agent-tracing]
hide_table_of_contents: true
custom_hero: true
---

import Head from '@docusaurus/Head';
import LaunchHero, {Partner, SideRails} from './LaunchHero';
import {PostByline} from '@theme/BlogPostPage';

<Head>
  <meta property="og:image" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.gif" />
  <meta property="og:image:type" content="image/gif" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="420" />
  <meta property="og:video" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.mp4" />
  <meta property="og:video:type" content="video/mp4" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.gif" />
</Head>

export const sections = [
  ['the-agentic-swarm-developer', 'The agentic swarm developer'],
  ['the-problem', 'The problem'],
  ['our-solution', 'Our solution'],
  ['launch-partners', 'Launch partners'],
  ['get-started', 'Get started'],
];

<LaunchHero
  date="October 1, 2026"
  tagline="The gateway that helps your agents improve"
  sections={sections}
/>

<PostByline />

<SideRails sections={sections} />

Today we're launching LiteLLM Lens

## The agentic swarm developer

We're building for a future where developers run agentic swarms: hundreds of agents working in parallel, each one making LLM and tool calls, together generating 200K+ traces

LiteLLM is already the chokepoint for 100% of your enterprise's AI traffic, so every one of those calls already flows through the gateway

{/* truncate */}

## The problem

Nobody can read 200K traces by hand. When a swarm gets something wrong, the evidence is spread across thousands of runs, and you can't tell what's working, what's failing, or how your agents should improve

Tracing platforms make it harder. Your data sits in someone else's system behind rate limits, so you can't point Codex or Claude Code at it to dig in

## Our solution

We believe the next era of the gateway is using the data flowing through it to help your agents improve. Lens does two things

### Making sense of 200K+ traces

Lens uses AI agents to review your traces for you. You describe what a good run looks like. Lens investigates the runs, groups similar problems, and links every finding back to the original trace step

![A finding showing what happened, what to do next, and links to the supporting runs.](/img/lens/finding-detail.png)

### Agent-first tracing APIs

Own your infra. Traces land in ClickHouse that you run, next to the LiteLLM gateway you already deploy. Query them with simple SQL, or let Codex and Claude Code analyze them through the tracing API without tracing-platform rate limits

![An agent trace with its step tree, timeline, and selected step input and output.](/img/lens/trace-detail.png)

## Launch partners

Lens was built and designed with our launch partners

<Partner href="https://www.mindfort.ai/" logo="/img/blog/litellm_lens_launch/partners/mindfort.svg" name="MindFort">
  Autonomous security agents · mindfort.ai
</Partner>

## Get started

The era of self-improving agents is here. [Sign up for early access](https://forms.gle/3GC1Ner4vjthGWi18), or follow the [Lens docs](/docs/proxy/lens) to deploy it on your own LiteLLM gateway today
