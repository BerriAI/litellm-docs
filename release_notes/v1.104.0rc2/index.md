---
title: "1.104.0rc2 - UI and CLI Session Token Format"
slug: "v1-104-0-rc-2"
date: 2026-09-30T00:59:30
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
docker.litellm.ai/berriai/litellm:1.104.0-rc.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.0rc2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.104.0-rc.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.104.0-rc.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::danger Breaking Changes

**Session tokens issued before the upgrade stop working.** Admin UI and `lite` CLI users sign in once more after upgrading. During a rolling upgrade, pods on the old and new versions reject each other's session tokens, so finish the rollout before asking users to sign in again. Virtual keys, the master key and stored credentials are unaffected. See [`9fa1a64`](https://github.com/BerriAI/litellm/commit/9fa1a641119dd0d4fe43e93622eae5f482ceb63f)

:::

`1.104.0rc2` is the current release candidate for 1.104.0. The published GitHub tag is `v1.104.0-rc.2`. It is a patch on top of [`v1.104.0-rc.1`](https://github.com/BerriAI/litellm/releases/tag/v1.104.0-rc.1) with one change: the session tokens the Admin UI and the `lite` CLI receive after sign-in now use their own encryption context and a header-safe format. Both the Docker image and the PyPI package were built from [`e926084`](https://github.com/BerriAI/litellm/commit/e926084212ab2eb234c58840d741b3c62c35911b)

## UI and CLI session tokens get their own format

Session tokens were encrypted with the same routine the proxy uses for stored credentials, so they carried a `v2:gcm:` prefix and base64 padding. Basic auth parsers split on the first `:` and browsers reject `:` and `=` in WebSocket subprotocols, so Langfuse pass-through and the realtime playground could not use them. About one login in 262,144 also produced a token starting with `sk-`, which the proxy then treated as a virtual key and rejected with a 401

Session tokens are now AES-256-GCM encrypted under a context of their own and returned as `litellm_login_` followed by unpadded base64url. They pass through any header, are easy to spot in logs, and are checked only as session tokens. Stored credentials keep their current encryption, so there is nothing to migrate

### What's Changed

- refactor(auth): bind UI/CLI session tokens to their own AES-GCM context - [`9fa1a64`](https://github.com/BerriAI/litellm/commit/9fa1a641119dd0d4fe43e93622eae5f482ceb63f)
- chore(lint): scope a TRY004 suppression to the bearer-token salt key check - [`975f9be`](https://github.com/BerriAI/litellm/commit/975f9beb950fe0b9068c4cf32c5a1c3313da50de)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.0-rc.1...v1.104.0-rc.2
