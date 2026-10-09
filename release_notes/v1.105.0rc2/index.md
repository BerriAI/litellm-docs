---
title: "1.105.0rc2 - Dependency refresh and pgbouncer 1.26.0"
slug: "v1-105-0-rc-2"
date: 2026-10-07T21:28:51
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
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.105.0-rc.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.0rc2
```

</TabItem>
</Tabs>

The published GitHub tag is `v1.105.0-rc.2`. These notes compare it with [`v1.105.0-rc.1`](https://github.com/BerriAI/litellm/releases/tag/v1.105.0-rc.1), the previous release candidate on `rc/1.105.0`. It only refreshes locked dependencies and fixes the Docker build, so there are no feature or API changes and no new database migrations. The `v1.105.0-rc.2` tag points at [`9d3d673`](https://github.com/BerriAI/litellm/commit/9d3d67399f26158e611378ba1baf7367959929e7)

## Performance / Loadbalancing / Reliability improvements

### Docker images

- Bump pgbouncer to 1.26.0 so the images build against OpenSSL 4. pgbouncer 1.25.2 no longer compiled, which failed the database, non-root and gateway images - [PR #45013](https://github.com/BerriAI/litellm/pull/45013)

### Dependency updates

- Refresh locked dependencies to the versions `main` already uses: langgraph-sdk 0.4.4, mako 1.4.2, multidict 6.9.1 and werkzeug 3.1.9 in `uv.lock`, plus source-map-js 1.2.2 and smol-toml 1.9.0 in the dashboard and VS Code extension lockfiles - [PR #44803](https://github.com/BerriAI/litellm/pull/44803)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.0-rc.1...v1.105.0-rc.2
