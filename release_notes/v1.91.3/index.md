---
title: "v1.91.3 - Responses Guardrail Coverage & OTel Exception Events"
slug: "v1-91-3"
date: 2026-07-11T15:20:47
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
docker.litellm.ai/berriai/litellm:1.91.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.91.3
```

</TabItem>
</Tabs>

`v1.91.3` is a patch release on top of [`v1.91.2`](/release_notes/v1.91.2/v1-91-2). It backports two changes onto the 1.91.x line. The first restores guardrail coverage on the Responses API: shared content helpers now walk the Responses item taxonomy, so text guardrails once again see user and tool-output text on `/v1/responses` instead of scanning an empty payload. The second records a failed LLM call as the GenAI-standard `gen_ai.client.operation.exception` log event, carrying the exception type, message, and stacktrace at WARN severity so observability backends see the full failure.

### What's Changed

- fix(guardrails): walk Responses-API text taxonomy in shared content helpers - [PR #32542](https://github.com/BerriAI/litellm/pull/32542)
- feat(otel): emit the gen_ai.client.operation.exception event on failed LLM calls - [PR #32655](https://github.com/BerriAI/litellm/pull/32655)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.91.2...v1.91.3
