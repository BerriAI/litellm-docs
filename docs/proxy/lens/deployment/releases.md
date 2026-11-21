---
title: "Releases and images"
description: "Install Lens v0.1.0 from its published Compose bundle, image or Helm chart."
slug: "/proxy/lens/deployment/releases"
---

# Releases and images

The current release is [Lens v0.1.0](https://github.com/BerriAI/lens/releases/tag/v0.1.0). All artifacts are public and require no registry credentials.

The [Compose bundle](https://github.com/BerriAI/lens/releases/download/v0.1.0/lens-install-0.1.0.tar.gz) starts Lens and ClickHouse without a build or a Git checkout. Follow [Docker Compose on a server](./server.md) to install it. To try Lens on your own machine, the [quickstart](./local.md) is shorter.

## Container images {#container-images}

Use `ghcr.io/berriai/lens:0.1.0`. The bundle and chart pin the image to `sha256:489a007c48043a5b6c7c6b5f9f646fd46ccb4dd371ea674df6496b326efbc270`.

## Helm charts {#helm-charts}

Use `oci://ghcr.io/berriai/charts/lens` with `--version 0.1.0`. Follow the [Kubernetes guide](./kubernetes.md#new-deployment).

To upgrade, change the bundle, image or chart version after the [backup and upgrade checks](./upgrades.md). Retain data and credentials. Lens and LiteLLM update independently. An embedded UI update requires a gateway update.

## Verify a release

Optionally download `manifest.txt` and `manifest.sigstore.json` from the release assets and verify with Cosign. The certificate identity below is Lens's release signing workflow.

```sh
cosign verify-blob --bundle manifest.sigstore.json \
  --certificate-identity 'https://github.com/BerriAI/lens-releaser/.github/workflows/release.yml@refs/heads/main' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' manifest.txt
```

Follow the release's instructions to check downloaded artifacts against the verified manifest's checksums and digests.

## Source charts {#source-charts}

For source builds, see [Development](./development.md). Customer installations do not need a source checkout.
