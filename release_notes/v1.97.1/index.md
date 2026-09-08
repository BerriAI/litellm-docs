---
title: "v1.97.1 - Docker-Only Maintenance Release"
slug: "v1-97-1"
date: 2026-09-02T00:10:30
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

`v1.97.1` is distributed as container images. There is no PyPI package for this version, so `pip install litellm==1.97.1` will not resolve. If you install LiteLLM from PyPI, stay on `1.97.0`; everything in this release is either a container-image build fix or a dependency refresh that only reaches you through the image.

This release also does not move the `latest` tag. The current stable line is [`v1.99.0`](/release_notes/v1.99.0/v1-99-0).

:::

## Deploy this version

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.97.1
```

The `litellm`, `litellm-database` and `litellm-non_root` variants are all published at this tag on both GHCR and Docker Hub, each cosign-signed as usual.

## What's in it

`v1.97.1` is a maintenance patch on top of [`v1.97.0`](/release_notes/v1.97.0/v1-97-0). It carries no product changes: one fix that makes the images build again, and a refresh of five third-party dependencies.

### Image builds

Every image built from `stable/1.97.x` had started failing. The Dockerfiles pin their base image by digest, but `apk add python3` resolves against Wolfi's live package repository at build time, so the digest pin never held the Python version, and Wolfi had moved `python3` on to 3.14. `uvloop` 0.21.0 has no 3.14 wheel, so `uv sync` fell back to building it from source and the build died there. The `migrations` image failed one step earlier and for a different reason: its pinned base ships glibc 2.43, while Wolfi's current `python-3.13` needs 2.44.

All six Dockerfiles now pin `python-3.13` explicitly, pass `--python python3.13` to each `uv sync`, and set `UV_PYTHON_DOWNLOADS=0` so a missing interpreter fails loudly rather than silently pulling one down. The `migrations` image moves to the glibc 2.44 base. This is the same pair of failures that took down the 1.99.0 pipeline, fixed there first and cherry-picked back here.

### Dependency refresh

On the Python side, `RestrictedPython` moves to 8.5, `sqlparse` to 0.6.0 and `pypdf` to 6.15.0, each the smallest step that keeps the release current. The `RestrictedPython` update also raises the `proxy` extra's floor to `>=8.5,<9.0`, matching the range used on the development branch. That floor only matters if you build your own package from this branch, since there is no PyPI artifact for 1.97.1.

In the Admin UI's lockfile, `nanoid` moves to 3.3.18 and `browserslist` to 4.28.8. Neither is a direct dependency, so nothing in the dashboard's declared dependencies changes; `browserslist` brings its own build-data packages along with it. The dashboard bundle in this image was rebuilt against the new lockfile.

The `build_from_pip` Docker image pins `pypdf` outside the main lock and had been left behind at 6.7.5. It now installs 6.15.0, the same release the lock resolves. That image is a build variant and is not the published proxy image.

Two `pypdf` entries in `osv-scanner.toml` carry an `ignoreUntil` date that has already passed, so they no longer suppress anything. They are removed.

### What's Changed

- chore(deps): refresh stale dependency pins and cut 1.97.1 - [PR #39200](https://github.com/BerriAI/litellm/pull/39200)
- fix(docker): pin apk python to 3.13 and bump wolfi-base on stable/1.97.x - [PR #39212](https://github.com/BerriAI/litellm/pull/39212)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.97.0...474d7e50f09de2cbfe1c141ac29aca5246e0c0d7
