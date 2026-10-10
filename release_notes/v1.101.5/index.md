---
title: "v1.101.5 - Dependency Updates"
slug: "v1-101-5"
date: 2026-10-07T18:44:55
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
docker.litellm.ai/berriai/litellm:1.101.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.5) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.101.5` is a patch release on top of [`v1.101.4`](/release_notes/v1.101.4/v1-101-4). It updates locked Python and Admin UI dependencies and the wolfi-base image digest. There are no new database migrations or breaking changes. The `v1.101.5` tag points at [`abbf938`](https://github.com/BerriAI/litellm/commit/abbf9385b29cfc6928e93545de19a0bf36da8ac4)

## Dependency updates

- Python: `fsspec` 2026.4.0 to 2026.6.0, `gitpython` 3.1.61 to 3.1.62, `langgraph-sdk` 0.4.2 to 0.4.4, `mako` 1.3.12 to 1.4.2, `multidict` 6.7.1 to 6.9.1, `oauthlib` 3.3.1 to 4.0.0, `pyjwt` 2.14.0 to 2.15.0, `pypdf` 6.16.2 to 6.19.0, `tornado` 6.5.8 to 6.5.9, `urllib3` 2.7.0 to 2.8.0 and `werkzeug` 3.1.8 to 3.1.9
- Admin UI: `next` 16.3.3 to 16.3.6, `moment` 2.30.1 to 2.31.0 and `brace-expansion` 5.0.9 to 5.0.12, plus the transitive lockfile updates that come with them
- Base image: the wolfi-base digest moves forward to pick up glibc 2.44-r6

### What's Changed

- Refresh locked Python and Admin UI dependencies - [PR #44773](https://github.com/BerriAI/litellm/pull/44773)
- Bump wolfi-base digest to pick up glibc 2.44-r6 - [PR #44804](https://github.com/BerriAI/litellm/pull/44804)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.4...v1.101.5
