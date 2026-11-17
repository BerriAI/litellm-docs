---
title: "LiteLLM v1.104.6 changes the image-signing key and fixes cost tracking"
description: "A new cosign key, the eMudhra root CA removed, and fixes for spend on failed and batch requests, token counts and tool calls on gpt-5.4+ models."
slug: "v1-104-6"
date: 2026-10-24T08:40:34
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
docker.litellm.ai/berriai/litellm:1.104.6
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.6
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.104.6`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.104.6) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.104.6` is a patch release on top of [`v1.104.5`](/release_notes/v1.104.5/v1-104-5). It moves image signing to a new cosign key, removes the eMudhra root CA from every certificate bundle, and backports cost tracking, token counting and tool call fixes from `main` onto `stable/1.104.x`. There are no new database migrations. The `v1.104.6` tag points at [`4a8940a`](https://github.com/BerriAI/litellm/commit/4a8940a9fb2696122d683976c389179c92f1a6d2)

:::warning The image-signing key has changed

Starting with this release, every Docker image and Helm chart is signed with the cosign key from commit [`e82a3c6`](https://github.com/BerriAI/litellm/commit/e82a3c646908ba0a6ee0beddc4310d7a6cac4065). Verifying with the previous key from commit `0112e53` fails. Update anything that pins the old `cosign.pub`, such as `cosign verify` scripts, CI checks and admission policies.

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
  ghcr.io/berriai/litellm:v1.104.6
```

:::

## Key Highlights

- **New image-signing key**: Docker images and Helm charts are signed with the cosign key from commit `e82a3c6`, and every certificate bundle drops the eMudhra root CA
- **Cost tracking**: failed, timed-out, cancelled and spilled-over requests are priced correctly, and batch cost tracking is fixed
- **Tool calls**: gpt-5.4+ models bridged to `/responses` return tool calls on `choices[0]` again

## Image signing and certificates

- Every certificate bundle the SDK, proxy and Docker images trust no longer includes the eMudhra root CA - [PR #47670](https://github.com/BerriAI/litellm/pull/47670), [PR #47969](https://github.com/BerriAI/litellm/pull/47969)
- Docker images and Helm charts are signed with the cosign key from commit `e82a3c6`. The previous key from commit `0112e53` no longer verifies them - [PR #48103](https://github.com/BerriAI/litellm/pull/48103)

## New Models / Updated Models

### Bug Fixes

- **[Azure](../../docs/providers/azure)**
    - Azure AI Foundry no longer returns 400 when the client sends the `dangerous-tool-use-2026-09-03` beta - [PR #43934](https://github.com/BerriAI/litellm/pull/43934)

## LLM API Endpoints

#### Bugs

- **Chat completions**
    - Tool calls from gpt-5.4+ models land on `choices[0]` again instead of `choices[1]`. This started in `v1.97.0` - [PR #46099](https://github.com/BerriAI/litellm/pull/46099)
- **Messages API**
    - `/v1/messages` streams no longer hold `message_start` for minutes during adaptive thinking on Bedrock and Vertex. This started in `v1.100.0` - [PR #43600](https://github.com/BerriAI/litellm/pull/43600)
- **Token counting**
    - DeepSeek and Qwen3.5 token counts on the count endpoints no longer run up to 30% low or twice too high - [PR #47685](https://github.com/BerriAI/litellm/pull/47685)
    - `/v1/messages/count_tokens` returns HTTP 400 instead of a known-wrong local estimate - [PR #47705](https://github.com/BerriAI/litellm/pull/47705)
- **Caching**
    - Automatic prompt caching no longer adds extra cache marks on `/v1/messages` when `extra_body` overrides a client mark - [PR #43341](https://github.com/BerriAI/litellm/pull/43341)

## Spend Tracking, Budgets and Rate Limiting

- The Usage API no longer times out while looking up names for busy hashed keys - [PR #43656](https://github.com/BerriAI/litellm/pull/43656)
- Streamed requests through a model alias bill the deployment's price instead of $0. This started in `v1.92.0` - [PR #44341](https://github.com/BerriAI/litellm/pull/44341)
- Large non-streaming chat requests to `openai/responses/*` models log and charge spend once instead of twice. This started in `v1.102.0` - [PR #44508](https://github.com/BerriAI/litellm/pull/44508)
- Failed, timed-out, cancelled and spilled-over requests are priced correctly instead of wrong or not at all - [PR #47718](https://github.com/BerriAI/litellm/pull/47718)
- Batch cost tracking, claude-haiku-5-5 and Bedrock profile pricing, and `safeguards` requests on `/v1/messages` are fixed - [PR #47726](https://github.com/BerriAI/litellm/pull/47726)

## Management Endpoints / UI

#### Bugs

- Usage reports show the owner of CLI session keys even when spend logs are off or purged - [PR #43642](https://github.com/BerriAI/litellm/pull/43642), [PR #47805](https://github.com/BerriAI/litellm/pull/47805)

These fixes and the version bump are backported in [PR #47802](https://github.com/BerriAI/litellm/pull/47802) and [PR #48076](https://github.com/BerriAI/litellm/pull/48076)

### PR roll-up by ownership area

- Spend / Budgets / Rate Limits: 5
- LLM API Endpoints: 5
- Other: 3
- UI: 2
- Models & Providers: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.5...v1.104.6
