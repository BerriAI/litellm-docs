---
title: "v1.94.0rc2 - Fireworks AI Content-Type Fix"
slug: "v1-94-0-rc-2"
date: 2026-07-20T17:30:00
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
docker.litellm.ai/berriai/litellm:1.94.0-rc.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.94.0rc2
```

</TabItem>
</Tabs>

## Key Highlights

`v1.94.0rc2` is the current release candidate for 1.94.0. It carries a single fix on top of [`v1.94.0rc1`](/release_notes/v1.94.0rc1/v1-94-0-rc-1).

- **Fireworks AI requests send `Content-Type: application/json` again** - chat and text completion calls had stopped setting the JSON content type, so Fireworks rejected them with HTTP 415. Header construction now delegates to the OpenAI base config and layers the Fireworks `x-session-affinity` header on top, so the content type cannot drift away from the base again. A caller that supplies its own `Content-Type` still wins.

## LLM Translation

### Bug Fixes

- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Restore the `Content-Type: application/json` request header - [PR #33929](https://github.com/BerriAI/litellm/pull/33929)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.94.0-rc.1...v1.94.0-rc.2
