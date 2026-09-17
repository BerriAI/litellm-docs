---
title: "v1.100.1 - Retry Breadcrumb Memory Fix"
slug: "v1-100-1"
date: 2026-09-10T01:42:29
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
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.100.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.1
```

</TabItem>
</Tabs>

`v1.100.1` is a patch release on top of [`v1.100.0`](/release_notes/v1.100.0/v1-100-0). It carries one fix: the router's retry breadcrumbs no longer retain earlier requests, which stops a memory leak that could take down a proxy under retry-heavy load. Both the Docker image and the PyPI package were built from [`1dba17b`](https://github.com/BerriAI/litellm/commit/1dba17b10ded12ad0021edb453ba2c54e4637928).

If you run `v1.100.0` behind any deployment that fails often enough to trigger retries or fallbacks, upgrade. There are no configuration changes and nothing else in the release.

## Retry breadcrumbs no longer leak memory

Whenever a call fails and the router retries or falls back, it records a breadcrumb describing the failed attempt under `metadata.previous_models`, the same way Sentry breadcrumbs work. Under `v1.100.0` two things went wrong with that record. The breadcrumb list lived on the `Router` instance rather than on the request, so every request that retried appended to one shared list and saw the breadcrumbs of unrelated earlier requests. And each breadcrumb copied the proxy's snapshot of the inbound request, whose body aliases the live request metadata, earlier breadcrumbs included, so every new breadcrumb nested all of the ones before it. Under sustained retries the structure grew geometrically, the event loop spent its time copying and stringifying it, `/health/liveliness` slowed from milliseconds to hundreds of milliseconds, and the pod was eventually OOM-killed and restarted, at which point the cycle began again. A Redis or upstream deployment that keeps failing is enough to trigger it.

Breadcrumbs are now built per request and capped at the four most recent attempts, and the `proxy_server_request` snapshot is excluded from each one. Memory stays flat across retries, and the breadcrumbs a request logs describe only that request's own failed attempts. This is the same fix that ships in `v1.101.0`, backported to the stable line.

### What's Changed

- fix(router): keep retry breadcrumbs per request and out of the request snapshot - [PR #40455](https://github.com/BerriAI/litellm/pull/40455) (backport of [PR #39491](https://github.com/BerriAI/litellm/pull/39491))

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.0...1dba17b10ded12ad0021edb453ba2c54e4637928
