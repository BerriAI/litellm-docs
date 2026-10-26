---
title: "LiteLLM v1.103.6 fixes realtime handshake errors and double spend logs"
description: "Realtime clients get an error event when the upstream refuses the handshake, and large requests on the chat to Responses bridge log spend once."
slug: "v1-103-6"
date: 2026-10-20T17:26:16
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
docker.litellm.ai/berriai/litellm:1.103.6
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.6
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.6`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.6) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.103.6` is a patch release on top of [`v1.103.5`](/release_notes/v1.103.5/v1-103-5). It backports two fixes from `main` onto `stable/1.103.x`, so upgrading from `stable/1.102.x` keeps them. There are no new database migrations. The `v1.103.6` tag points at [`dce7feb`](https://github.com/BerriAI/litellm/commit/dce7feb75cf6a8d642a3c6195e5d4159c0269566)

### What's Changed

- When the upstream realtime API refuses the websocket handshake, for example with a 401 from Azure, the client now gets an `error` event that names the upstream HTTP status. The socket then closes with 1008 for 401 and 403, 1013 for 429 and 1011 for anything else. Before, the client saw a bare 1006 or 1011 close with no event, and the Azure relay could leave the client socket open - [PR #42388](https://github.com/BerriAI/litellm/pull/42388)
- Non-streaming requests of 256 KiB or more on the chat to Responses bridge log their spend once instead of twice, so key, team and daily spend are no longer counted twice for one request - [PR #44508](https://github.com/BerriAI/litellm/pull/44508)

Both fixes and the version bump are backported in [PR #47522](https://github.com/BerriAI/litellm/pull/47522)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.5...v1.103.6
