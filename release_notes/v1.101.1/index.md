---
title: "v1.101.1 - Claude Code Auto Mode, Wildcard License Auto-Router & TypeSafe Jev"
slug: "v1-101-1"
date: 2026-09-23T06:12:25
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
docker.litellm.ai/berriai/litellm:1.101.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.101.1` is a patch release on top of [`v1.101.0`](/release_notes/v1.101.0/v1-101-0). It lets Claude Code auto mode work through the gateway, fixes Claude Code model switches to Bedrock OpenAI GPT and xAI Grok models, lets a wildcard enterprise license lift the auto-router limit, and brings the TypeSafe Jev integrations to this line. There are no configuration changes for existing setups. Both the Docker image and the PyPI package were built from [`432215e`](https://github.com/BerriAI/litellm/commit/432215e6196935d63b5558b3f2fa7ac38965449e)

## Claude Code auto mode works through the gateway

Claude Code auto mode sends a `safeguards` field and the `dangerous-tool-use-2026-09-03` beta on `/v1/messages`. The proxy dropped the field on the native Anthropic route and stripped beta values it did not recognize, while Bedrock Invoke and Bedrock Mantle dropped both and Vertex AI forwarded the field without the beta. Claude Code then reported auto mode as unavailable through the gateway and kept billing its own classifier calls. The field and the beta now reach Anthropic, Bedrock and Vertex AI together, and `safeguard_results` comes back to Claude Code

## Bedrock OpenAI GPT and xAI Grok models on Converse

On Bedrock Converse, OpenAI GPT and xAI Grok models reject a `maxTokens` below 16. Claude Code sends a `max_tokens=1` probe when `/model` switches to one of them, so the switch failed with a 400. The proxy now raises `maxTokens` to 16 for `openai.gpt-*` and `xai.grok-*` models on Converse, and every other Bedrock model still receives exactly what the caller sent

## A wildcard license grants the auto-router feature

Enterprise licenses default to `allowed_features: ["*"]`, but the auto-router gate in `v1.101.0` only accepted a literal `auto_router` entry. A wildcard license kept the one-router-per-capability limit, and two custom auto-routers in `config.yaml` aborted startup with a `ValueError`. A `*` entry now grants every feature, auto-router included

## Team model aliases on the JWT auth path

Team model aliases did not apply to callers authenticated with a JWT, so restricted teams got a 403 and open teams a 400 when they used an alias. The JWT path now loads the same team fields as the virtual key path, aliases included

## TypeSafe Jev

TypeSafe Jev is available on this line. A new `/typesafe/{endpoint}` pass-through forwards to TypeSafe with the proxy's `TYPESAFE_API_KEY`, so callers use their virtual keys and spend is priced from the model registry entries for `typesafe/jev-1.13.0`, `typesafe/jev-latest` and `typesafe/jev-preview`. See the [TypeSafe pass-through docs](/docs/pass_through/typesafe)

The complexity router and the Auto Router accept Jev as a tier classifier (`classifier_type: jev`), and Jev evaluations respect virtual key budgets. A new `typesafe` guardrail scores each completed tool exchange and blanks tool results Jev judges irrelevant, which trims long agent loops without a summarization call; it is opt-in and fails open. An `/openrouter/{path}` pass-through prices `openrouter/typesafe/jev-1.13` decisions from a new cost map row

## Dependencies

The lockfile moves anyio to 4.14.2 and soupsieve to 2.9. No declared dependency range changed

### What's Changed

- fix(anthropic): forward safeguards and anthropic-beta unchanged on native /v1/messages - [PR #42152](https://github.com/BerriAI/litellm/pull/42152)
- fix(anthropic): forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [PR #42288](https://github.com/BerriAI/litellm/pull/42288)
- fix(bedrock): clamp maxTokens to the 16-token minimum for OpenAI GPT and xAI Grok models on Converse - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- fix(license): let a wildcard allowed_features license grant the auto_router feature - [PR #41684](https://github.com/BerriAI/litellm/pull/41684)
- fix(proxy): apply team model aliases on the JWT auth path - [PR #39985](https://github.com/BerriAI/litellm/pull/39985)
- feat(proxy): add TypeSafe AI Jev evaluate passthrough with registry-priced spend tracking - [PR #41607](https://github.com/BerriAI/litellm/pull/41607)
- feat(router): add TypeSafe Jev as a complexity router classifier - [PR #41615](https://github.com/BerriAI/litellm/pull/41615)
- fix(proxy): forward every method on the typesafe pass-through route - [PR #41723](https://github.com/BerriAI/litellm/pull/41723)
- feat(guardrails): add TypeSafe Jev relevance-based compaction guardrail - [PR #41757](https://github.com/BerriAI/litellm/pull/41757)
- fix(proxy): enforce virtual key budgets for JEV test routing - [PR #41879](https://github.com/BerriAI/litellm/pull/41879)
- feat(auto-router): add JEV classifier alongside LLM classifier - [PR #41886](https://github.com/BerriAI/litellm/pull/41886)
- feat(openrouter): price typesafe/jev-1.13 and add an openrouter decisions pass-through - [PR #42301](https://github.com/BerriAI/litellm/pull/42301)
- feat(auto-router): allow opted-in team members to manage their routers, the parts the Jev router changes build on - [PR #41175](https://github.com/BerriAI/litellm/pull/41175)
- chore(deps): refresh anyio and soupsieve in the lockfile

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.0...v1.101.1
