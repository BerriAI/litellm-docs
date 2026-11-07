---
title: "LiteLLM v1.108.1 (LTS) fixes Bedrock guardrail billing and router cooldowns"
description: "Bills native Bedrock guardrail traces and Gemini audio tiers, and keeps a lone deployment warm under allowed_fails. String fallback targets stop startup."
slug: "v1-108-1"
date: 2026-11-05T23:42:04
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

`v1.108.1` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**String fallback targets now stop the proxy from starting.** A target written as a string, such as `fallbacks: [{"gpt-4": "gpt-3.5"}]` or `default_fallbacks: gpt-3.5`, never routed to that fallback. The proxy now exits at startup with a message naming the fix. Write the target as a list, such as `fallbacks: [{"gpt-4": ["gpt-3.5"]}]` or `default_fallbacks: ["gpt-3.5"]`, before you upgrade. See [PR #48943](https://github.com/BerriAI/litellm/pull/48943).

:::

`v1.108.1` is a patch release on top of [`v1.108.0`](/release_notes/v1.108.0/v1-108-0). There are no new database migrations. The `v1.108.1` tag points at [`93f52b5`](https://github.com/BerriAI/litellm/commit/93f52b591ee2c91617a8c6975f047f4ad722d7e3).

### What's Changed

- **OpenAI:** Improved chat completions so long prompts no longer hold the event loop before the request is sent - [PR #46967](https://github.com/BerriAI/litellm/pull/46967)
- **AWS Bedrock:** Fixed `bedrock/claude_platform/*` calls recording $0 spend, they now price from their own cost map rows - [PR #48150](https://github.com/BerriAI/litellm/pull/48150)
- **AWS Bedrock:** Added native `guardrailConfig` trace usage to spend, budgets and `x-litellm-response-cost` - [PR #48278](https://github.com/BerriAI/litellm/pull/48278), [PR #48923](https://github.com/BerriAI/litellm/pull/48923)
- **Vertex AI and Gemini:** Fixed Gemini audio input and cached audio being billed at the standard rate on flex, priority and batch - [PR #48086](https://github.com/BerriAI/litellm/pull/48086)
- **Vertex AI and Gemini:** Fixed missing Vertex AI audio, long-context flex and priority image prices, and dropped retirement dates Google only gives as earliest dates - [PR #49964](https://github.com/BerriAI/litellm/pull/49964)
- **Other providers:** Fixed `/watsonx/*` pass-through ignoring `use_in_pass_through` deployments. Only deployments that are not team-scoped supply its credentials - [PR #49462](https://github.com/BerriAI/litellm/pull/49462), [PR #50217](https://github.com/BerriAI/litellm/pull/50217)
- **Chat completions:** Fixed streamed usage dropping cached and reasoning token details, which billed cached tokens at the full input rate - [PR #36678](https://github.com/BerriAI/litellm/pull/36678)
- **Embeddings, images and audio:** Added `/v1/videos` support for custom providers registered in `custom_provider_map` - [PR #49785](https://github.com/BerriAI/litellm/pull/49785)
- **Batches and files:** Fixed unmanaged `gs://` batches being read and costed through the first deployment with the same base model instead of the one that created them - [PR #49301](https://github.com/BerriAI/litellm/pull/49301)
- **Token counting:** Fixed Anthropic token counting returning 500 on `search_result` blocks. Unsupported blocks now return 400 - [PR #48699](https://github.com/BerriAI/litellm/pull/48699)
- **Routing and fallbacks:** Fixed the router benching the only deployment of a group under `allowed_fails` when there is no fallback - [PR #48644](https://github.com/BerriAI/litellm/pull/48644), [PR #48913](https://github.com/BerriAI/litellm/pull/48913)
- **Routing and fallbacks:** Changed string fallback targets to be rejected when the router starts, with a message naming the list form - [PR #48943](https://github.com/BerriAI/litellm/pull/48943)
- **Logging and observability:** Fixed a fallback retry keeping the failed attempt's first-token time, which logged negative completion times and stalled latency-based routing - [PR #47541](https://github.com/BerriAI/litellm/pull/47541)
- **Admin UI:** Fixed `/team/spend/by_user` and the Admin UI spend-log reads running on in Postgres after the UI gave up. They are now cancelled after 30 seconds - [PR #49922](https://github.com/BerriAI/litellm/pull/49922), [PR #49965](https://github.com/BerriAI/litellm/pull/49965)
- **Performance:** Fixed evicted SDK clients leaving aiohttp sessions open, and streams failing with `Connection closed` after an eviction - [PR #48650](https://github.com/BerriAI/litellm/pull/48650), [PR #48920](https://github.com/BerriAI/litellm/pull/48920), [PR #48877](https://github.com/BerriAI/litellm/pull/48877)
- **Performance:** Changed tool discovery to buffer in Redis and write `LiteLLM_ToolTable` once per drain, so `call_count` on the Tools page now counts tool calls - [PR #48089](https://github.com/BerriAI/litellm/pull/48089)
- **Other:** Fixed a client disconnecting during the body upload being logged as a failed or successful call. The proxy now ends the request with a 499 - [PR #48640](https://github.com/BerriAI/litellm/pull/48640)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.0...v1.108.1
