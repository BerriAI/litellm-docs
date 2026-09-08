---
title: "v1.92.1 - Docker Migration Assets, Model Armor Attachments & Anthropic Passthrough"
slug: "v1-92-1"
date: 2026-07-19T03:07:45
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

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.92.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.92.1
```

</TabItem>
</Tabs>

`v1.92.1` is a patch release on top of [`v1.92.0`](/release_notes/v1.92.0/v1-92-0). It backports two Docker fixes onto the 1.92.x line: the runtime images regain the `/app/litellm-proxy-extras` source directory, so downstream jobs that point `prisma migrate deploy` at that path apply migrations again instead of exiting 0 with no schema applied; and the prisma CLI and engines are baked at `/opt/prisma`, a fixed path readable by any runtime uid, so fresh-database migrations work under kubernetes `runAsUser`, `docker --user`, and other non-root deployments with no outbound network access.

Two provider fixes ride along. Model Armor no longer drops reference attachments; `skip_unscannable_attachments` restores them and the attachment count cap is removed. The Anthropic passthrough now drops an incompatible `temperature` when it downgrades adaptive thinking for pre-4.6 models, instead of forwarding a combination the upstream API rejects. The release also carries routine dependency maintenance updates to mcp and soupsieve in the image lockfile.

### What's Changed

- fix(docker): restore litellm-proxy-extras source dir in runtime images - [PR #33592](https://github.com/BerriAI/litellm/pull/33592)
- fix(docker): bake prisma CLI and engines at a fixed path so fresh-DB migrations work for any uid offline - [PR #33853](https://github.com/BerriAI/litellm/pull/33853)
- fix(model_armor): restore reference attachments via skip_unscannable_attachments and remove the attachment count cap - [PR #33554](https://github.com/BerriAI/litellm/pull/33554)
- fix(anthropic/passthrough): drop incompatible temperature when downgrading adaptive thinking for pre-4.6 models - [PR #33244](https://github.com/BerriAI/litellm/pull/33244)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.92.0...v1.92.1
