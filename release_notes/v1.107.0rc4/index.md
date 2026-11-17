---
title: "LiteLLM v1.107.0rc4 adds a CLI command to link GitHub Copilot accounts"
description: "Developers link their own GitHub Copilot account from the terminal with lite credentials connect, without access to the Admin UI."
slug: "v1-107-0-rc-4"
date: 2026-11-14T23:46:31
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
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
docker.litellm.ai/berriai/litellm:1.107.0-rc.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.107.0rc4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.107.0-rc.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.107.0-rc.4) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.107.0rc4` is a release candidate on top of [`v1.107.0rc3`](/release_notes/v1.107.0rc3/v1-107-0-rc-3). There are no new database migrations. The `v1.107.0-rc.4` tag points at [`a1a541b`](https://github.com/BerriAI/litellm/commit/a1a541bfb1295d44bcb3b9ab882ba8f8b1c2dfa5).

### Why a new 1.107 release candidate

Some users still run the 1.107 release candidates and need to link their GitHub Copilot per-user credentials without access to the Admin UI, so this release brings the `lite credentials connect` command to that line. A newer stable release is already out. If you do not run a 1.107 release candidate, use the [latest stable release](https://github.com/BerriAI/litellm/releases/latest) instead.

### What's Changed

- **Other providers:** Added `lite credentials connect` to link a per-user GitHub Copilot credential from the terminal without the Admin UI - [PR #50863](https://github.com/BerriAI/litellm/pull/50863)
- **Deployment:** Changed `aiohttp`, `ddtrace`, `pypdf` and other locked dependencies in the Docker images to newer releases - [PR #51771](https://github.com/BerriAI/litellm/pull/51771)

The changes are backported in [PR #51771](https://github.com/BerriAI/litellm/pull/51771).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.107.0-rc.3...v1.107.0-rc.4
