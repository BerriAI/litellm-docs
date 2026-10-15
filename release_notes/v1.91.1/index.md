---
title: "v1.91.1 - DB Model Config Consistency & OTel Error Spans"
slug: "v1-91-1"
date: 2026-07-08T23:01:36
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
docker.litellm.ai/berriai/litellm:1.91.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.91.1
```

</TabItem>
</Tabs>

`v1.91.1` is a patch release on top of [`v1.91.0`](/release_notes/v1.91.0/v1-91-0). It backports three fixes onto the 1.91.x line. Two improve configuration handling for models stored in the database so it stays consistent with models defined in the YAML config. The third restores the full `error.*` attribute set on OpenTelemetry v2 error spans, so observability backends once again see the complete error shape rather than only the error type.

### What's Changed

- fix(proxy): improve configuration handling for database-stored models - [PR #32256](https://github.com/BerriAI/litellm/pull/32256), [PR #32405](https://github.com/BerriAI/litellm/pull/32405)
- fix(otel): restore error.* span attributes on v2 error spans - [PR #32524](https://github.com/BerriAI/litellm/pull/32524)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.91.0...v1.91.1
