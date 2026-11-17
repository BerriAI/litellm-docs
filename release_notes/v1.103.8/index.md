---
title: "LiteLLM v1.106.3, v1.105.4 and v1.103.8 change the image-signing key and drop the eMudhra root CA"
description: "Images and Helm charts are signed with a new cosign key, every certificate bundle drops the eMudhra root CA, and the otel callback works with OpenTelemetry 1.44."
slug: "v1-103-8"
date: 2026-10-24T08:11:40
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
docker.litellm.ai/berriai/litellm:1.103.8
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.8
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.8`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.8) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.103.8` is a patch release on top of [`v1.103.7`](/release_notes/v1.103.7/v1-103-7). It moves image signing to a new cosign key, removes the eMudhra root CA from every certificate bundle and fixes the `otel` callback on `stable/1.103.x`. There are no new database migrations. The `v1.103.8` tag points at [`20d52b0`](https://github.com/BerriAI/litellm/commit/20d52b018b233b6440587578b48e2f9f9851c50d)

:::warning The image-signing key has changed

Starting with this release, every Docker image and Helm chart is signed with the cosign key from commit [`e82a3c6`](https://github.com/BerriAI/litellm/commit/e82a3c646908ba0a6ee0beddc4310d7a6cac4065). Verifying with the previous key from commit `0112e53` fails. Update anything that pins the old `cosign.pub`, such as `cosign verify` scripts, CI checks and admission policies.

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
  ghcr.io/berriai/litellm:v1.103.8
```

:::

### What's Changed

- Every certificate bundle the SDK, proxy and Docker images trust no longer includes the eMudhra root CA - [PR #47670](https://github.com/BerriAI/litellm/pull/47670), [PR #47969](https://github.com/BerriAI/litellm/pull/47969)
- Docker images and Helm charts are signed with the cosign key from commit `e82a3c6`. The previous key from commit `0112e53` no longer verifies them - [PR #48103](https://github.com/BerriAI/litellm/pull/48103)
- The `otel` callback initializes with OpenTelemetry 1.44 and newer instead of failing - [PR #42431](https://github.com/BerriAI/litellm/pull/42431)

These changes and the version bump are backported in [PR #48075](https://github.com/BerriAI/litellm/pull/48075)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.7...v1.103.8
