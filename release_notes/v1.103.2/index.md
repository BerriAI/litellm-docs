---
title: "v1.103.2 - Claude Code Auto Mode, CLI Session Spend and Pass-Through Fixes"
slug: "v1-103-2"
date: 2026-10-01T06:37:00
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
docker.litellm.ai/berriai/litellm:1.103.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::info Upgrading

There are no new database migrations or breaking changes on top of [`v1.103.1`](/release_notes/v1.103.1/v1-103-1). If you are upgrading from `v1.103.0` or earlier, read the breaking changes in the `v1.103.1` notes first: Admin UI and `lite` CLI users sign in once more after upgrading, and upgrades from `v1.102.x` or earlier add an index on `LiteLLM_SpendLogs`

:::

:::warning `lite` CLI users must log in again

Applies if you are upgrading from a release older than `v1.103.1`. After upgrading the proxy, every `lite` CLI user has to run `lite login` once more. Until they do, the CLI keeps sending its old session token and its requests to the proxy fail

:::

`v1.103.2` is a patch release on top of [`v1.103.1`](https://github.com/BerriAI/litellm/releases/tag/v1.103.1). It brings Claude Code auto mode through the gateway, attributes CLI session spend to the user behind it, and restores the pass-through endpoint handling that `v1.103.0` changed. The `v1.103.2` tag points at [`f69b210`](https://github.com/BerriAI/litellm/commit/f69b2103dfc0f7a41f65555fd66df05274584e5a)

## Claude Code auto mode works through the gateway

Claude Code auto mode sends a `safeguards` field on `/v1/messages` and expects `safeguard_results` in the reply. Earlier releases dropped the field, so `/status` showed `Auto mode server: Disabled` and every tool call fell back to the client-side classifier

The proxy now forwards `safeguards` and `anthropic-beta` unchanged on native Anthropic `/v1/messages`, and forwards `safeguards` plus the `dangerous-tool-use-2026-09-03` beta to Bedrock Invoke and Vertex AI. Azure AI Foundry gets the same passthrough, with the beta added whenever the request carries `safeguards`, since Foundry rejects `safeguards` without it

## CLI session spend is attributed to the user

Spend from `litellm-proxy login` sessions showed up in `/user/daily/activity/aggregated` under a 64-character hash with `null` `key_alias` and `user_email`. On busy days the name lookup for those hashes could also hit the statement timeout and return nothing

New CLI session spend is now recorded under the per-user `cli-session-<user_id>` alias. Hashes written before the upgrade get their owner back from the daily spend rows, and the key name lookup reads at most two spend log rows per key, so it no longer times out on large spend tables

## Pass-through endpoints are back to their pre-`v1.103.0` handling

With `STORE_MODEL_IN_DB=true`, `v1.103.0` let the config file own `general_settings.pass_through_endpoints`. That broke three things: config pass-throughs with `forward_headers: true` stopped forwarding `Authorization`, creating, updating or deleting a pass-through in the Admin UI was rejected once the config declared any, and `os.environ/` targets were sent upstream unresolved and returned a 500

Config and DB pass-throughs are merged again on every DB sync and config reload, a pass-through saved in the Admin UI starts serving right away next to the config ones, and forwarded headers reach the backend unchanged. If your config declares pass-throughs, any pass-throughs stored in the DB on other paths start serving again after the upgrade, as they did before `v1.103.0`

### What's Changed

- fix(anthropic): forward safeguards and anthropic-beta unchanged on native /v1/messages - [PR #42152](https://github.com/BerriAI/litellm/pull/42152)
- fix(anthropic): forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [PR #42288](https://github.com/BerriAI/litellm/pull/42288)
- fix(anthropic): forward the dangerous-tool-use beta to Azure AI Foundry - [`44115c5`](https://github.com/BerriAI/litellm/commit/44115c5f2b914e562b91823390bbc26f0c93867d)
- fix(azure_ai): add the dangerous-tool-use beta when Foundry gets safeguards - [`3b00260`](https://github.com/BerriAI/litellm/commit/3b00260b869bcc56d099c4d867e26a9b88ca3f0a)
- fix(spend): attribute CLI session spend to the per-user cli-session alias instead of the hashed session token - [PR #40541](https://github.com/BerriAI/litellm/pull/40541)
- fix(proxy): recover session key owners from daily spend for usage attribution - [PR #43642](https://github.com/BerriAI/litellm/pull/43642)
- fix(proxy): look up hashed key names with two spend log rows per key - [PR #43656](https://github.com/BerriAI/litellm/pull/43656)
- fix(proxy): restore pre-config-wins handling of pass-through endpoints - [PR #43962](https://github.com/BerriAI/litellm/pull/43962)
- chore(release): bump litellm-enterprise 0.1.69 -> 0.1.69.post1 for stable/1.103.x - [`fe87252`](https://github.com/BerriAI/litellm/commit/fe872527f135acd6f0935e6554623b0ec9f95f22)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.1...v1.103.2
