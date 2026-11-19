---
slug: litellm-database-course
title: "Learn the LiteLLM database with a guided course"
date: 2026-11-19T13:00:00-08:00
authors: [moe]
description: "Every table, what it does, and why it was added. Learn how the LiteLLM database works with a guided course based on the code and its change history."
tags: [proxy, database]
hide_table_of_contents: true
image: ./hero.png
---

import ThemedImage from '@theme/ThemedImage';
import HeroLight from './hero.png';
import HeroDark from './hero-dark.png';

export function Hero() {
  return <ThemedImage
    alt="Learn the LiteLLM database. Every table, what it does, and why it was added. 69 lessons across 16 chapters."
    sources={{
      light: typeof HeroLight === 'string' ? HeroLight : HeroLight.src.images.at(-1).path,
      dark: typeof HeroDark === 'string' ? HeroDark : HeroDark.src.images.at(-1).path,
    }}
    style={{width: '100%'}}
  />;
}

The [LiteLLM database course](https://www.litellm.ai/course) goes through every table, what it does, and why it was added. We built it for developers working on LiteLLM and anyone who wants to understand the database behind their deployment.

{/* truncate */}

## Follow the data behind a request

The first lessons start with a team called Search. An admin creates a virtual key for that team, and its app sends a request that costs two cents. Follow the rows that give the key access, apply its budget, record the request, and update spend.

Later chapters cover users, models, MCP servers, guardrails, and agents. You'll see which tables hold their settings and how those tables connect to the rest of the gateway.

## Understand why each table exists

The course goes through every table and column in the reviewed schema, with links to the code and the PRs or commits that added them. Read what a field does, then open the original change to understand the problem it solved.

For example, a key's `spend` resets each budget period. The `total_spend` column preserves its lifetime spend. The course explains both and links to the PR that introduced the separate counter.

You can follow the database's evolution from its first key table through the schema we use today, or jump to a table you've come across in the code.

## Take the course

The course has 69 lessons in 16 chapters, with a quiz after each chapter and a completion certificate. Your progress is saved in your browser. No login is required.

Open [LiteLLM Academy](https://www.litellm.ai/course) and choose **Database course**. The [gateway course](/blog/litellm-gateway-course) is in the same library if you want to follow the request path first.
