---
title: "LiteLLM v1.108.18 (LTS) adds ElevenLabs realtime transcription and Meta Muse"
description: "ElevenLabs `scribe_v2_realtime` and Meta Muse on Vertex AI join the LTS line, and `/v1/messages` guardrails keep tools and scan system prompts."
slug: "v1-108-18"
date: 2026-11-25T21:07:22
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

`v1.108.18` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.18
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.18
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.18`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.18) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.18` is a patch release on top of [`v1.108.17`](/release_notes/v1.108.17/v1-108-17). There are no new database migrations. The `v1.108.18` tag points at [`9b6796a`](https://github.com/BerriAI/litellm/commit/9b6796a64c6120a5c1aefcef25604aa78bdeabf5).

### What's Changed

- **OpenAI:** Fixed GPT Image 2.5 edits with a `markup` file failing with 400, and SDK tuple or `Path` uploads now work - [PR #53815](https://github.com/BerriAI/litellm/pull/53815)
- **Azure:** Fixed streamed Azure chats dropping `prompt_filter_results` and the finish chunk's `content_filter_results` - [PR #54158](https://github.com/BerriAI/litellm/pull/54158)
- **Anthropic:** Fixed streams failing or logging no spend when an Anthropic-format upstream sends a non-object or too-deep JSON line - [PR #53393](https://github.com/BerriAI/litellm/pull/53393)
- **AWS Bedrock:** Fixed Bedrock Mantle gemma-4 rejecting tool schemas with `propertyNames`, which failed every Claude Code turn - [PR #54230](https://github.com/BerriAI/litellm/pull/54230)
- **AWS Bedrock:** Fixed `/v1/messages` with a `fallback` block in history failing with 400 on Bedrock Invoke and Mantle - [PR #54386](https://github.com/BerriAI/litellm/pull/54386)
- **Vertex AI and Gemini:** Added Meta Muse models on Vertex AI with native Responses API routing - [PR #53388](https://github.com/BerriAI/litellm/pull/53388)
- **Other providers:** Fixed Z.AI GLM models answering 400 on `reasoning_effort`, so `/v1/messages` thinking now reaches them - [PR #54313](https://github.com/BerriAI/litellm/pull/54313)
- **Responses API:** Fixed chat-bridged follow-ups with an unknown `previous_response_id` answering a billed 200 without history, now a 400 - [PR #53768](https://github.com/BerriAI/litellm/pull/53768)
- **Messages API:** Added per-deployment `deferred_tools` handling so Claude Code tool loads keep the prompt cache on non-Anthropic models - [PR #54213](https://github.com/BerriAI/litellm/pull/54213)
- **Messages API:** Fixed null or numeric text blocks being dropped with a 200, now a 400 unless `drop_params` is on - [PR #54227](https://github.com/BerriAI/litellm/pull/54227)
- **Realtime:** Added ElevenLabs `scribe_v2_realtime` transcription on `/v1/realtime` with spend tracking - [PR #48984](https://github.com/BerriAI/litellm/pull/48984)
- **Guardrails:** Fixed tools-returning guardrails rewriting every `/v1/messages` tool, which dropped `web_search` and `defer_loading` - [PR #54323](https://github.com/BerriAI/litellm/pull/54323)
- **Guardrails:** Fixed Bedrock `during_call` guardrails on `/v1/messages` skipping the `system` prompt and `tool_result` blocks - [PR #54327](https://github.com/BerriAI/litellm/pull/54327)
- **Guardrails:** Improved Presidio CPU use on streams that start with many small frames - [PR #54379](https://github.com/BerriAI/litellm/pull/54379)
- **Admin UI:** Fixed team admins being refused when editing models on a team service account key, broken since v1.104.0 - [PR #54473](https://github.com/BerriAI/litellm/pull/54473)

The changes are backported in [PR #53403](https://github.com/BerriAI/litellm/pull/53403), [PR #54155](https://github.com/BerriAI/litellm/pull/54155) and [PR #54342](https://github.com/BerriAI/litellm/pull/54342).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.17...v1.108.18
