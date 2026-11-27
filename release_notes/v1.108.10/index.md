---
title: "LiteLLM v1.108.10 (LTS) fixes Vertex Claude 4096-token cap and EU o3 spend"
description: "Versioned Claude models on Vertex AI no longer stop at 4096 tokens, and Azure EU o-series base models record real spend instead of $0."
slug: "v1-108-10"
date: 2026-11-16T21:57:41
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

`v1.108.10` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.10
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.10
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.10`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.10) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.10` is a patch release on top of [`v1.108.9`](/release_notes/v1.108.9/v1-108-9). There are no new database migrations. The `v1.108.10` tag points at [`5d6a139`](https://github.com/BerriAI/litellm/commit/5d6a1394b8eea12099493c029334c1b78976f49e).

### What's Changed

- **Vertex AI and Gemini:** Fixed versioned `claude-*@<version>` models stopping at 4096 tokens when `max_tokens` is unset - [PR #51863](https://github.com/BerriAI/litellm/pull/51863)
- **Chat completions:** Fixed 400 on async Codestral chat with a `file` part and streamed PDF URLs stalling the proxy worker - [PR #51860](https://github.com/BerriAI/litellm/pull/51860)
- **Cost tracking and pricing:** Fixed $0 spend on deployments whose `base_model` is `azure/eu/o3`, `o4-mini`, `o1` or `o3-mini` - [PR #47497](https://github.com/BerriAI/litellm/pull/47497)

The cost fix from [PR #47497](https://github.com/BerriAI/litellm/pull/47497) is backported in [PR #51412](https://github.com/BerriAI/litellm/pull/51412).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.9...v1.108.10
