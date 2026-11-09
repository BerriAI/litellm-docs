---
title: "LiteLLM v1.105.3 fixes MCP tool listing, spend on failed requests and batch cost"
description: "Lists per-user auth MCP tools again, prices timed-out and cancelled requests the provider billed, keeps batch spend through failures and counts Bedrock Claude tokens on Mantle."
slug: "v1-105-3"
date: 2026-10-21T10:00:46
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
docker.litellm.ai/berriai/litellm:1.105.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.105.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.105.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.105.3` is a patch release on top of [`v1.105.2`](/release_notes/v1.105.2/v1-105-2). It backports the per-user auth MCP tool listing fix, the spend fixes for timed-out, cancelled and retried requests, the batch cost, pricing and translation fixes, and the Bedrock Mantle token count fallback from `main` onto `stable/1.105.x`, and updates aiohttp to 3.14.5. There are no new database migrations. The `v1.105.3` tag points at [`fc795d5`](https://github.com/BerriAI/litellm/commit/fc795d5bfd3aa634497f12ce5196541230490cf5)

## Upgrade notes

- **Unsupported reasoning efforts return 400**: Azure `gpt-6-astra` with `reasoning_effort: none` and `gpt-5.3-codex` with `minimal` are refused by the proxy with a 400 instead of being sent upstream. Set `drop_params: true` to drop the value, or send a level the model supports - [PR #43935](https://github.com/BerriAI/litellm/pull/43935)
- **OpenRouter rows left the bundled cost map**: with `LITELLM_LOCAL_MODEL_COST_MAP=True`, cost and model info lookups for `openrouter/*` models now raise `ModelNotMappedError`, as they already do with the remote cost map the proxy loads by default. Set `input_cost_per_token`, `output_cost_per_token` and any context window you rely on in those deployments' `model_info` - [PR #45665](https://github.com/BerriAI/litellm/pull/45665)
- **Billed failures count against budgets**: requests that time out after reaching the provider, and client cancellations with `cancel_on_disconnect: true`, now record their estimated input cost and deduct it from key, team and user budgets. A retried request deducts once per billed attempt - [PR #47435](https://github.com/BerriAI/litellm/pull/47435), [PR #47416](https://github.com/BerriAI/litellm/pull/47416)
- **`base_model` in the request body no longer sets the price**: it is dropped like the other client pricing fields unless the key or team has `allow_client_pricing_override` - [PR #47639](https://github.com/BerriAI/litellm/pull/47639)
- **Truncated bridged Responses report `incomplete`**: cut-off `/v1/responses` output on providers without a native Responses API now returns `status: "incomplete"` and streams end with `response.incomplete` instead of `response.completed`, as the native OpenAI Responses API does - [PR #44460](https://github.com/BerriAI/litellm/pull/44460)
- **Decisions log the whole request**: the logged user message for `/v1/systemone` and `/v1/decisions` is now the full request object, such as `{"state": ..., "questions": ...}` or `{"input": ..., "questions": ...}`, instead of the state or input alone. Update anything that parses that `content` - [PR #47183](https://github.com/BerriAI/litellm/pull/47183)
- **Per-user auth MCP tools are listed without a token**: users with access to an `auth_type: authorization` MCP server now see its tools in the catalog without their own upstream token when the upstream allows anonymous listing. Calling a tool still needs their token - [PR #47677](https://github.com/BerriAI/litellm/pull/47677)

## Key Highlights

- **MCP tool catalog**: MCP servers with `auth_type: authorization` and no shared token show their tools in `/mcp-rest/tools/list` and MCP `tools/list` again, and calling a tool still needs the user's own token
- **Spend on failed requests**: requests that time out after reaching the provider, client cancellations and each billed retry attempt are priced on their prompt instead of logging $0, and spilled-over Azure PTU requests log the rates behind their spend
- **Batch cost, pricing and `safeguards`**: completed batches keep their spend through malformed results and temporary accounting failures, `claude-haiku-5-5` and Bedrock inference profiles are priced, and `/v1/messages` requests with `safeguards` return 200

## New Models / Updated Models

#### Features

- **Cost map**
    - The bundled cost map now matches `main`. It removes the `openrouter/*` rows and 11 `github_copilot` rows, reprices the `azure/gpt-4o-mini` family, corrects the Azure EU `gpt-6-astra` price and moves 19 regional Azure codex and pro rows from `chat` to `responses` mode. A proxy that loads the remote cost map, the default, already sees these values - [PR #45665](https://github.com/BerriAI/litellm/pull/45665), [PR #47737](https://github.com/BerriAI/litellm/pull/47737)

#### Bugs

- **[Anthropic](../../docs/providers/anthropic)**
    - `/v1/messages` requests that carry `safeguards` failed with 400 `safeguards: Extra inputs are not permitted` when the client sent no `anthropic-beta` header, and Claude Code auto mode on Azure AI Foundry fell back to its client-side classifier. The proxy now adds the `dangerous-tool-use-2026-09-03` beta itself on Anthropic, Azure AI and Databricks deployments, and a param removed with `additional_drop_params` also drops its beta - [PR #43955](https://github.com/BerriAI/litellm/pull/43955)
    - With `LITELLM_RUST=true`, Anthropic `/v1/messages` requests with `safeguards` get the same beta, and an explicit `"safeguards": null` is dropped - [PR #46102](https://github.com/BerriAI/litellm/pull/46102)
    - A cache control point with `location: tool_config` now puts its breakpoint on the last tool on `/v1/chat/completions` and `/v1/messages` for Claude on Anthropic, Bedrock Invoke, Vertex AI and Azure AI. Chat requests used to fail with a 400 saying the field is not permitted, and `/v1/messages` sent the tools without a breakpoint. OpenAI deployments no longer receive the setting, and `litellm_proxy/` deployments still forward it to the downstream proxy - [PR #47394](https://github.com/BerriAI/litellm/pull/47394), [PR #47570](https://github.com/BerriAI/litellm/pull/47570)
- **Claude Haiku 5.5**
    - `claude-haiku-5-5` is priced, so its calls report a cost instead of $0, with over-100k token rates on Bedrock, Bedrock Mantle, Azure and Vertex AI and over-100k batch rates. Its rows set `supports_forced_tool_use: true` and `thinking_always_on: false` - [PR #45108](https://github.com/BerriAI/litellm/pull/45108), [PR #45151](https://github.com/BerriAI/litellm/pull/45151)
- **Databricks**
    - `json_schema` response formats keep `#/$defs` refs as the client sent them, so nested types no longer fail with a 400 on non-Claude models. SDK callers that pass a Pydantic class send the strict schema with `additionalProperties: false`, like other OpenAI-compatible providers - [PR #45659](https://github.com/BerriAI/litellm/pull/45659)
    - Non-Claude models get a single plain text block as a string, so JSON mode no longer fails with a 400 asking for the word json on `model_info.mode: responses` deployments - [PR #45686](https://github.com/BerriAI/litellm/pull/45686)
- **OpenAI and Azure**
    - Reasoning levels are checked against the model's cost map row on chat completions and the Responses API. `gpt-6.1-sol` with `reasoning_effort: none` is dropped when `drop_params` is on instead of coming back as an OpenAI 400, and otherwise gets a 400 from the proxy that names the level. Azure `gpt-6-astra` refuses `none` and `gpt-5.3-codex` refuses `minimal` the same way - [PR #43935](https://github.com/BerriAI/litellm/pull/43935)

## LLM API Endpoints

#### Bugs

- **Token counting**
    - Bedrock Runtime `CountTokens` rejects newer Claude models, such as Claude Opus 4.8, 5 and 5.5, with a 400 or 404, so `/v1/messages/count_tokens` answered with a local estimate well under the billed input. Bedrock Runtime is still tried first, then Claude models fall back to the Bedrock Mantle Anthropic `count_tokens` endpoint with the same AWS credentials. Non-Claude models never call Mantle - [PR #45317](https://github.com/BerriAI/litellm/pull/45317), [PR #46430](https://github.com/BerriAI/litellm/pull/46430)
- **[Responses API](../../docs/response_api) bridge**
    - `/v1/responses` calls on providers without a native Responses API reported cut-off output as `completed`. A truncated response now has `status: "incomplete"` with `incomplete_details.reason: max_output_tokens` when the cap was hit, its stream ends with `response.incomplete`, and the response echoes the request's `temperature`, `top_p` and `max_output_tokens`. Bedrock JSON mode keeps a `length` finish reason - [PR #44460](https://github.com/BerriAI/litellm/pull/44460)
- **Decisions API**
    - `/v1/systemone` and `/v1/decisions` logged only `state` or `input`, never `questions`, so S3, Langfuse and spend log records held answers with no record of what was asked. They now log the whole request the caller sent, before validation, so a request rejected with 400 is still recorded. Raw non-UTF-8 bytes passed to `litellm.decisions()` still get a 400 and are logged as base64 - [PR #47183](https://github.com/BerriAI/litellm/pull/47183), [PR #47564](https://github.com/BerriAI/litellm/pull/47564)

## Spend Tracking, Budgets and Rate Limiting

#### Features

- **Google Search grounding free tier**
    - New opt-in `litellm_settings.apply_search_free_tier` (default `false`, needs Redis) applies Google's free Google Search grounding allowance, so grounding queries under the allowance are logged at $0. Gemini API and Vertex AI requests each draw on their own allowance, and cache hits are not counted. On this release `spend` is right on every row, while `metadata.cost_breakdown.discount_amount` can read 0.0 on some discounted rows - [PR #47494](https://github.com/BerriAI/litellm/pull/47494), [PR #47646](https://github.com/BerriAI/litellm/pull/47646)

#### Bugs

- **Failed requests the provider billed**
    - A request that timed out after reaching the provider was logged at $0 although the provider billed the prompt. Its spend row now prices the estimated prompt tokens at the input rate and deducts that from key, team and user budgets. A connect timeout that never reached the provider stays at $0 - [PR #47435](https://github.com/BerriAI/litellm/pull/47435)
    - With `general_settings.cancel_on_disconnect: true`, a caller who hangs up mid-request now gets a 499 row with its estimated prompt tokens and their input price. A provider's own HTTP 499, and a hang-up after the call already completed and logged, stay at $0 - [PR #47436](https://github.com/BerriAI/litellm/pull/47436), [PR #47652](https://github.com/BerriAI/litellm/pull/47652)
    - Failures the proxy raises itself, such as a 401 or a hang-up before the provider is called, are no longer marked as having reached a provider, so they stay at $0 and their OpenTelemetry failure spans no longer carry `litellm.preprocessing.duration_ms` - [PR #47456](https://github.com/BerriAI/litellm/pull/47456)
    - A billed failure row is priced the way the success row is: the deployment's own `input_cost_per_token`, its `model_info.base_model` for an Azure deployment whose name is not in the cost map, and its above-200k input tier when it sets one - [PR #47437](https://github.com/BerriAI/litellm/pull/47437), [PR #47647](https://github.com/BerriAI/litellm/pull/47647)
    - With `router_settings.num_retries`, each earlier attempt that also timed out is a separately billed provider call. Each one now gets its own spend row (`<request_id>-attempt-<n>`) priced at the model that served it, including after a fallback to another model group - [PR #47490](https://github.com/BerriAI/litellm/pull/47490), [PR #47416](https://github.com/BerriAI/litellm/pull/47416), [PR #47648](https://github.com/BerriAI/litellm/pull/47648)
    - A streamed `/v1/responses` request, or a streamed `/v1/messages` request served through the Responses API (the default route for OpenAI and Azure models), wrote no spend when the client closed it after output started. It is now billed for the partial output, as `/v1/chat/completions` already was. A disconnect before any output still bills nothing - [PR #47611](https://github.com/BerriAI/litellm/pull/47611)
- **Batches**
    - An all-failed batch with an empty model list no longer repeats `list index out of range` during cost reconciliation. It records one zero-cost event and stops retrying - [PR #47155](https://github.com/BerriAI/litellm/pull/47155)
    - Valid results in a batch whose output also has a malformed response envelope are now billed once instead of not at all, and a failed final metadata write no longer leaves a processed batch in a stale state - [PR #47184](https://github.com/BerriAI/litellm/pull/47184)
    - Newer completed batches are no longer held back by a backlog of older retryable ones, older completed batches stay recoverable instead of being retired with their spend, and a 404 retires a batch only when it names that batch's own resource - [PR #47190](https://github.com/BerriAI/litellm/pull/47190)
    - A completed batch whose accounting failed before any spend changed is retried on a later pass and billed once, and provider, deployment and tag budgets count it once across retries. A logging failure that cannot be classified keeps the batch claimed instead of retrying, to avoid a duplicate charge - [PR #47625](https://github.com/BerriAI/litellm/pull/47625)
    - Vertex AI batches on a regional location were priced at global rates, about 10% under what Google bills. They now get the regional endpoint uplift that online requests already had - [PR #47466](https://github.com/BerriAI/litellm/pull/47466)
- **Pricing**
    - A Bedrock inference profile deployment could log $0 or drop charges, for example $0 output spend when only a custom input price was set. Profile deployments now price at the profile's catalog rates, each custom price you set wins for its own field, and `register_model` custom rates also apply to region-prefixed profiles - [PR #47419](https://github.com/BerriAI/litellm/pull/47419)
    - Gemini prompt audio tokens billed $0 when the model had no audio rate, and image and video prompt tokens ignored the above-200k tier. They now bill at the resolved input rate, so an 816k-token video request on `vertex_ai/gemini-3.1-pro-preview` logs about $3.35 instead of $0.118 - [PR #47373](https://github.com/BerriAI/litellm/pull/47373)
    - Vertex AI `text-embedding-005` and `text-multilingual-embedding-002` are billed per character on Google's `billableCharacterCount` instead of per token, and every Vertex text embedding response now carries `usage.prompt_tokens_details.character_count` - [PR #47460](https://github.com/BerriAI/litellm/pull/47460)
    - `base_model` in a request body is now dropped like the other client pricing fields unless the key or team has `allow_client_pricing_override`, so it no longer changes the price of the caller's spend rows. A multipart request, such as an audio transcription, whose `metadata` form field has a lone surrogate such as `"\ud800"` now gets the same 400 a JSON body gets, instead of losing its spend log row and tag spend - [PR #47639](https://github.com/BerriAI/litellm/pull/47639)
- **Spend log metadata**
    - A deployment with its own `input_cost_per_token` and `output_cost_per_token`, including $0, now shows those rates in `model_map_information` in spend log metadata and callbacks, instead of the catalog rates. `model_map_key` is unchanged - [PR #47182](https://github.com/BerriAI/litellm/pull/47182)
    - Azure PTU requests that spill over to pay-as-you-go, with `LITELLM_ENABLE_PTU_COST_ATTRIBUTION=True`, now log the pay-as-you-go rates in `model_map_information`, with or without `base_model`, so the rates in the row explain its spend. Regular PTU requests keep their flat pricing - [PR #47567](https://github.com/BerriAI/litellm/pull/47567), [PR #47655](https://github.com/BerriAI/litellm/pull/47655)

## MCP Gateway

- MCP servers registered with `auth_type: authorization` and no shared token dropped out of `/mcp-rest/tools/list` and MCP `tools/list` since `v1.104.2`, so users saw an empty catalog with `partial_failure` even though a call with their own token worked. Listing those servers no longer needs a shared token, so their tools show up when the upstream allows anonymous listing. A tool call still needs the user's `x-mcp-{alias}-authorization` header, and a malformed or blank shared token is still refused - [PR #47677](https://github.com/BerriAI/litellm/pull/47677)

## Performance / Loadbalancing / Reliability improvements

#### Features

- New `timeout_by_service_tier` and `stream_timeout_by_service_tier` deployment settings give requests with a matching `service_tier`, such as `flex`, their own timeout. A timeout the client sends with `timeout` or `x-litellm-timeout` still wins, and other requests keep the deployment's `timeout` - [PR #47406](https://github.com/BerriAI/litellm/pull/47406)

#### Bugs

- `cost-based-routing` priced each deployment by its `litellm_params.model`, so an Azure deployment whose name is not in the cost map was scored at the $10 per token unmapped default and lost every pick. It now prices through `model_info.base_model` first, the same way the spend log does - [PR #47617](https://github.com/BerriAI/litellm/pull/47617)
- A spend log flush that ran while Postgres restarted dropped its whole batch, so those requests never got a `LiteLLM_SpendLogs` row. The batch is now requeued and written on the next attempt - [PR #47571](https://github.com/BerriAI/litellm/pull/47571)
- Native OpenAI and Azure `/v1/responses` requests no longer force an immediate spend log flush each, so their rows land with the next batch write. Requests on the chat completions bridge keep the immediate flush, so `previous_response_id` still finds them - [PR #47614](https://github.com/BerriAI/litellm/pull/47614)

All of these fixes, the aiohttp 3.14.5 update and the version bump are backported in [PR #47804](https://github.com/BerriAI/litellm/pull/47804), [PR #47744](https://github.com/BerriAI/litellm/pull/47744), [PR #47714](https://github.com/BerriAI/litellm/pull/47714) and [PR #47737](https://github.com/BerriAI/litellm/pull/47737)

### PR roll-up by ownership area

- Spend / Budgets / Rate Limits: 23
- Models & Providers: 10
- LLM API Endpoints: 5
- Performance: 4
- Logging: 1
- MCP: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.2...v1.105.3
