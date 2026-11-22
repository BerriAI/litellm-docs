---
title: "LiteLLM v1.108.12 (LTS) fixes GPT-6.2 caching and Foundry model routers"
description: "GPT-6.2 caches system prompts again for requests that set store to false, and Foundry model routers work on /v1/responses and /v1/responses/compact."
slug: "v1-108-12"
date: 2026-11-19T06:46:46
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

:::tip

`v1.108.12` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

:::

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.108.12
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.12
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.12`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.12) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.12` is a patch release on top of [`v1.108.11`](/release_notes/v1.108.11/v1-108-11). There are no new database migrations. The `v1.108.12` tag points at [`5f1b6e4`](https://github.com/BerriAI/litellm/commit/5f1b6e4cca27c46f55dc33282447772891ef2f6f).

### What's Changed

- **OpenAI:** Fixed GPT-6.2 prompt caching for system prompts sent to `/v1/chat/completions` or `/v1/messages` with `store: false` - [PR #52599](https://github.com/BerriAI/litellm/pull/52599) and [PR #52694](https://github.com/BerriAI/litellm/pull/52694)
- **Azure:** Fixed `azure_ai/model_router` on a Foundry `/openai/v1` base failing on `/v1/responses` and `/v1/responses/compact` - [PR #52474](https://github.com/BerriAI/litellm/pull/52474)
- **Vertex AI and Gemini:** Fixed one `json_schema` row failing every other row in a Vertex batch file - [PR #51790](https://github.com/BerriAI/litellm/pull/51790)
- **Messages API:** Fixed 400 `Tool reference '<name>' not found` on `/v1/messages` when a guardrail sees a tool name over 64 characters - [PR #47434](https://github.com/BerriAI/litellm/pull/47434)
- **Messages API:** Fixed OpenAI models on `/v1/messages` that keep streaming upstream after the caller closes the stream - [PR #52144](https://github.com/BerriAI/litellm/pull/52144)
- **Guardrails:** Fixed `tool_policy` letting `/v1/messages` requests through when a blocked tool name is over 64 characters - [PR #52717](https://github.com/BerriAI/litellm/pull/52717)

The changes are backported in [PR #52476](https://github.com/BerriAI/litellm/pull/52476), [PR #52621](https://github.com/BerriAI/litellm/pull/52621), [PR #52666](https://github.com/BerriAI/litellm/pull/52666), [PR #52725](https://github.com/BerriAI/litellm/pull/52725) and [PR #52739](https://github.com/BerriAI/litellm/pull/52739).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.11...v1.108.12
