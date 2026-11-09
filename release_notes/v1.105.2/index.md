---
title: "LiteLLM v1.105.2 fixes count_tokens, bridged tool calls and thinking blocks"
description: "Brings the v1.104.4 token count fixes, keeps bridged tool calls on choices[0] and keeps signed empty thinking blocks on Anthropic requests."
slug: "v1-105-2"
date: 2026-10-20T18:14:48
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
docker.litellm.ai/berriai/litellm:1.105.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.105.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.105.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.105.2` is a patch release on top of [`v1.105.1`](/release_notes/v1.105.1/v1-105-1). It backports seven fixes from `main` and the token counting fixes that shipped in `v1.104.4` onto `stable/1.105.x`, so upgrading from `v1.104.4` keeps them. There are no new database migrations. The `v1.105.2` tag points at [`fc43640`](https://github.com/BerriAI/litellm/commit/fc436409e8c7ac2d59495424bf76080794e7842c)

## Key Highlights

- **Token counting from `v1.104.4`**: Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them, and count responses say where the number came from
- **Tool calls on `choices[0]`**: a chat completion bridged to `/responses` returns its text, reasoning and tool calls in one choice, so agents that read only `choices[0]` run the tool
- **Signed empty thinking blocks**: `/v1/messages` and chat completions keep a thinking block that has a signature but no text, so replayed turns keep their reasoning

## New Models / Updated Models

### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - `/v1/messages` requests no longer drop a thinking block whose text is empty but whose `signature` is set. Only an empty, unsigned block is removed - [PR #41362](https://github.com/BerriAI/litellm/pull/41362)
    - Chat completions keep signed thinking blocks with empty text, and drop a thinking block only when its signature is missing. A `/v1/messages` request that sets `prefix_mismatch_behavior: error` now gets the binding mismatch 400 back instead of a retry with thinking stripped. The Anthropic, Azure AI and Bedrock Invoke configs keep `thinking.block_binding` when they rebuild `thinking` - [PR #46342](https://github.com/BerriAI/litellm/pull/46342)

## LLM API Endpoints

#### Bugs

- **Token counting**
    - Vertex AI partner models, such as Claude on Vertex AI, count the system prompt and tools
    - Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them
    - Count responses carry `litellm_count_source`, which is `provider`, `token_count_model` or `local_estimate`. When a provider count fails and local counting is on, the response is a local estimate labelled `local_estimate`
    - New `model_info` settings `token_count_framing` and `token_count_model` tune the count for one deployment. When a count model answers, the response also carries `litellm_count_model`
    - The bundled cost map adds `token_count_framing` and `token_count_tokenizer` values for some models
    - These fixes come from [PR #47389](https://github.com/BerriAI/litellm/pull/47389), with [PR #47446](https://github.com/BerriAI/litellm/pull/47446) and [PR #47454](https://github.com/BerriAI/litellm/pull/47454) keeping earlier Google `countTokens` request shapes and prompt plus messages inputs working as before
- **[Responses API](../../docs/response_api) bridge**
    - A chat completion bridged to `/responses` put each Responses message item in its own choice, so a `[message, message, function_call]` reply put the tool call on `choices[1]`. Message text, annotations, reasoning and tool calls now fold into one `choices[0]`, and `finish_reason` is `tool_calls` when any tool call is present - [PR #44346](https://github.com/BerriAI/litellm/pull/44346), [PR #46099](https://github.com/BerriAI/litellm/pull/46099)

## Management Endpoints / UI

#### Bugs

- Team keys can read and cancel their own team's batches and download the finished results. The same model check applies to file, fine-tuning, vector store, character and video ids - [PR #47067](https://github.com/BerriAI/litellm/pull/47067)

## Spend Tracking, Budgets and Rate Limiting

- Streamed chat completions sent through a model alias are now priced with the deployment's model instead of the alias, the same way non-streamed requests are. An alias that points at a deployment with no pricing now bills $0 on streamed requests, which matches what the same request billed without streaming - [PR #44341](https://github.com/BerriAI/litellm/pull/44341)

## Performance / Loadbalancing / Reliability improvements

- Bursts of requests right after a model is added no longer get 400 `Invalid model name`. A request that waited on the registry lock now uses the model when another worker already loaded it, instead of spending the shared resync budget - [PR #44277](https://github.com/BerriAI/litellm/pull/44277)

All of these fixes and the version bump are backported in [PR #47519](https://github.com/BerriAI/litellm/pull/47519)

### PR roll-up by ownership area

- LLM API Endpoints: 5
- Models & Providers: 2
- Auth & Management: 1
- Spend / Budgets / Rate Limits: 1
- Performance: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.1...v1.105.2
