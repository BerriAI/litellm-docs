---
title: "v1.89.4 - Vertex Batch Uploads & CVE Patches"
slug: "v1-89-4"
date: 2026-06-25T02:38:49
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

:::warning Potential performance regression under investigation

We're investigating a potential throughput regression in recent releases. It appears limited to certain deployment configurations rather than affecting all deployments, so we expect it to impact only a small subset of users; correctness and error rates are not affected.

**Update (June 26, 2026):** We've identified potential causes and will need more time to test before we can confirm a fix. We'll update this note with the affected versions and the fix as soon as we have them.

For throughput-sensitive workloads, we recommend validating performance in a staging environment before rolling out an upgrade.

:::

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.89.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.89.4
```

</TabItem>
</Tabs>

`v1.89.4` is a patch release on top of [`v1.89.3`](/release_notes/v1.89.3/v1-89-3). It streams OpenAI→Vertex batch JSONL uploads instead of buffering them in memory, backports cost-tracking recovery for interrupted Anthropic streams, adds a `no-mcp-servers` sentinel that scopes a key to zero MCP servers, and clears the remaining OSV-flagged CVEs with OpenSSL and dependency bumps. The bundled `litellm-enterprise` package is bumped to `0.1.42.post2`.

### What's Changed

- fix(passthrough): recover output tokens for interrupted anthropic streams - [PR #30787](https://github.com/BerriAI/litellm/pull/30787)
- fix(proxy): record partial spend on the failure row for interrupted streams - [PR #30788](https://github.com/BerriAI/litellm/pull/30788)
- feat(mcp): scope a key to zero MCP servers with no-mcp-servers sentinel - [PR #31029](https://github.com/BerriAI/litellm/pull/31029)
- fix(passthrough,streaming): recover cost on interrupted and agentic Anthropic streams - [PR #31035](https://github.com/BerriAI/litellm/pull/31035)
- fix(vertex/files): stream OpenAI->Vertex batch JSONL uploads - [PR #31036](https://github.com/BerriAI/litellm/pull/31036)
- fix(deps): bump osv-flagged dependencies to clear known CVEs - [PR #31122](https://github.com/BerriAI/litellm/pull/31122)
- fix(docker): bump wolfi-base digest to patch openssl CVE-2026-34182 - [PR #31133](https://github.com/BerriAI/litellm/pull/31133)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.89.3...v1.89.4
