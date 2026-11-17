---
slug: litellm-gateway-course
title: "Learn the LiteLLM gateway with a guided course"
date: 2026-09-28T10:00:00-07:00
authors: [moe]
description: "Follow a request through the LiteLLM gateway, Router, and SDK. A guided course for teams deploying the gateway and contributors making code changes."
tags: [proxy, product]
hide_table_of_contents: true
image: ./hero.png
---

import ThemedImage from '@theme/ThemedImage';
import HeroLight from './hero.png';
import HeroDark from './hero-dark.png';

<ThemedImage
  alt="Learn the LiteLLM gateway at litellm.ai/course. Follow a request through gateway access checks, Router deployment selection, and SDK provider translation."
  sources={{
    light: typeof HeroLight === 'string' ? HeroLight : HeroLight.src.images.at(-1).path,
    dark: typeof HeroDark === 'string' ? HeroDark : HeroDark.src.images.at(-1).path,
  }}
  style={{width: '100%'}}
/>

The [LiteLLM gateway course](https://litellm.ai/course) walks you through how the gateway, Router, and SDK work together. We built it for developers and platform teams deploying LiteLLM, and contributors who want to understand the code before opening a pull request.

{/* truncate */}

## Start with one request

The first lessons follow a support app that sends a question to a model called `support-chat`. The gateway checks the caller's access. The Router chooses a deployment. The SDK translates the call into the provider's format.

Later lessons build on that same app. You add access rules, compare routing choices, follow retries and fallbacks, and see how costs and logs are recorded.

In [Follow one request](https://litellm.ai/course#/lesson/request-lifetime), you can switch between an allowed request, a denied model, and a blocked answer. Select a scenario to see which steps run and where the request stops.

![Request flow with Answer blocked selected. The provider generates an answer before a response check blocks delivery.](./request-stops.png)

## Understand the deployment you run

For platform teams, the lessons cover everyday decisions: how to give a team access to models, set a budget, choose fallbacks, and investigate a failed request.

The operations chapters explain how gateway workers, Redis, and PostgreSQL fit together. Other chapters cover streaming, caching, tools, and agents.

Use the [production guide](https://docs.litellm.ai/docs/proxy/prod) alongside the course when you configure your deployment.

## Find where a code change belongs

For contributors, the course helps you find where a change belongs. A provider request in the wrong format points toward an SDK adapter. An unexpected deployment choice points toward the Router. A permission error starts with the gateway's access checks.

The lessons include **Why this exists** and **Where the code lives** sections. Open them to read the reason for a behavior and follow links to the relevant implementation, documentation, or tests.

The final chapter follows a change across the system, from a dashboard field to permissions, stored data, and the settings loaded by gateway workers. It shows you how to trace the behavior and choose what to test. The [contribution guide](https://docs.litellm.ai/docs/extras/contributing_code) covers repository setup and the pull request process.

## Take the course

The course has 83 lessons in 15 chapters. Follow the lessons in order, or use the sidebar to return to a topic. Your progress is saved in your browser. No login is required.

**[Start the LiteLLM gateway course →](https://litellm.ai/course)**
