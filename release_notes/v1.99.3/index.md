---
title: "v1.99.3 - Claude Code Auto Mode and TypeSafe Jev Passthrough"
slug: "v1-99-3"
date: 2026-09-23T07:10:00
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
docker.litellm.ai/berriai/litellm:1.99.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.99.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.99.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.99.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.99.3` is a patch release on top of [`v1.99.2`](/release_notes/v1.99.2/v1-99-2). It brings Claude Code auto mode through the gateway and adds the TypeSafe Jev passthrough. There are no new database migrations or breaking changes. The `v1.99.3` tag points at [`16923e0`](https://github.com/BerriAI/litellm/commit/16923e0e18005a8c4bd4e54b93aab7908e3a44a7)

## Claude Code auto mode works through the gateway

Claude Code auto mode sends a `safeguards` field on `/v1/messages` and expects `safeguard_results` in the reply. Earlier releases dropped the field, so `/status` showed `Auto mode server: Disabled` and every tool call fell back to the client-side classifier

The proxy now forwards `safeguards` and `anthropic-beta` unchanged on native Anthropic `/v1/messages`, and forwards `safeguards` plus the `dangerous-tool-use-2026-09-03` beta to Bedrock Invoke and Vertex AI

## TypeSafe Jev passthrough

Set `TYPESAFE_API_KEY` and the proxy forwards `/typesafe/*` requests to TypeSafe, logs them, and tracks their spend. Pricing entries are added for `typesafe/jev-latest`, `typesafe/jev-preview` and `typesafe/jev-1.13.0`

### What's Changed

- fix(anthropic): forward safeguards and anthropic-beta unchanged on native /v1/messages - [`9f6a6f8`](https://github.com/BerriAI/litellm/commit/9f6a6f89f1752f861c72a54330b955b128219312)
- fix(anthropic): forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [`a631bf7`](https://github.com/BerriAI/litellm/commit/a631bf730a6a544eced982374aea0ebc6cbb0271)
- feat(typesafe): add TypeSafe Jev passthrough with logging and cost tracking - [`7d1db43`](https://github.com/BerriAI/litellm/commit/7d1db43c6883bf4ad61806547b64eef13aa36010)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.99.1...v1.99.3
