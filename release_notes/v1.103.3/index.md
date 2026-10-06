---
title: "v1.103.3 - Safer Database Migrations, Streamed Alias Spend and Dependency Updates"
slug: "v1-103-3"
date: 2026-10-03T23:33:00
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
docker.litellm.ai/berriai/litellm:1.103.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::danger Breaking Changes

**The proxy exits when database setup fails at startup** instead of serving against an outdated schema. Set `ENFORCE_PRISMA_MIGRATION_CHECK=false` to keep the old behavior. See [PR #44205](https://github.com/BerriAI/litellm/pull/44205)

**Streamed requests through an alias are priced from the deployment's model, not the alias.** This fixes streamed spend recorded as $0 for aliases like `claude-opus-4.6`. An alias that points at a deployment with no pricing, such as `gpt-4o` mapped to `openai/my-finetune`, now records $0 on streamed requests, matching what the same request already recorded without streaming. Add pricing to the deployment to keep billing it. See [PR #44341](https://github.com/BerriAI/litellm/pull/44341)

**Chat replies bridged from the Responses API return text and tool calls in one choice.** `choices[0]` now carries both the text and the tool calls with `finish_reason: "tool_calls"`, where earlier releases put the tool calls in a separate `choices[1]`. Clients that read the tool calls from `choices[1]` need to read `choices[0]` instead. See [PR #44346](https://github.com/BerriAI/litellm/pull/44346)

:::

:::warning Upgrading from `v1.102.x` or earlier

The two `LiteLLM_SpendLogs` index migrations from `v1.103.0` are now no-ops. Build the indexes online yourself, outside a transaction:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiteLLM_SpendLogs_api_key_startTime_idx" ON "LiteLLM_SpendLogs"("api_key", "startTime");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiteLLM_SpendLogs_litellm_call_id_idx" ON "LiteLLM_SpendLogs"("litellm_call_id");
```

:::

`v1.103.3` is a patch release on top of [`v1.103.2`](https://github.com/BerriAI/litellm/releases/tag/v1.103.2). Startup exits on database setup failure, the `LiteLLM_SpendLogs` index migrations no longer build anything, streamed requests through an alias are billed correctly, and the base image and several dependencies are bumped. The `v1.103.3` tag points at [`ecae261`](https://github.com/BerriAI/litellm/commit/ecae261b100cdf6bcb1d024ae69e4efa4a891be0)

## Streamed spend through an alias

Streamed chat completions through a dotted alias like `claude-opus-4.6` recorded $0 spend, because pricing looked up the alias instead of the deployment's model. The proxy now writes the alias only onto the chunks it sends to the client and prices the stream from the provider's model, so streamed and non-streamed requests bill the same way. Logged streamed responses still show the alias

### What's Changed

- Startup exits on database setup failure, and the `LiteLLM_SpendLogs` index migrations no longer build anything - [PR #44205](https://github.com/BerriAI/litellm/pull/44205), [PR #44286](https://github.com/BerriAI/litellm/pull/44286)
- fix(proxy): stamp the client alias on a copy of each streamed chunk so pricing sees the deployment model - [PR #44341](https://github.com/BerriAI/litellm/pull/44341)
- fix(responses): merge bridged tool calls into the same choice as the text - [PR #44346](https://github.com/BerriAI/litellm/pull/44346)
- Bump wolfi-base digest to pick up glibc 2.44-r6 - [PR #42643](https://github.com/BerriAI/litellm/pull/42643)
- Dependency bumps: `pyjwt`, `pypdf`, `tornado`, `urllib3`, `gitpython`, `litellm-proxy-extras` 0.4.100.post1 - [PR #44352](https://github.com/BerriAI/litellm/pull/44352), [PR #44225](https://github.com/BerriAI/litellm/pull/44225)
- test(e2e): move the Together structured-output and text-completion tests to models that still answer - [PR #44437](https://github.com/BerriAI/litellm/pull/44437)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.2...v1.103.3
