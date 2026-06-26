---
title: "v1.87.5 - Web Search Costing & MCP Key Scoping"
slug: "v1-87-5"
date: 2026-06-24T18:28:54
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

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.87.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.87.5
```

</TabItem>
</Tabs>

`v1.87.5` is a patch release on top of [`v1.87.4`](/release_notes/v1.87.4/v1-87-4). It backports cost-tracking recovery for interrupted Anthropic streams, fixes a `completion_cost` `AttributeError` on streaming Anthropic web-search responses, adds a `no-mcp-servers` sentinel that scopes a key to zero MCP servers, and bumps the wolfi-base image to patch the OpenSSL CVE.

### What's Changed

- fix(passthrough): recover output tokens for interrupted anthropic streams - [PR #30787](https://github.com/BerriAI/litellm/pull/30787)
- fix(proxy): record partial spend on the failure row for interrupted streams - [PR #30788](https://github.com/BerriAI/litellm/pull/30788)
- feat(mcp): scope a key to zero MCP servers with no-mcp-servers sentinel - [PR #31029](https://github.com/BerriAI/litellm/pull/31029)
- fix(passthrough,streaming): recover cost on interrupted and agentic Anthropic streams - [PR #31035](https://github.com/BerriAI/litellm/pull/31035)
- fix: completion_cost AttributeError on streaming Anthropic web_search responses - [PR #27346](https://github.com/BerriAI/litellm/pull/27346)
- fix(docker): bump wolfi-base digest to patch openssl CVE-2026-34182 - [PR #31133](https://github.com/BerriAI/litellm/pull/31133)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.87.4...v1.87.5
