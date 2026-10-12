---
title: "v1.104.3 - Decisions Providers, SDK and Guardrail"
slug: "v1-104-3"
date: 2026-10-11T10:37:40
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
docker.litellm.ai/berriai/litellm:1.104.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.104.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.104.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::danger Breaking Changes

**Decisions requests that send `safety_identifier` to a provider other than OpenAI now return 400** instead of 200 with the identifier silently dropped. This covers Perplexity, TypeSafe, OpenRouter, Strands Decider and Cloudflare on `/v1/decisions`, `/v1/systemone` and `litellm.decisions()`. Set `drop_params: true` on the deployment, under `litellm_settings`, in the request body or on `litellm.drop_params` to keep the old behavior. `/v1/systemone` requests are also logged with call type `asystemone` instead of `adecisions`. See [PR #44955](https://github.com/BerriAI/litellm/pull/44955) and [PR #45846](https://github.com/BerriAI/litellm/pull/45846)

:::

`v1.104.3` is a patch release on top of [`v1.104.2`](/release_notes/v1.104.2/v1-104-2). It backports the Decisions follow-ups from `main`: two more providers, Strands Decider on AgentCore, a `litellm.systemone()` SDK entry point, OpenRouter billing from the cost OpenRouter reports, a decision model guardrail and decision-model Auto Router setup. There are no new database migrations. The `v1.104.3` tag points at [`3645fe0`](https://github.com/BerriAI/litellm/commit/3645fe0a1cada9e3b4f0cbd50d5e1d436d5b21cb)

## Decisions API

- **New providers**: `hosted_vllm/` (requires `api_base`, or `HOSTED_VLLM_API_BASE`) and `azure_ai/` for Microsoft-Decision-1, joining OpenAI, Perplexity, TypeSafe, OpenRouter, Cloudflare and Strands Decider. See the [Decisions docs](../../docs/decisions)
- **Strands Decider on AgentCore**: a `strands_decider/` deployment whose `api_base` is an AgentCore runtime ARN calls `InvokeAgentRuntime`, signed with the deployment's `aws_*` credentials
- **SDK**: the new `litellm.systemone()` takes the System One format and `litellm.decisions()` takes the OpenAI format. `litellm.decisions(state=...)` still works and warns that it is deprecated in favor of `litellm.systemone()`
- **`safety_identifier`**: providers that cannot take it return 400 unless `drop_params` drops it. OpenAI keeps passing it through from either route
- **Spend tracking**: OpenRouter Decisions calls and the `/openrouter/alpha/decisions` pass-through bill the cost OpenRouter reports in `usage.cost`
- **Decision model guardrail**: a new `decision_model` guardrail screens messages and tool-call arguments with admin-written yes/no questions, each set to block or log above its threshold, and is configured from the Admin UI and the Guardrail Garden
- **Auto Router**: a new router can use an onboarded decision model deployment as its classifier, and existing router configurations keep working
- **Admin UI and docs**: TypeSafe and Strands Decider are in the Add Model provider list, and Swagger UI describes `/v1/decisions` and `/v1/systemone`

#### New Model Support (1 new model)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) |
| --- | --- | --- | --- | --- |
| Azure AI | `azure_ai/Microsoft-Decision-1` | - | $0.042 | $0.00 |

### What's Changed

- Dispatch Decisions through per-provider configs and the shared HTTP handler - [PR #45129](https://github.com/BerriAI/litellm/pull/45129), [PR #45130](https://github.com/BerriAI/litellm/pull/45130), [PR #45442](https://github.com/BerriAI/litellm/pull/45442)
- Add the hosted vLLM Decisions provider - [PR #45501](https://github.com/BerriAI/litellm/pull/45501)
- Add `azure_ai/Microsoft-Decision-1` and support it on the Decisions API - [PR #45639](https://github.com/BerriAI/litellm/pull/45639), [PR #45673](https://github.com/BerriAI/litellm/pull/45673), [PR #45717](https://github.com/BerriAI/litellm/pull/45717)
- Call a Strands Decider on an AgentCore runtime ARN - [PR #45678](https://github.com/BerriAI/litellm/pull/45678)
- Add `litellm.systemone()` and keep `litellm.decisions()` to the OpenAI format - [PR #45846](https://github.com/BerriAI/litellm/pull/45846)
- Refuse `safety_identifier` on providers that cannot take it unless `drop_params` drops it - [PR #44955](https://github.com/BerriAI/litellm/pull/44955)
- Bill OpenRouter Decisions and the Decisions pass-through from `usage.cost` (the Decisions and pass-through billing parts only) - [PR #45640](https://github.com/BerriAI/litellm/pull/45640)
- Add TypeSafe and Strands Decider to the Add Model provider list, and describe both Decisions routes in Swagger UI - [PR #45335](https://github.com/BerriAI/litellm/pull/45335), [PR #45838](https://github.com/BerriAI/litellm/pull/45838)
- Add the decision model guardrail with an Admin UI flow - [PR #45663](https://github.com/BerriAI/litellm/pull/45663), backported in [PR #45900](https://github.com/BerriAI/litellm/pull/45900), with the Add Guardrail provider list fixed after both backports landed in [PR #45936](https://github.com/BerriAI/litellm/pull/45936)
- Pick an onboarded decision model as the Auto Router classifier - [PR #45913](https://github.com/BerriAI/litellm/pull/45913), backported in [PR #45914](https://github.com/BerriAI/litellm/pull/45914)
- Rebuild the Admin UI bundle - [PR #45924](https://github.com/BerriAI/litellm/pull/45924)

The Decisions follow-ups and the version bump are backported together in [PR #45906](https://github.com/BerriAI/litellm/pull/45906)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.2...v1.104.3
