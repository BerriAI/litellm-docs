---
title: "v1.97.2 - Docker-Only Dependency Refresh"
slug: "v1-97-2"
date: 2026-09-03T18:54:20
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

`v1.97.2` is distributed as container images. There is no PyPI package for this version, so `pip install litellm==1.97.2` will not resolve. If you install LiteLLM from PyPI, stay on `1.97.0`; the only change in this release is a refresh of three locked third-party dependencies, which only reaches you through the image.

This release also does not move the `latest` tag. The current stable line is [`v1.99.1`](/release_notes/v1.99.1/v1-99-1).

:::

## Deploy this version

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.97.2
```

The `litellm`, `litellm-database` and `litellm-non_root` variants are all published at this tag on both GHCR and Docker Hub, each cosign-signed as usual.

## What's in it

`v1.97.2` is a maintenance patch on top of [`v1.97.1`](/release_notes/v1.97.1/v1-97-1). It carries no product changes and no Dockerfile changes: the diff is `uv.lock` plus the version string.

### Dependency refresh

Image scanners had started flagging two Python packages on the published `v1.97.1` image, each with a fix available in a newer patch of the same series. `tornado` moves from 6.5.7 to 6.5.8 and `pypdf` from 6.15.0 to 6.16.1. `gitpython` moves from 3.1.58 to 3.1.61 in the same pass; it is pulled in only through `mlflow-skinny` and does not reach the proxy image, so scanners never reported it, but the lock is now clean there too.

All three are lock-only bumps inside the ranges `pyproject.toml` already allowed, so nothing about the install contract changes and each package moved on its own commit with no other package drifting. `litellm_internal_staging` already resolves at or above all three versions, so upgrading from this patch to a later release does not walk any of them backwards.

### What's Changed

- chore(release): bump tornado and pypdf on stable/1.97.x and cut 1.97.2 - [PR #39580](https://github.com/BerriAI/litellm/pull/39580)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.97.1...0884a61e4d3ed8ae0f1849396a8a8425866f2d8f
