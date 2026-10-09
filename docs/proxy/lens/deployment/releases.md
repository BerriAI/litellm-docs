---
title: "Releases and images"
description: "Select Lens artifacts independently from LiteLLM and distinguish source builds from published releases."
slug: "/proxy/lens/deployment/releases"
---

# Releases and images

Lens and LiteLLM release independently. The current [Lens source installation](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md) requires access to the internal Lens repository while official standalone release artifacts are being qualified. Readers without repository access cannot use those source links yet. Do not infer that an image, chart or release bundle exists from a source version alone

A compatible gateway release consumes the shared Lens UI and connects through the supported public API contract. Updating the Lens runtime does not update the UI already embedded in a gateway build. The [current gateway source integration](https://github.com/BerriAI/litellm/blob/d171e208a18d3f3559e3a338f7769387e01749e5/docs/lens-integration.md) records this boundary and its development artifacts

## Container images {#container-images}

For a source build, clone [BerriAI/lens](https://github.com/BerriAI/lens), record the selected commit and use [Build from source](./development.md#try-backend-changes). The current runtime Dockerfile is `deploy/runtime/Dockerfile`. Supply a Lens version with `LENS_VERSION`; it does not need to equal the gateway version

Before using a published artifact, check [Lens releases](https://github.com/BerriAI/lens/releases) for the exact image digest and signed release manifest. Verify the manifest, source identity and artifact checksums using that release's instructions. Pin the selected digest in your deployment and retain the prior image for rollback

Existing installations may retain deployment or registry names containing `litellm-lens-worker`. A retained name does not establish compatibility with the independent runtime. Check the selected source and release metadata

## Helm charts {#helm-charts}

The independent chart lives in [the Lens repository](https://github.com/BerriAI/lens/tree/main/helm/lens). A published release uses `oci://ghcr.io/berriai/charts/lens` with an exact chart version and verified image digest. Until that release exists, follow the [source chart installation](./kubernetes.md#new-deployment) with an image you built and published to your own accessible registry

For gateway embedding, keep the existing LiteLLM chart family and choose a version that contains the compatible adapter and shared Lens chart. Its Lens version is selected separately. Inspect the chart's actual values and release qualification before adopting it

## Source charts {#source-charts}

A source chart's default image tag is a development value and may not exist in a registry. Supply `image.repository` and `image.tag`, or `image.digest`, using the artifact you built. The [Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md) owns the complete source-build and installation commands

For an existing Lens deployment, an image or chart replacement also requires the [upgrade and migration checks](./upgrades.md). Keep storage, secrets, access scope and release ownership intact
