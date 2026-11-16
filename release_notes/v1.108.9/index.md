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

- **Azure:** Fixed Azure deployments on a Foundry project `/openai/v1` URL failing every Responses and chat call, and resource-level `/openai/v1` Responses bases answering 404 from a doubled path. A deployment behind a gateway URL can set `api_version: none`, and `azure/model-router` calls bill the model the router picked - [PR #51767](https://github.com/BerriAI/litellm/pull/51767)
- **Azure:** Fixed Kimi K3 on Azure AI Foundry forgetting its earlier reasoning after each tool call, and `reasoning_effort` being refused or dropped for it - [PR #51747](https://github.com/BerriAI/litellm/pull/51747)
- **AWS Bedrock:** Fixed `s3://` image, PDF and video URLs on Bedrock Converse answering 500. They now reach Bedrock as S3 sources, and a non-admin key can only name buckets listed in `general_settings.allowed_client_side_s3_buckets` - [PR #50577](https://github.com/BerriAI/litellm/pull/50577)
- **AWS Bedrock:** Fixed Bedrock knowledge base search through the OpenAI vector store API answering an AWS 400 for OpenAI-style filters. A malformed filter now gets a clear 400, or is dropped under `drop_params` - [PR #51291](https://github.com/BerriAI/litellm/pull/51291)
- **Vertex AI and Gemini:** Added `litellm_settings.vertex_request_label_fields`, which labels Vertex calls with the caller's key, team, org and project so Cloud Billing can split Vertex spend. The proxy sets these labels itself and drops any a caller sends - [PR #50732](https://github.com/BerriAI/litellm/pull/50732)
- **Vertex AI and Gemini:** Changed Vertex AI Claude to send `labels` in the `X-Vertex-AI-Labels` header instead of the request body, so calls with `labels` no longer fail with a 400 - [PR #48753](https://github.com/BerriAI/litellm/pull/48753)
- **Responses API:** Fixed chat completions with function tools on GPT models served through the Responses API, such as gpt-6 on Azure AI Foundry and gpt-6.1 on OpenAI, dropping the client's `cache_control` marks, so prompt caching never applied - [PR #51783](https://github.com/BerriAI/litellm/pull/51783)
- **Responses API:** Fixed streamed `/v1/responses` dropping the first answer fragment when a provider sent it together with reasoning - [PR #51356](https://github.com/BerriAI/litellm/pull/51356)
- **Routing and fallbacks:** Added Vercel AI Gateway models on `/v1/decisions`, billed at the cost Vercel reports, cache hits included - [PR #50642](https://github.com/BerriAI/litellm/pull/50642)

The changes are backported in [PR #51356](https://github.com/BerriAI/litellm/pull/51356), [PR #50401](https://github.com/BerriAI/litellm/pull/50401), [PR #51748](https://github.com/BerriAI/litellm/pull/51748), [PR #51786](https://github.com/BerriAI/litellm/pull/51786), [PR #51796](https://github.com/BerriAI/litellm/pull/51796), [PR #51769](https://github.com/BerriAI/litellm/pull/51769), [PR #51250](https://github.com/BerriAI/litellm/pull/51250) and [PR #51292](https://github.com/BerriAI/litellm/pull/51292).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.8...v1.108.9
