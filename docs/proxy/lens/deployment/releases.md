---
title: "Releases and images"
description: "Select matching LiteLLM and Lens artifacts and find the Lens image digest."
slug: "/proxy/lens/deployment/releases"
---

# Releases and images

Use LiteLLM and Lens from the same release. A LiteLLM release number alone does not confirm that its Lens image and chart have been published. Check the artifacts below before installing.

## Helm charts {#helm-charts}

Select a version from [LiteLLM releases](https://github.com/BerriAI/litellm/releases). Replace `RELEASE_VERSION` with the version without its leading `v`, then download the published chart values:

```bash
export CHART_VERSION="RELEASE_VERSION"
helm show values oci://ghcr.io/berriai/litellm/chart/litellm \
  --version "$CHART_VERSION" > release-values.yaml
```

For the single-container chart, use `oci://ghcr.io/berriai/litellm-helm` instead.

Open `release-values.yaml` and find `lensWorker`. The setup guides require `lensWorker.clickhouse.enabled` and a nonempty `lensWorker.image.digest`. The digest begins with `sha256:`. A chart missing these values cannot provide the bundled setup described in these guides.

Use this same chart reference and version in your install command. Its published values supply the matching Lens image; you do not need to enter a digest in your own values file.

## Container images {#container-images}

Docker's `buildx imagetools inspect` reads registry metadata without downloading image layers. Set `RELEASE_VERSION` to the release you selected, without its leading `v`:

```bash
export LITELLM_VERSION="RELEASE_VERSION"
docker buildx imagetools inspect "ghcr.io/berriai/litellm:${LITELLM_VERSION}"
docker buildx imagetools inspect "ghcr.io/berriai/litellm-lens-worker:v${LITELLM_VERSION}"
```

Both commands must succeed. If an image is missing, use a release with both published images before continuing. The [local](./local.md) and [server](./server.md) Compose setups select these two tags from `LITELLM_VERSION`.

For an existing container deployment, take the top-level `Digest:` from the Lens command's output. This is the multi-platform image digest, not an individual architecture's digest listed under `Manifests`. Put it after `@` in the Lens image reference:

```dotenv
LENS_WORKER_IMAGE=ghcr.io/berriai/litellm-lens-worker@sha256:RELEASE_DIGEST
```

Replace `sha256:RELEASE_DIGEST` with the complete digest from that output. Keep LiteLLM on the corresponding release too. For image signatures, see [Docker image verification](../../docker_image_security.md).

## Source charts {#source-charts}

Source charts can contain development image defaults. From the matching LiteLLM release checkout, set every component to the published release and supply the Lens digest. Replace `vRELEASE_VERSION` with the matching image tag and `sha256:RELEASE_DIGEST` with the Lens digest:

```yaml
gateway:
  image:
    tag: vRELEASE_VERSION
backend:
  image:
    tag: vRELEASE_VERSION
ui:
  image:
    tag: vRELEASE_VERSION
migrationJob:
  image:
    tag: vRELEASE_VERSION
lensWorker:
  enabled: true
  image:
    digest: sha256:RELEASE_DIGEST
```

Then build the chart dependencies before deploying:

```bash
helm dependency build ./helm/litellm
helm upgrade --install litellm ./helm/litellm \
  --namespace litellm -f values.yaml --wait
```

For the single-container chart, use `./helm/litellm-helm` and set `image.tag` to the LiteLLM image tag instead of the four component tags. For custom image builds and hot reload, see [Build from source](./development.md).
