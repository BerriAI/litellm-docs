---
title: "v1.100.5 - Dependency Updates"
slug: "v1-100-5"
date: 2026-10-07T18:48:25
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
docker.litellm.ai/berriai/litellm:1.100.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.100.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.100.5) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.100.5` is a patch release on top of [`v1.100.4`](/release_notes/v1.100.4/v1-100-4). It updates locked Python and Admin UI dependencies and the wolfi-base image digest. There are no new database migrations or breaking changes. The `v1.100.5` tag points at [`c80ccaa`](https://github.com/BerriAI/litellm/commit/c80ccaa94b3c5ad7d89a46c1941e05576d0d3523)

## Dependency updates

- Python: `fsspec` 2026.4.0 to 2026.6.0, `gitpython` 3.1.60 to 3.1.62, `langgraph-sdk` 0.4.2 to 0.4.4, `mako` 1.3.12 to 1.4.2, `multidict` 6.7.1 to 6.9.1, `oauthlib` 3.3.1 to 4.0.0, `pyjwt` 2.13.0 to 2.15.0, `pypdf` 6.16.1 to 6.19.0, `tornado` 6.5.8 to 6.5.9, `urllib3` 2.7.0 to 2.8.0 and `werkzeug` 3.1.8 to 3.1.9
- Admin UI: `next` 16.2.11 to 16.3.6, `moment` 2.30.1 to 2.31.0, `brace-expansion` 5.0.9 to 5.0.12, `js-yaml` 4.3.1 to 4.3.2 and `sharp` 0.35.0 to 0.35.4, plus the transitive lockfile updates that come with them
- Base image: the wolfi-base digest moves forward to pick up glibc 2.44-r6

The Admin UI test tooling moves to Vitest 4, and a few Admin UI and Python tests are updated to match. None of this changes runtime code

### What's Changed

- Refresh locked Python and Admin UI dependencies, and move the Admin UI tests to Vitest 4 - [PR #44774](https://github.com/BerriAI/litellm/pull/44774)
- Bump wolfi-base digest to pick up glibc 2.44-r6 - [PR #42643](https://github.com/BerriAI/litellm/pull/42643)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.4...v1.100.5
