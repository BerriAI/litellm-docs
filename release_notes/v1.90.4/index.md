---
title: "v1.90.4 - Responses API Guardrail Coverage"
slug: "v1-90-4"
date: 2026-07-11T13:00:41
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
docker.litellm.ai/berriai/litellm:1.90.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.4
```

</TabItem>
</Tabs>

`v1.90.4` is a patch release on top of [`v1.90.3`](/release_notes/v1.90.3/v1-90-3). It restores text guardrail coverage on the Responses API (`/v1/responses`). The shared guardrail content helpers now walk the Responses `input` taxonomy (the `text`, `input_text`, and `output_text` part types, and `message`, `function_call`, and `function_call_output` items), so guardrails that build on those helpers (AIM, Lakera v2, Cato, Lasso, Repello, IBM, Azure Content Safety, and enterprise secret detection) inspect and redact request text on `/v1/responses` the same way they already do for chat completions.

### What's Changed

- fix(guardrails): walk Responses-API text taxonomy in shared content helpers - [PR #32542](https://github.com/BerriAI/litellm/pull/32542)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.3...v1.90.4
