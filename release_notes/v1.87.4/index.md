---
title: "v1.87.4 - Guardrails & Logging Fixes"
slug: "v1-87-4"
date: 2026-06-20T14:44:03
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
docker.litellm.ai/berriai/litellm:1.87.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.87.4
```

</TabItem>
</Tabs>

`v1.87.4` is a patch release on top of [`v1.87.3`](/release_notes/v1.87.3/v1-87-3). It backports guardrail correctness fixes (a single pre-call hook for model-level guardrails, no DB re-init on every poll, 400 instead of 500 when AIM blocks a request), caps Anthropic cache-control injection, and resolves several logging issues across Datadog batching, passthrough duplication, and Claude Code traces.

### What's Changed

- fix(datadog): split oversized batches on 413 instead of re-queueing forever - [PR #29444](https://github.com/BerriAI/litellm/pull/29444)
- fix: stop use_chat_completions_api flag from leaking into provider request body - [PR #29447](https://github.com/BerriAI/litellm/pull/29447)
- fix: duplicate Claude Code traces - [PR #29311](https://github.com/BerriAI/litellm/pull/29311)
- fix: passthrough endpoints duplicate logs - [PR #29598](https://github.com/BerriAI/litellm/pull/29598)
- fix(integrations): cap Anthropic cache_control injection at 4 blocks - [PR #30480](https://github.com/BerriAI/litellm/pull/30480)
- fix(guardrails): run pre_call hook once for model-level guardrails - [PR #30543](https://github.com/BerriAI/litellm/pull/30543)
- fix(guardrails): stop re-initializing DB guardrails on every poll - [PR #30542](https://github.com/BerriAI/litellm/pull/30542)
- fix(guardrails): return 400 not 500 when AIM blocks a request - [PR #30573](https://github.com/BerriAI/litellm/pull/30573)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.87.3...v1.87.4
