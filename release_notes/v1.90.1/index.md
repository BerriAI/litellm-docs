---
title: "v1.90.1 - Vertex Batch Uploads & Key Redaction"
slug: "v1-90-1"
date: 2026-06-30T01:40:47
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
docker.litellm.ai/berriai/litellm:1.90.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.1
```

</TabItem>
</Tabs>

`v1.90.1` is a patch release on top of [`v1.90.0`](/release_notes/v1.90.0/v1-90-0). It backports three fixes onto the 1.90.x line: Vertex AI batch-file uploads switch to a single media upload so large uploads no longer fail with 499 errors, OpenAI→Vertex batch JSONL uploads stream instead of buffering in memory, and the API key is redacted from `/key/info` client error messages. The bundled `litellm-enterprise` package is bumped to `0.1.43.post1`.

### What's Changed

- fix(vertex_ai/files): single media upload for batch files to fix 499s on large uploads - [PR #31653](https://github.com/BerriAI/litellm/pull/31653)
- fix(vertex/files): stream OpenAI->Vertex batch JSONL uploads - [PR #31036](https://github.com/BerriAI/litellm/pull/31036)
- fix(proxy/client): redact api key from key/info client error messages - [PR #31342](https://github.com/BerriAI/litellm/pull/31342)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.0...v1.90.1
