---
title: "v1.103.4 - Dependency Updates and pgbouncer 1.26.0"
slug: "v1-103-4"
date: 2026-10-07T19:31:38
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
docker.litellm.ai/berriai/litellm:1.103.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.103.4` is a patch release on top of [`v1.103.3`](/release_notes/v1.103.3/v1-103-3). It updates locked Python and Admin UI dependencies and the pgbouncer bundled in the Docker images. There are no new database migrations or breaking changes. The `v1.103.4` tag points at [`65e36b0`](https://github.com/BerriAI/litellm/commit/65e36b02981d6ec9335ec45be225f8ad2f0dacb2)

## pgbouncer 1.26.0

The Docker images build pgbouncer from source. Wolfi's `openssl-dev` package now installs OpenSSL 4.0, which pgbouncer 1.25.2 does not compile against, so image builds on this line stopped working. The bundled pgbouncer is now 1.26.0, the same version `main` ships, and it builds and runs against OpenSSL 4.0

## Dependency updates

- Python: `fsspec` 2026.4.0 to 2026.6.0, `langgraph-sdk` 0.4.2 to 0.4.4, `mako` 1.3.12 to 1.4.2, `multidict` 6.7.1 to 6.9.1, `oauthlib` 3.3.1 to 4.0.0 and `werkzeug` 3.1.8 to 3.1.9
- Admin UI: `next` 16.3.3 to 16.3.6, `moment` 2.30.1 to 2.31.0 and `brace-expansion` 5.0.9 to 5.0.12, plus the transitive lockfile updates that come with them

### What's Changed

- Refresh locked Python and Admin UI dependencies - [PR #44776](https://github.com/BerriAI/litellm/pull/44776)
- Bump the bundled pgbouncer to 1.26.0 - [PR #45011](https://github.com/BerriAI/litellm/pull/45011)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.3...v1.103.4
