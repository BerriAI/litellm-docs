---
title: "v1.85.7 - Stream Cost Recovery & Cache-Control Cap"
slug: "v1-85-7"
date: 2026-06-24T04:58:06
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
docker.litellm.ai/berriai/litellm:1.85.7
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.85.7
```

</TabItem>
</Tabs>

`v1.85.7` is a patch release on top of [`v1.85.6`](/release_notes/v1.85.6/v1-85-6). It backports cost-tracking recovery for interrupted Anthropic streams, caps Anthropic `cache_control` injection at the 4-block API limit, and pulls in OpenSSL and OSV-flagged dependency bumps for CVE coverage. It also hardens usage parsing by coercing a dict `server_tool_use` into a typed `ServerToolUse` object.

### What's Changed

- fix(integrations): cap Anthropic cache_control injection at 4 blocks - [PR #30480](https://github.com/BerriAI/litellm/pull/30480)
- fix(passthrough): recover output tokens for interrupted anthropic streams - [PR #30787](https://github.com/BerriAI/litellm/pull/30787)
- fix(proxy): record partial spend on the failure row for interrupted streams - [PR #30788](https://github.com/BerriAI/litellm/pull/30788)
- fix(passthrough,streaming): recover cost on interrupted and agentic Anthropic streams - [PR #31035](https://github.com/BerriAI/litellm/pull/31035)
- fix(deps): bump osv-flagged dependencies to clear known CVEs - [PR #31122](https://github.com/BerriAI/litellm/pull/31122)
- fix(docker): bump wolfi-base digest to patch openssl CVE-2026-34182 - [PR #31133](https://github.com/BerriAI/litellm/pull/31133)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.85.6...v1.85.7
