---
title: "LiteLLM v1.108.9 (LTS) adds Vertex labels and fixes Foundry /openai/v1"
description: "Vertex calls can carry the caller's key, team, org and project labels, Azure Foundry /openai/v1 deployments work, and Bedrock Converse reads s3:// media."
slug: "v1-108-9"
date: 2026-11-14T22:00:02
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

`v1.108.9` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.9
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.9
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.9`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.9) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.9` is a patch release on top of [`v1.108.8`](/release_notes/v1.108.8/v1-108-8). There are no new database migrations. The `v1.108.9` tag points at [`82ae95f`](https://github.com/BerriAI/litellm/commit/82ae95fa3d7194df7178e9f06e1c497e37611a07).

### What's Changed

- **Azure:** Fixed Kimi K3 on Azure AI Foundry losing its earlier reasoning after tool calls and refusing `reasoning_effort` - [PR #51747](https://github.com/BerriAI/litellm/pull/51747)
- **Azure:** Fixed 400 on Foundry project `/openai/v1` bases and 404 on resource-level `/openai/v1` Responses bases - [PR #51767](https://github.com/BerriAI/litellm/pull/51767)
- **AWS Bedrock:** Fixed 500 on `s3://` image, PDF and video URLs on Converse models, which now go to Bedrock as S3 sources - [PR #50577](https://github.com/BerriAI/litellm/pull/50577)
- **AWS Bedrock:** Fixed AWS 400 on Bedrock vector store search with OpenAI-style filters - [PR #51291](https://github.com/BerriAI/litellm/pull/51291)
- **Vertex AI and Gemini:** Added `vertex_request_label_fields` to label Vertex calls with the caller's key, team, org and project - [PR #50732](https://github.com/BerriAI/litellm/pull/50732)
- **Vertex AI and Gemini:** Fixed 400 `Extra inputs are not permitted` when sending `labels` to Claude on Vertex AI - [PR #48753](https://github.com/BerriAI/litellm/pull/48753)
- **Other providers:** Added Vercel AI Gateway models on `/v1/decisions`, billed at the cost Vercel reports - [PR #50642](https://github.com/BerriAI/litellm/pull/50642)
- **Responses API:** Fixed streamed `/v1/responses` dropping the first answer fragment when it arrives together with reasoning - [PR #51356](https://github.com/BerriAI/litellm/pull/51356)
- **Responses API:** Fixed `cache_control` marks being dropped on chat requests with function tools bridged to the Responses API - [PR #51783](https://github.com/BerriAI/litellm/pull/51783)
- **Deployment:** Changed the Docker images to a newer Wolfi base and updated opentelemetry, dnspython, tornado and soupsieve - [PR #51853](https://github.com/BerriAI/litellm/pull/51853)

The changes are backported in [PR #50401](https://github.com/BerriAI/litellm/pull/50401), [PR #51250](https://github.com/BerriAI/litellm/pull/51250), [PR #51292](https://github.com/BerriAI/litellm/pull/51292), [PR #51748](https://github.com/BerriAI/litellm/pull/51748), [PR #51769](https://github.com/BerriAI/litellm/pull/51769), [PR #51786](https://github.com/BerriAI/litellm/pull/51786) and [PR #51796](https://github.com/BerriAI/litellm/pull/51796).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.8...v1.108.9
