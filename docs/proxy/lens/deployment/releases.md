---
title: "Releases and images"
description: "Understand paired Lens and LiteLLM releases, standalone deployment, and source builds."
slug: "/proxy/lens/deployment/releases"
---

# Releases and images

Lens can run on its own. For the manual setup guides, use the [source quickstart](./local.md) or build the [source Helm chart](./kubernetes.md#new-deployment).

As of October 9, 2026, the Lens repository has no published GitHub release. The latest LiteLLM prerelease, `v1.106.0-dev.3`, was published before the independent Lens integration merged in [PR #45529](https://github.com/BerriAI/litellm/pull/45529). Do not use that version for the gateway connection steps. Those steps need a build that includes the integration. Standalone Lens remains usable while you prepare the gateway build.

The release pipeline builds official paired Lens and LiteLLM artifacts with the same version and tests them together. This does not mean those artifacts have already been published. Check the [Lens releases](https://github.com/BerriAI/lens/releases) and [LiteLLM releases](https://github.com/BerriAI/litellm/releases) before selecting a release.

The Lens UI inside LiteLLM is part of the gateway build. Updating a separate Lens backend does not replace that embedded UI. An existing external Lens deployment also does not upgrade when you upgrade LiteLLM; deploy it through its own release process.

## Container images {#container-images}

For a source build, clone [BerriAI/lens](https://github.com/BerriAI/lens), record the selected commit and use [Build from source](./development.md#try-backend-changes). The current runtime Dockerfile is `deploy/runtime/Dockerfile`. Supply a development version with `LENS_VERSION`. Official paired builds use LiteLLM’s computed release version, including its dev or RC suffix

Before using a published artifact, check [Lens releases](https://github.com/BerriAI/lens/releases) for the exact image digest and signed release manifest. Verify the manifest, source identity and artifact checksums using that release's instructions. Pin the selected digest in your deployment and retain the prior image for rollback

Existing installations may retain deployment or registry names containing `litellm-lens-worker`. A retained name does not establish compatibility with the independent runtime. Check the selected source and release metadata

## Helm charts {#helm-charts}

The independent chart lives in [the Lens repository](https://github.com/BerriAI/lens/tree/main/helm/lens). A published release uses `oci://ghcr.io/berriai/charts/lens` with an exact chart version and verified image digest. Until that release exists, follow the [source chart installation](./kubernetes.md#new-deployment) with an image you built and published to your own accessible registry

For gateway embedding, keep the existing LiteLLM chart family and choose a version that contains the compatible adapter and shared Lens chart. Paired releases pin the Lens image digest and chart built for that release version. Inspect the chart's actual values and release qualification before adopting it

## Source charts {#source-charts}

A source chart's default image tag is a development value and may not exist in a registry. Supply `image.repository` and `image.tag`, or `image.digest`, using the artifact you built. The [Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md) owns the complete source-build and installation commands

For an existing Lens deployment, an image or chart replacement also requires the [upgrade and migration checks](./upgrades.md). Keep storage, secrets, access scope and release ownership intact
