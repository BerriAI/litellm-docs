---
title: "v1.101.1 - Bedrock maxTokens Floor & Wildcard License Fix"
slug: "v1-101-1"
date: 2026-09-21T12:00:00
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

`v1.101.1` is a patch release on top of [`v1.101.0`](/release_notes/v1.101.0/v1-101-0). It carries two fixes and no configuration changes.

On Amazon Bedrock, the Converse API rejects a `maxTokens` below 16 for the OpenAI GPT and xAI Grok model families, so a request that asked for fewer failed at the provider instead of being served. LiteLLM now raises the mapped value to that 16-token floor for those two families. Every other Bedrock model, including Anthropic Claude and Amazon Nova, still receives exactly the `max_tokens` or `max_completion_tokens` the caller sent, including values below 16. The floor is matched on the model id, so cross-region prefixes and inference-profile ARNs that wrap a GPT or Grok id are covered too. Note that the `openai.gpt-oss-*` models are outside this floor; they are matched by a different rule elsewhere and are unchanged by this release.

An enterprise license whose `allowed_features` is a wildcard now grants the auto-router feature. Before this, a wildcard license was not expanded for that one feature, so a deployment entitled to everything still saw auto-router refused.

This release also refreshes anyio to 4.14.2 and soupsieve to 2.9 in the lockfile, both versions the development line already resolves at or above. Those are lockfile changes that reach you through the image and the locked development environment; no declared dependency range moved.

### What's Changed

- fix(bedrock): clamp maxTokens to the 16-token minimum for OpenAI GPT and xAI Grok models on Converse - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- fix(license): let a wildcard allowed_features license grant the auto_router feature - [PR #41684](https://github.com/BerriAI/litellm/pull/41684)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.0...v1.101.1
