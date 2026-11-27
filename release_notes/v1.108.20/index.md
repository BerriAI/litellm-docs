---
title: "LiteLLM v1.108.20 (LTS) fixes cancelled Responses billing and GET /audit"
description: "Cancelled OpenAI and Azure Responses streams bill the provider's usage, and the audit log no longer returns 500 after team or key updates."
slug: "v1-108-20"
date: 2026-11-27T21:36:11
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

:::tip

`v1.108.20` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

:::

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.108.20
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.20
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.20`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.20) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.20` is a patch release on top of [`v1.108.19`](/release_notes/v1.108.19/v1-108-19). There are no new database migrations. The `v1.108.20` tag points at [`5c65758`](https://github.com/BerriAI/litellm/commit/5c65758917e58473aefff2af03b897a510dec164).

### What's Changed

- **Anthropic:** Fixed a tool message with a non-string `tool_call_id` reaching Anthropic instead of getting a 400, broken since v1.108.19 - [PR #54736](https://github.com/BerriAI/litellm/pull/54736)
- **Responses API:** Fixed cancelled OpenAI and Azure `/v1/responses` streams billing nothing or an estimate instead of the provider's usage - [PR #54755](https://github.com/BerriAI/litellm/pull/54755) and [PR #54772](https://github.com/BerriAI/litellm/pull/54772)
- **Keys, teams and auth:** Fixed `GET /audit` returning 500 after team or key updates, including rows saved before upgrading - [PR #50929](https://github.com/BerriAI/litellm/pull/50929) and [PR #53305](https://github.com/BerriAI/litellm/pull/53305)

The audit log changes are backported in [PR #53262](https://github.com/BerriAI/litellm/pull/53262).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.19...v1.108.20
