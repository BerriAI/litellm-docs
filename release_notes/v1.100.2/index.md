---
title: "v1.100.2 - Claude Code Auto Mode, Bedrock GPT and Grok Fixes & TypeSafe Jev"
slug: "v1-100-2"
date: 2026-09-23T06:12:15
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
docker.litellm.ai/berriai/litellm:1.100.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.100.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.100.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.100.2` is a patch release on top of [`v1.100.1`](/release_notes/v1.100.1/v1-100-1). It lets Claude Code auto mode work through the gateway, fixes Claude Code model switches to Bedrock OpenAI GPT and xAI Grok models, routes mid-stream Responses content policy errors to `content_policy_fallbacks`, and adds the TypeSafe Jev pass-through. There are no configuration changes. Both the Docker image and the PyPI package were built from [`9c1216a`](https://github.com/BerriAI/litellm/commit/9c1216a4278a4b8224ac1c8bfa922a110cdcd678)

## Claude Code auto mode works through the gateway

Claude Code auto mode sends a `safeguards` field and the `dangerous-tool-use-2026-09-03` beta on `/v1/messages`. The proxy dropped the field on the native Anthropic route and stripped beta values it did not recognize, while Bedrock Invoke and Bedrock Mantle dropped both and Vertex AI forwarded the field without the beta. Claude Code then reported auto mode as unavailable through the gateway and kept billing its own classifier calls. The field and the beta now reach Anthropic, Bedrock and Vertex AI together, and `safeguard_results` comes back to Claude Code

## Bedrock OpenAI GPT and xAI Grok models on Converse

On Bedrock Converse, OpenAI GPT and xAI Grok models reject a `maxTokens` below 16. Claude Code sends a `max_tokens=1` probe when `/model` switches to one of them, so the switch failed with a 400. The proxy now raises `maxTokens` to 16 for `openai.gpt-*` and `xai.grok-*` models on Converse, and every other Bedrock model still receives exactly what the caller sent

After that probe, the first real turn on a GPT-6 model such as `us.openai.gpt-6-astra` still failed with 400 `Unknown parameter: 'thinking'`, because the Converse reasoning gate on this line only recognized `openai.gpt-5`. It now matches any `openai.gpt-<digit>` model, so `reasoning_effort` maps to `reasoning.effort` and an Anthropic `thinking` block is dropped for these models

## Mid-stream Responses API content policy errors reach fallbacks

A `content_policy_violation` that arrived mid-stream on the Responses API surfaced as a bare `APIError`, so it never reached `content_policy_fallbacks` and the client got the raw error. Mid-stream error events now map to the same typed exceptions as the non-streaming path. A refusal goes to `content_policy_fallbacks`, 429 and 5xx stay eligible for the normal fallbacks, and other client errors such as context window errors raise directly

## TypeSafe Jev pass-through

TypeSafe Jev is available on this line. A new `/typesafe/{endpoint}` pass-through forwards to TypeSafe with the proxy's `TYPESAFE_API_KEY`, so callers use their virtual keys and spend is priced from the model registry entries for `typesafe/jev-1.13.0`, `typesafe/jev-latest` and `typesafe/jev-preview`. See the [TypeSafe pass-through docs](/docs/pass_through/typesafe)

### What's Changed

- fix(anthropic): forward safeguards and anthropic-beta unchanged on native /v1/messages - [PR #42152](https://github.com/BerriAI/litellm/pull/42152)
- fix(anthropic): forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [PR #42288](https://github.com/BerriAI/litellm/pull/42288)
- fix(bedrock): clamp maxTokens to the 16-token minimum for OpenAI GPT and xAI Grok models on Converse - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- fix(bedrock): match any `openai.gpt-<digit>` model in the Converse reasoning gate, from [PR #31884](https://github.com/BerriAI/litellm/pull/31884)
- fix(responses): route mid-stream error events through exception_type so content_policy_fallbacks fire - [PR #40988](https://github.com/BerriAI/litellm/pull/40988)
- feat(proxy): add TypeSafe AI Jev evaluate passthrough with registry-priced spend tracking - [PR #41607](https://github.com/BerriAI/litellm/pull/41607)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.1...v1.100.2
