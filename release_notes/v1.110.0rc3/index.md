---
title: "LiteLLM v1.110.0rc3 fixes fallback overrides and WebSocket model aliases"
description: "String fallback overrides no longer return 500, Responses WebSockets keep team model aliases, and Hugging Face, Fireworks AI and OpenCode Go fixes land."
slug: "v1-110-0-rc-3"
date: 2026-11-15T01:10:14
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
docker.litellm.ai/berriai/litellm:1.110.0-rc.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.0rc3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.0-rc.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.0-rc.3) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.110.0rc3` is the current release candidate for 1.110.0. The published GitHub tag is `v1.110.0-rc.3`. These notes compare it with `v1.110.0-rc.2`, the previous release candidate on `rc/1.110.0`. It is a small rc patch with fixes backported onto the rc branch, and everything else is unchanged from `v1.110.0-rc.2`, whose [release notes](/release_notes/v1.110.0rc2/v1-110-0-rc-2) cover the previous patch. The [`v1.110.0rc1` release notes](/release_notes/v1.110.0rc1/v1-110-0-rc-1) cover the full 1.110 line. There are no new database migrations. The `v1.110.0-rc.3` tag points at [`3510cb6`](https://github.com/BerriAI/litellm/commit/3510cb6a60ddae1b75a012d249f15578a58ba82c).

### What's Changed

- **Other providers:** Fixed Hugging Face chat sending requests to `None` or crashing when the endpoint comes from `HUGGINGFACE_API_BASE` - [PR #51449](https://github.com/BerriAI/litellm/pull/51449)
- **Other providers:** Fixed unmapped Fireworks AI models sized like `1p5b` or `0p6b` billing at double the up-to-4B rate - [PR #51451](https://github.com/BerriAI/litellm/pull/51451)
- **Other providers:** Fixed 500 when streaming OpenCode Go Messages-protocol models through chat completions - [PR #51715](https://github.com/BerriAI/litellm/pull/51715)
- **Responses API:** Fixed Responses WebSocket requests dropping the team's model alias and landing on another deployment - [PR #51380](https://github.com/BerriAI/litellm/pull/51380)
- **Token counting:** Fixed follow-up requests with Anthropic server tool history, such as web search, skipping the context-window check - [PR #51334](https://github.com/BerriAI/litellm/pull/51334)
- **Routing and fallbacks:** Fixed 500 when a request sends a string fallback override such as `"fallbacks": "default"`, broken since v1.110.0-dev.1 - [PR #51502](https://github.com/BerriAI/litellm/pull/51502)
- **Deployment:** Changed opentelemetry, dnspython, tornado and soupsieve to the newer versions that main already ships - [PR #51854](https://github.com/BerriAI/litellm/pull/51854)

The changes are backported in [PR #51514](https://github.com/BerriAI/litellm/pull/51514), [PR #51854](https://github.com/BerriAI/litellm/pull/51854) and [PR #51858](https://github.com/BerriAI/litellm/pull/51858).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.0-rc.2...v1.110.0-rc.3
