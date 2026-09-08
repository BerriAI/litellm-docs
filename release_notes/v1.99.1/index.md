---
title: "v1.99.1 - OTel Cache Token Counts"
slug: "v1-99-1"
date: 2026-09-02T14:01:25
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

:::info This is a Docker-only release

`v1.99.1` is distributed as container images. There is no PyPI package for this version, so `pip install litellm==1.99.1` will not resolve. If you install LiteLLM from PyPI, stay on `1.99.0`; the change in this release reaches you through the image.

The `latest` tag does point at this release.

:::

## Deploy this version

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.99.1
```

`v1.99.1` is a patch release on top of [`v1.99.0`](/release_notes/v1.99.0/v1-99-0). It adds cache token counts to OpenTelemetry v2 LLM spans.

If you export OTel v2 traces to a tool that prices requests from token counts, this release is worth picking up. Under `v1.99.0` an LLM span carried the cache cost attributes but no cache token counts, so anything computing cache spend from tokens recorded zero even when the provider had billed for a cache write or a cache read. The span now carries `gen_ai.usage.cache_creation.input_tokens` and `gen_ai.usage.cache_read.input_tokens` alongside the existing input and output token counts, matching what the API response reports in `usage`.

The counts are read from the provider's own usage object, so they are populated today for Anthropic-shaped usage, which is where prompt caching reports a separate creation and read count. Providers that report a cached-token count in a different shape are not yet covered, and generalizing that is follow-up work.

This release also refreshes RestrictedPython to 8.5 in the lockfile, matching the version the development line already resolves. That only affects the image, since there is no PyPI artifact for this version. No configuration changes.

### What's Changed

- fix(otel): emit cache token counts on OTel v2 LLM spans - [PR #38716](https://github.com/BerriAI/litellm/pull/38716)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.99.0...v1.99.1
