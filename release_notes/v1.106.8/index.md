---
title: "LiteLLM v1.106.8 fixes transcription cost for some FLAC files"
description: "Transcription cost is correct for FLAC files without a sample count, and per-second transcriptions bill the usage.seconds that the provider reports."
slug: "v1-106-8"
date: 2026-11-11T03:23:36
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
docker.litellm.ai/berriai/litellm:1.106.8
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.8
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.8`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.8) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.106.8` is a patch release on top of [`v1.106.7`](/release_notes/v1.106.7/v1-106-7). There are no new database migrations. The `v1.106.8` tag points at [`3b9baf4`](https://github.com/BerriAI/litellm/commit/3b9baf435ebb668efacf0062f991cc00106f89a2).

### What's Changed

- **Cost tracking and pricing:** Fixed incorrect transcription cost for some FLAC files, which could push a key over its budget - [PR #50842](https://github.com/BerriAI/litellm/pull/50842)
- **Cost tracking and pricing:** Changed per-second transcriptions to bill the `usage.seconds` the provider reports instead of the measured length - [PR #50727](https://github.com/BerriAI/litellm/pull/50727)

The changes and the version bump are backported in [PR #50861](https://github.com/BerriAI/litellm/pull/50861).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.7...v1.106.8
