---
title: "v1.102.1 - Claude Code Auto Mode, Realtime Handshake Errors, OTEL Metadata & TypeSafe Jev"
slug: "v1-102-1"
date: 2026-09-23T06:12:28
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
docker.litellm.ai/berriai/litellm:1.102.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.102.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.102.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.102.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.102.1` is a patch release on top of [`v1.102.0`](/release_notes/v1.102.0/v1-102-0). It lets Claude Code auto mode work through the gateway, reports refused realtime handshakes to the client, promotes nested caller metadata to OTEL span attributes, and brings the TypeSafe Jev integrations to this line. There are no configuration changes for existing setups. Both the Docker image and the PyPI package were built from [`d09bbae`](https://github.com/BerriAI/litellm/commit/d09bbae1c6df463e425558f60d460437193635da)

## Claude Code auto mode works through the gateway

Claude Code auto mode sends a `safeguards` field and the `dangerous-tool-use-2026-09-03` beta on `/v1/messages`. The proxy dropped the field on the native Anthropic route and stripped beta values it did not recognize, while Bedrock Invoke and Bedrock Mantle dropped both and Vertex AI forwarded the field without the beta. Claude Code then reported auto mode as unavailable through the gateway and kept billing its own classifier calls. The field and the beta now reach Anthropic, Bedrock and Vertex AI together, and `safeguard_results` comes back to Claude Code

## Realtime clients see why an upstream handshake was refused

When the upstream realtime handshake was refused, for example an Azure 401, the client was closed with 1006 and no event, and the Azure relay could leave the client socket open. Every realtime relay now sends an `error` event naming the upstream HTTP status and closes with a mapped code: 1008 for 401 and 403, 1013 for 429 and 1011 for anything else

## Nested caller metadata on OTEL spans

`baggage_metadata_keys: [requester_metadata.trace_id]` promoted nothing, and the legacy OTEL v1 callback had no allowlist for caller metadata at all. Nested request metadata is now flattened to dotted paths before the allowlist lookup, so an allowlisted `requester_metadata.<path>` lands on the span as `litellm.metadata.<path>` on both OTEL v1 and v2. `requester_metadata` as a whole is still never promoted

## TypeSafe Jev

TypeSafe Jev is available on this line. A new `/typesafe/{endpoint}` pass-through forwards to TypeSafe with the proxy's `TYPESAFE_API_KEY`, so callers use their virtual keys and spend is priced from the model registry entries for `typesafe/jev-1.13.0`, `typesafe/jev-latest` and `typesafe/jev-preview`. See the [TypeSafe pass-through docs](/docs/pass_through/typesafe)

The complexity router and the Auto Router accept Jev as a tier classifier (`classifier_type: jev`), and Jev evaluations respect virtual key budgets. A new `typesafe` guardrail scores each completed tool exchange and blanks tool results Jev judges irrelevant, which trims long agent loops without a summarization call; it is opt-in and fails open. An `/openrouter/{path}` pass-through prices `openrouter/typesafe/jev-1.13` decisions from a new cost map row

## Dependencies

The lockfile moves anyio to 4.14.2 and soupsieve to 2.9. No declared dependency range changed

### What's Changed

- fix(anthropic): forward safeguards and anthropic-beta unchanged on native /v1/messages - [PR #42152](https://github.com/BerriAI/litellm/pull/42152)
- fix(anthropic): forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [PR #42288](https://github.com/BerriAI/litellm/pull/42288)
- fix(realtime): surface an upstream handshake refusal as an error event and policy close - [PR #42388](https://github.com/BerriAI/litellm/pull/42388)
- feat(otel): promote nested request metadata keys to litellm.metadata.* span attributes - [PR #41462](https://github.com/BerriAI/litellm/pull/41462)
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

https://github.com/BerriAI/litellm/compare/v1.102.0...v1.102.1
