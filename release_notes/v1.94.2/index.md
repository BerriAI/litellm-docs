---
title: "v1.94.2 - Dashboard Token Storage and Dependency Refresh"
slug: "v1-94-2"
date: 2026-08-07T19:10:07
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
docker.litellm.ai/berriai/litellm:1.94.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.94.2
```

</TabItem>
</Tabs>

`v1.94.2` is a patch release on top of [`v1.94.1`](/release_notes/v1.94.1/v1-94-1). It routes the Admin UI's MCP session-token store through the shared browser storage helper, refreshes the Terraform provider's Go modules, and picks up maintenance updates for four third-party Python dependencies.

In the Admin UI, the MCP session-token store now reads and writes through the same shared storage helper the rest of the dashboard uses, rather than talking to `sessionStorage` directly. The store no longer keeps a refresh token alongside the access token, and its stored payload is no longer written as readable text. This is internal to the browser session and needs no configuration change; the dashboard bundle shipped in this release is rebuilt to include it.

The Terraform provider's `grpc` and `golang.org/x` modules move to current releases. This affects only builds of the provider itself and does not change the proxy image or the Python package.

On the dependency side, `aiohttp` moves to 3.14.3, `cryptography` to 50.0.0, `gitpython` to 3.1.58, and `h2` to 4.4.1, each the smallest step that keeps the release current. The `cryptography` update also widens the `proxy` extra's supported range to `>=49.0.0,<51.0`, matching the range used on the development branch. If you pin `cryptography` below 49 alongside `litellm[proxy]`, adjust that pin when you upgrade.

### What's Changed

- refactor(ui): route MCP session tokens through the shared storage helper - [PR #35835](https://github.com/BerriAI/litellm/pull/35835)
- chore(deps): bump grpc and golang.org/x modules in the terraform provider - [PR #35844](https://github.com/BerriAI/litellm/pull/35844)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.94.1...v1.94.2
