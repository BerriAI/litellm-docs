---
title: "v1.90.3 - Bedrock Tool Config & MCP Log Redaction"
slug: "v1-90-3"
date: 2026-07-03T19:17:20
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
docker.litellm.ai/berriai/litellm:1.90.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.3
```

</TabItem>
</Tabs>

`v1.90.3` is a patch release on top of [`v1.90.2`](/release_notes/v1.90.2/v1-90-2). It drops the unsupported `toolSpec.strict` field for Bedrock Converse on Claude Opus 4.7/4.8, honors the cache TTL for Bedrock `tool_config` cache injection points, and stops the MCP client from logging tool-call input.

### What's Changed

- fix(bedrock/converse): drop toolSpec.strict for Opus 4.7/4.8 - [PR #31582](https://github.com/BerriAI/litellm/pull/31582)
- fix(bedrock): honor ttl for tool_config cache injection points - [PR #31929](https://github.com/BerriAI/litellm/pull/31929)
- fix(mcp): stop logging tool-call input in the MCP client - [PR #31393](https://github.com/BerriAI/litellm/pull/31393)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.2...v1.90.3
