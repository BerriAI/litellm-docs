---
title: "LiteLLM v1.108.17 (LTS) fixes streamed OpenAI tool calls and adds MiniMax-H3-Image"
description: "Streamed OpenAI tool calls keep their arguments, `chat-latest` models stop failing with 400, and MiniMax-H3-Image and Gemini file page ranges join the LTS line."
slug: "v1-108-17"
date: 2026-11-24T22:55:03
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

`v1.108.17` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.17
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.17
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.17`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.17) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.17` is a patch release on top of [`v1.108.16`](/release_notes/v1.108.16/v1-108-16). There are no new database migrations. A partial `LiteLLM_EndUserTable_restricted_idx` index is built after migrations run, without blocking writes. The migration job builds it, and a proxy that runs its own migrations builds it in the background once it serves. The `v1.108.17` tag points at [`e552bff`](https://github.com/BerriAI/litellm/commit/e552bffcaf7a921f14101ec288c5719580ffe9b5).

### What's Changed

- **OpenAI:** Fixed OpenAI, Azure and vLLM errors losing `param`, `type` and `code` and returning raw JSON in `message` - [PR #51809](https://github.com/BerriAI/litellm/pull/51809) and [PR #53217](https://github.com/BerriAI/litellm/pull/53217)
- **OpenAI:** Fixed chat completions dropping `access_programs` and prompt cache fields when LiteLLM runs on OpenAI SDK 3 - [PR #51814](https://github.com/BerriAI/litellm/pull/51814)
- **OpenAI:** Fixed streamed OpenAI tool calls reaching agents with empty arguments when OpenAI sends them only at the end - [PR #52069](https://github.com/BerriAI/litellm/pull/52069) and [PR #53306](https://github.com/BerriAI/litellm/pull/53306)
- **OpenAI:** Fixed `background_options` on `/v1/responses` being dropped before reaching OpenAI - [PR #53993](https://github.com/BerriAI/litellm/pull/53993)
- **OpenAI:** Fixed o3 `reasoning_effort` `minimal` and `none` returning OpenAI's 400 even with `drop_params` on - [PR #54066](https://github.com/BerriAI/litellm/pull/54066)
- **Anthropic:** Fixed a malformed `thinking_blocks` on Claude requests failing with 500, now a 400 naming the field - [PR #53762](https://github.com/BerriAI/litellm/pull/53762)
- **Anthropic:** Fixed failed `/v1/messages` streams logging placeholder output tokens and cost when Claude sends an error frame - [PR #53920](https://github.com/BerriAI/litellm/pull/53920)
- **AWS Bedrock:** Fixed Bedrock batch retrieve and cancel reporting and saving `/v1/chat/completions` for embeddings batches - [PR #53831](https://github.com/BerriAI/litellm/pull/53831)
- **AWS Bedrock:** Fixed OpenAI SDK embeddings on Bedrock Nova 2 always failing with 400 on `encoding_format` - [PR #53938](https://github.com/BerriAI/litellm/pull/53938)
- **AWS Bedrock:** Fixed Nova Sonic realtime sessions hanging when `api_base` or the runtime endpoint is set to an empty value - [PR #53969](https://github.com/BerriAI/litellm/pull/53969)
- **AWS Bedrock:** Fixed a Bedrock Claude tool with shared `$defs` stalling a worker for about 30 seconds and then failing with 400 - [PR #54118](https://github.com/BerriAI/litellm/pull/54118)
- **AWS Bedrock:** Fixed computer and browser toolsets on Bedrock `/v1/messages` failing with 400 - [PR #54128](https://github.com/BerriAI/litellm/pull/54128)
- **Vertex AI and Gemini:** Added Gemini page and sheet range options for files on chat completions, so only that part is read and billed - [PR #52611](https://github.com/BerriAI/litellm/pull/52611)
- **Vertex AI and Gemini:** Fixed Gemini and Vertex AI answering 400 when the last user message is empty - [PR #53947](https://github.com/BerriAI/litellm/pull/53947)
- **Vertex AI and Gemini:** Fixed Gemini embedding `video_metadata` windows billing the whole video or failing with 500, now a clear 400 - [PR #54090](https://github.com/BerriAI/litellm/pull/54090)
- **Vertex AI and Gemini:** Fixed Gemini TTS returning WAV bytes for `pcm16` and a double WAV header on `/v1/audio/speech` - [PR #54193](https://github.com/BerriAI/litellm/pull/54193)
- **Other providers:** Added MiniMax-H3-Image on `/v1/images/generations` and `/v1/images/edits` with cost tracking - [PR #53986](https://github.com/BerriAI/litellm/pull/53986)
- **Other providers:** Fixed DeepSeek V4 on `/v1/messages` ignoring the caller's effort, so Claude Code's `--effort` now applies - [PR #52196](https://github.com/BerriAI/litellm/pull/52196)
- **Other providers:** Fixed GitHub Copilot rejecting HTML and plain-text documents with 400 on that turn and every later one - [PR #53669](https://github.com/BerriAI/litellm/pull/53669)
- **Other providers:** Fixed Together AI image calls logging $0 and retired Together models missing a deprecation date - [PR #53964](https://github.com/BerriAI/litellm/pull/53964)
- **Other providers:** Fixed `nvidia_nim/` chat calls failing with 400 on `logprobs` and `top_logprobs` - [PR #54043](https://github.com/BerriAI/litellm/pull/54043)
- **Chat completions:** Fixed `chat-latest` and `gpt-chat-latest` on OpenAI, Azure and Azure AI failing with 400 on the first prompt - [PR #51151](https://github.com/BerriAI/litellm/pull/51151)
- **Chat completions:** Fixed Azure and hosted vLLM changing the caller's messages, so repeated Azure image requests now hit the cache - [PR #53972](https://github.com/BerriAI/litellm/pull/53972)
- **Messages API:** Fixed 400s after a Gemini thinking turn on DeepSeek's Anthropic endpoint and on Claude `count_tokens` - [PR #51793](https://github.com/BerriAI/litellm/pull/51793)
- **Messages API:** Fixed `thinking` disabled, `display`, `between_tools` and `effort` being ignored on `/v1/messages` to OpenAI models - [PR #53987](https://github.com/BerriAI/litellm/pull/53987)
- **Vector stores:** Fixed chat requests carrying `vector_store_ids` failing with 400 from the provider when no stores are configured - [PR #51209](https://github.com/BerriAI/litellm/pull/51209)
- **Token counting:** Fixed `/utils/token_counter` and `/v1/messages/count_tokens` failing on a history with an Anthropic fallback block - [PR #54006](https://github.com/BerriAI/litellm/pull/54006)
- **Cost tracking and pricing:** Fixed OpenAI Agents API session calls through `/openai` logging $0, so key and team budgets now apply - [PR #53881](https://github.com/BerriAI/litellm/pull/53881)
- **Keys, teams and auth:** Fixed non-admin key owners clearing their key's `max_budget` by sending `null` to `/key/update`, now a 403 - [PR #53978](https://github.com/BerriAI/litellm/pull/53978)
- **Deployment:** Fixed the standalone UI image shipping outdated nginx and zlib, now nginx 1.31.10 and zlib 1.4 - [PR #54207](https://github.com/BerriAI/litellm/pull/54207)
- **SDK:** Fixed sync `messages.create(stream=True)` on `openai/` models raising `TypeError` in a plain `for` loop - [PR #54159](https://github.com/BerriAI/litellm/pull/54159)
- **Performance:** Improved end-user restriction refreshes to read only restricted customers instead of the whole end-user table - [PR #51772](https://github.com/BerriAI/litellm/pull/51772)

The changes are backported in [PR #52618](https://github.com/BerriAI/litellm/pull/52618), [PR #53427](https://github.com/BerriAI/litellm/pull/53427), [PR #53928](https://github.com/BerriAI/litellm/pull/53928), [PR #53979](https://github.com/BerriAI/litellm/pull/53979), [PR #54070](https://github.com/BerriAI/litellm/pull/54070), [PR #54082](https://github.com/BerriAI/litellm/pull/54082), [PR #54120](https://github.com/BerriAI/litellm/pull/54120), [PR #54125](https://github.com/BerriAI/litellm/pull/54125), [PR #54131](https://github.com/BerriAI/litellm/pull/54131), [PR #54137](https://github.com/BerriAI/litellm/pull/54137) and [PR #54232](https://github.com/BerriAI/litellm/pull/54232).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.16...v1.108.17
