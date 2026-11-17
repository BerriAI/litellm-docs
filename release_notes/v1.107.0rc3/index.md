---
title: "LiteLLM v1.107.0rc3 fixes GitHub Copilot per-user connect and adds GHE.com"
description: "GitHub Copilot per-user credentials work on GHE.com tenants, and per-user connect works with a custom GitHub client ID."
slug: "v1-107-0-rc-3"
date: 2026-11-05T02:06:31
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
docker.litellm.ai/berriai/litellm:1.107.0-rc.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.107.0rc3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.107.0-rc.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.107.0-rc.3) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.107.0rc3` is a release candidate on top of [`v1.107.0-rc.2`](https://github.com/BerriAI/litellm/releases/tag/v1.107.0-rc.2). There are no new database migrations. The `v1.107.0-rc.3` tag points at [`f9778e9`](https://github.com/BerriAI/litellm/commit/f9778e945daf481495272d68283d51bd72002f7c).

### Why a new 1.107 release candidate

Some users still run the 1.107 release candidates and need two GitHub Copilot fixes for per-user credentials, so this release brings them to that line. A newer stable release is already out. If you do not run a 1.107 release candidate, use the [latest stable release](https://github.com/BerriAI/litellm/releases/latest) instead.

### What's Changed

- **Other providers:** Added GitHub Copilot per-user credentials on GHE.com tenants with the new optional `github_copilot_host` field - [PR #47610](https://github.com/BerriAI/litellm/pull/47610)
- **Other providers:** Fixed GitHub Copilot per-user connect failing with `no Copilot access found` when `GITHUB_COPILOT_CLIENT_ID` is set - [PR #50116](https://github.com/BerriAI/litellm/pull/50116)

The changes are backported in [PR #50129](https://github.com/BerriAI/litellm/pull/50129).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.107.0-rc.2...v1.107.0-rc.3
