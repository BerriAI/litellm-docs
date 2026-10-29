---
title: "LiteLLM v1.106.1 fixes count_tokens, MCP tool calls and thinking blocks"
description: "Brings the v1.104.4 token count fixes, routes bare MCP tool names on a single-server scope and keeps proxy context out of vector store metadata."
slug: "v1-106-1"
date: 2026-10-20T18:58:28
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
docker.litellm.ai/berriai/litellm:1.106.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.106.1` is a patch release on top of [`v1.106.0`](/release_notes/v1.106.0/v1-106-0). It backports six fixes from `main` and the token counting fixes that shipped in `v1.104.4` onto `stable/1.106.x`, so upgrading from `v1.104.4` keeps them. There are no new database migrations. The `v1.106.1` tag points at [`978b4d1`](https://github.com/BerriAI/litellm/commit/978b4d1e4e91cdaaab2e16fbd02d855439e143c1)

## Key Highlights

- **Token counting from `v1.104.4`**: Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them, and count responses say where the number came from
- **Bare MCP tool names**: a `tools/call` with a bare tool name on a single-server scope goes to that server, so a cold replica no longer answers `Tool not found`
- **Clean vector store metadata**: vector stores created through the proxy send the provider only the caller's `metadata`, so later metadata updates no longer fail with 400

## New Models / Updated Models

### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - `/v1/messages` requests no longer drop a thinking block whose text is empty but whose `signature` is set. Only an empty, unsigned block is removed - [PR #41362](https://github.com/BerriAI/litellm/pull/41362)
    - Chat completions keep signed thinking blocks with empty text, and drop a thinking block only when its signature is missing. A `/v1/messages` request that sets `prefix_mismatch_behavior: error` now gets the binding mismatch 400 back instead of a retry with thinking stripped. The Anthropic, Azure AI and Bedrock Invoke configs keep `thinking.block_binding` when they rebuild `thinking` - [PR #46342](https://github.com/BerriAI/litellm/pull/46342)

## LLM API Endpoints

#### Bugs

- **Token counting**
    - Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them
    - Count responses carry `litellm_count_source`, which is `provider`, `token_count_model` or `local_estimate`. When a provider count fails and local counting is on, the response is a local estimate labelled `local_estimate`
    - New `model_info` settings `token_count_framing` and `token_count_model` tune the count for one deployment. When a count model answers, the response also carries `litellm_count_model`
    - The bundled cost map adds `token_count_framing` and `token_count_tokenizer` values for some models
    - These fixes come from [PR #47389](https://github.com/BerriAI/litellm/pull/47389), with [PR #47446](https://github.com/BerriAI/litellm/pull/47446) and [PR #47454](https://github.com/BerriAI/litellm/pull/47454) keeping earlier Google `countTokens` request shapes and prompt plus messages inputs working as before
- **[Responses API](../../docs/response_api) bridge**
    - A chat completion bridged to `/responses` put each Responses message item in its own choice, so a `[message, message, function_call]` reply put the tool call on `choices[1]`. Message text, annotations, reasoning and tool calls now fold into one `choices[0]`, and `finish_reason` is `tool_calls` when any tool call is present - [PR #46099](https://github.com/BerriAI/litellm/pull/46099)
- **Vector Stores**
    - Vector stores created through the proxy filled all 16 OpenAI metadata slots with proxy context, so every later metadata update failed with HTTP 400, and caller keys such as `endpoint` were overwritten. Create and update now send the provider exactly the caller's `metadata`, while logs, tags and limits still see the proxy context. The opt-in `db_scripts/strip_vector_store_internal_metadata.py` script removes LiteLLM's keys from stores created before this release - [PR #47021](https://github.com/BerriAI/litellm/pull/47021)

## Management Endpoints / UI

#### Bugs

- Team keys can read and cancel their own team's batches and download the finished results. The same model check applies to file, fine-tuning, vector store, character and video ids - [PR #47067](https://github.com/BerriAI/litellm/pull/47067)

## MCP Gateway

- A `tools/call` with a bare tool name on `/{server_name}/mcp`, or with one server in `x-mcp-servers`, returned `Tool not found` on a cold replica since `v1.103.0`. A request scoped to exactly one server now routes a bare name to that server, and a bare name that two servers share goes to the server the path names - [PR #46225](https://github.com/BerriAI/litellm/pull/46225)

All of these fixes and the version bump are backported in [PR #47517](https://github.com/BerriAI/litellm/pull/47517)

### PR roll-up by ownership area

- LLM API Endpoints: 5
- Models & Providers: 2
- Auth & Management: 1
- MCP: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.0...v1.106.1
