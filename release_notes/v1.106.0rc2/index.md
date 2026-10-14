---
title: "1.106.0rc2 - Home page launches from the blog, Decisions label fix"
slug: "v1-106-0-rc-2"
date: 2026-10-13T23:59:21
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Kerry Lu
    title: Rust Engineer, LiteLLM
    url: https://github.com/kerrylu-berri
    image_url: https://github.com/kerrylu-berri.png
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.106.0-rc.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.0rc2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.0-rc.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.0-rc.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

The published GitHub tag is `v1.106.0-rc.2`. These notes compare it with `v1.106.0-rc.1`, the previous release candidate on `rc/1.106.0`. It is a small rc patch: two fixes were backported onto the rc branch and everything else is unchanged from `v1.106.0-rc.1`, whose [release notes](/release_notes/v1.106.0rc1/v1-106-0-rc-1) cover the full 1.106 line against `v1.105.0`

## Key Highlights

- **Home page launches come from the blog**: the What's new section on the Admin UI Home page shows the newest launch posts tagged `day 0 support` on the LiteLLM blog, so new model launches appear without a proxy upgrade
- **Decisions answer type label**: the Playground's Decisions tab and the Add Model form label the yes / no answer type as "Yes / No" instead of the internal `noul` name

## Management Endpoints / UI

### Admin UI

#### Home page

- What's new cards are now the three newest blog posts tagged `day 0 support`, with the card title and summary taken from the post's `card_title` and `card_summary` categories and falling back to the post title and description. The cards refresh with the blog feed, which the proxy caches for one hour. The bundled launch list and the `/public/whats_new` endpoint from `v1.106.0-rc.1` are removed, and `/public/litellm_blog_posts` now returns each post's tags and up to 50 posts. See [PR #46309](https://github.com/BerriAI/litellm/pull/46309), backport of [PR #46260](https://github.com/BerriAI/litellm/pull/46260)

#### Playground and Decisions

- The yes / no Decisions answer type is labelled "Yes / No" in the Playground and the Add Model form instead of `noul`. See [PR #45933](https://github.com/BerriAI/litellm/pull/45933), backport of [PR #45931](https://github.com/BerriAI/litellm/pull/45931)

### PR roll-up by ownership area

- Admin UI: 2

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.0-rc.1...v1.106.0-rc.2
