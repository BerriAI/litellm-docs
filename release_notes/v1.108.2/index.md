---
title: "LiteLLM v1.108.2 (LTS) fixes Bedrock service tiers and Claude PDF input"
description: "Honors Bedrock Converse service tiers, fixes base64 PDFs that Claude rejects as image_url, and keeps tag routing after affinity and cooldown filters."
slug: "v1-108-2"
date: 2026-11-06T22:07:43
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

`v1.108.2` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.2) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.2` is a patch release on top of [`v1.108.1`](/release_notes/v1.108.1/v1-108-1). There are no new database migrations. The `v1.108.2` tag points at [`831a14c`](https://github.com/BerriAI/litellm/commit/831a14c8f48e189e24a85b47da1b31b44e0718b6).

### What's Changed

- **OpenAI:** Fixed `openai/` deployments with an empty `api_key` sending `OPENAI_ADMIN_KEY` as the bearer token - [PR #50218](https://github.com/BerriAI/litellm/pull/50218)
- **AWS Bedrock:** Fixed Converse `service_tier` so unsupported tiers answer 400 and `reserved`, `auto` and `standard_only` are honored - [PR #50360](https://github.com/BerriAI/litellm/pull/50360)
- **AWS Bedrock:** Fixed Invoke dropping the `per-turn-control-2026-07-01` beta on Claude 4.5 and newer - [PR #50362](https://github.com/BerriAI/litellm/pull/50362)
- **Vertex AI and Gemini:** Fixed chirp text-to-speech ignoring `vertex_location`, so US and EU deployments call their multi-region host - [PR #50392](https://github.com/BerriAI/litellm/pull/50392)
- **Chat completions:** Fixed `response_format: json_object` on `openai/responses/*` and `azure/responses/*` answering 400 about the word json - [PR #50267](https://github.com/BerriAI/litellm/pull/50267)
- **Chat completions:** Fixed base64 PDFs sent to Claude as `image_url` answering 400, and Bedrock JSON schema calls dropping thinking - [PR #50280](https://github.com/BerriAI/litellm/pull/50280)
- **Responses API:** Fixed `/v1/responses/compact` returning 500 when a `during_call` guardrail is on by default - [PR #50274](https://github.com/BerriAI/litellm/pull/50274)
- **Embeddings, images and audio:** Fixed audio transcription errors echoing the full provider reply, transcript included, to clients and logs - [PR #50325](https://github.com/BerriAI/litellm/pull/50325)
- **MCP:** Changed hosted MCP tools that a translated route cannot run to return a clear 400, or be dropped with `drop_params` - [PR #50348](https://github.com/BerriAI/litellm/pull/50348)
- **Routing and fallbacks:** Fixed groups that accept unmatched tags rejecting requests after affinity or cooldown filtering - [PR #48470](https://github.com/BerriAI/litellm/pull/48470)
- **Routing and fallbacks:** Fixed prompt caching routing not pinning follow-ups to one deployment when `turn_off_message_logging` is on - [PR #50276](https://github.com/BerriAI/litellm/pull/50276)
- **Cost tracking and pricing:** Fixed spend rows being dropped and valid keys getting 401 while Postgres restarts or shuts down - [PR #50132](https://github.com/BerriAI/litellm/pull/50132)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.1...v1.108.2
