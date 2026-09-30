---
title: "v1.101.3 - UI and CLI Session Token Format"
slug: "v1-101-3"
date: 2026-09-30T00:58:00
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
docker.litellm.ai/berriai/litellm:1.101.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::danger Breaking Changes

**Session tokens issued before the upgrade stop working.** Admin UI and `lite` CLI users sign in once more after upgrading. During a rolling upgrade, pods on the old and new versions reject each other's session tokens, so finish the rollout before asking users to sign in again. Virtual keys, the master key and stored credentials are unaffected. See [`9161d7f`](https://github.com/BerriAI/litellm/commit/9161d7f9d6073603ba61ee4aa5e2c0ef5b37a81b)

:::

`v1.101.3` is a patch release on top of [`v1.101.2`](https://github.com/BerriAI/litellm/releases/tag/v1.101.2). It carries one change: the session tokens the Admin UI and the `lite` CLI receive after sign-in now use their own encryption context and a header-safe format. Both the Docker image and the PyPI package were built from [`1b6ee73`](https://github.com/BerriAI/litellm/commit/1b6ee737c96c346430b04f36827fbe64935328df)

## UI and CLI session tokens get their own format

Session tokens were encrypted with the same routine the proxy uses for stored credentials, so they carried a `v2:gcm:` prefix and base64 padding. Basic auth parsers split on the first `:` and browsers reject `:` and `=` in WebSocket subprotocols, so Langfuse pass-through and the realtime playground could not use them. About one login in 262,144 also produced a token starting with `sk-`, which the proxy then treated as a virtual key and rejected with a 401

Session tokens are now AES-256-GCM encrypted under a context of their own and returned as `litellm_login_` followed by unpadded base64url. They pass through any header, are easy to spot in logs, and are checked only as session tokens. Stored credentials keep their current encryption, so there is nothing to migrate

### What's Changed

- refactor(auth): bind UI/CLI session tokens to their own AES-GCM context - [`9161d7f`](https://github.com/BerriAI/litellm/commit/9161d7f9d6073603ba61ee4aa5e2c0ef5b37a81b)
- chore(lint): scope a TRY004 suppression to the bearer-token salt key check - [`9335067`](https://github.com/BerriAI/litellm/commit/9335067229f6606cca91141fe280cad696366a73)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.2...v1.101.3
