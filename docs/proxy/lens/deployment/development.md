---
title: "Build from source"
description: "Build matching Lens images or run the services with hot reload."
slug: "/proxy/lens/deployment/development"
---

# Build from source

Use this page when developing Lens. For published images, use [Releases and images](./releases.md).

Build from the same source commit and `LITELLM_RELEASE_TAG` as your gateway:

```bash
export LITELLM_RELEASE_TAG='<gateway-release-identity>'
export LENS_WORKER_IMAGE='<your-registry>/litellm-lens-worker:<image-tag>'
docker build --build-arg LITELLM_RELEASE_TAG="$LITELLM_RELEASE_TAG" \
  -f deploy/lens/Dockerfile -t "$LENS_WORKER_IMAGE" .
docker push "$LENS_WORKER_IMAGE"
```

Use a registry your host can pull from. The image supports native amd64 and arm64. Development images use `ghcr.io/berriai/litellm-lens-worker-dev:sha-<full-commit>`; an image is available only after that commit's build and publication succeed.

## Local development

For hot reload, start LiteLLM, Lens, and the dashboard from the repository root:

```bash
make lens-dev
```

Set `LENS_DEV_PROXY_PORT` and `LENS_DEV_UI_PORT` to change the local ports. For containers, pass the same release identity to both builds. Unversioned or incompatible workers are refused before claiming work.
