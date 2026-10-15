---
title: "v1.90.2 - Realtime Stability & Bounded Logging"
slug: "v1-90-2"
date: 2026-07-01T02:09:44
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
docker.litellm.ai/berriai/litellm:1.90.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.2
```

</TabItem>
</Tabs>

`v1.90.2` is a patch release on top of [`v1.90.1`](/release_notes/v1.90.1/v1-90-1). It hardens realtime handling by preventing a second Gemini Live setup, retrying a hung handshake, and closing a guardrail bypass, and it routes realtime success logging through the bounded logging worker so it no longer competes with request handling on the event loop.

### What's Changed

- fix(realtime): stop second Gemini Live setup, retry hung handshake, close guardrail bypass - [PR #31519](https://github.com/BerriAI/litellm/pull/31519)
- fix(logging): route realtime success logging through the bounded worker - [PR #31733](https://github.com/BerriAI/litellm/pull/31733)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.1...v1.90.2
