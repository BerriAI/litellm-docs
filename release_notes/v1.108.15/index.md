---
title: "LiteLLM v1.108.15 (LTS) adds ResetData and fixes Cohere v2 chat params"
description: "ResetData joins as a provider, Cohere v2 chat accepts tool_choice, reasoning_effort and json_schema, and Groq and Meta transcription record spend."
slug: "v1-108-15"
date: 2026-11-21T21:34:14
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

`v1.108.15` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.15
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.15
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.15`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.15) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Set `api_key` or the provider's key env var on keyless JSON-configured deployments, which now get a 401.** See [PR #50819](https://github.com/BerriAI/litellm/pull/50819).

:::

`v1.108.15` is a patch release on top of [`v1.108.14`](/release_notes/v1.108.14/v1-108-14). There are no new database migrations. The `v1.108.15` tag points at [`43d4823`](https://github.com/BerriAI/litellm/commit/43d48236dc67b1a48629a85c4b727e2f088fc344).

### What's Changed

- **Other providers:** Added the ResetData provider and fixed $0 spend on Groq and Meta transcription - [PR #50819](https://github.com/BerriAI/litellm/pull/50819)
- **Other providers:** Fixed Cohere v2 streamed tool calls arriving as one empty chunk - [PR #47794](https://github.com/BerriAI/litellm/pull/47794)
- **Other providers:** Fixed Cohere v2 chat ignoring `tool_choice` and returning 400 for `reasoning_effort` and `json_schema` `response_format` - [PR #50834](https://github.com/BerriAI/litellm/pull/50834)

The changes are backported in [PR #51851](https://github.com/BerriAI/litellm/pull/51851) and [PR #53314](https://github.com/BerriAI/litellm/pull/53314).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.14...v1.108.15
