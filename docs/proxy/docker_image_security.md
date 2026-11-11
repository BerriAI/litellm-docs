---
description: LiteLLM signs the Docker images it publishes to GHCR with cosign, starting with v1.83.0. How to verify signatures, enforce verification in CI/CD, and follow recommended deployment patterns.
---

# Docker Image Security Guide

LiteLLM signs every Docker image it publishes to GHCR with [cosign](https://docs.sigstore.dev/quickstart/quickstart-cosign/) <SinceVersion v="1.83.0" />. Older images are not signed. This page covers how to verify signatures, enforce verification in CI/CD, and follow recommended deployment patterns.

## Signed images

Use `ghcr.io/berriai/litellm`, mirrored at `docker.litellm.ai/berriai/litellm`. Verify the exact release tag or digest you deploy.

The [current Dockerfile](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/Dockerfile) builds one shared image for proxy, gateway, backend, UI, migrations, metrics, and collector processes. Published tags can predate that consolidation. The [Helm guide](./deploy/helm.md) pins matching chart and image source; an internal source build needs your own signing process and cannot be verified with LiteLLM's upstream public key.

The current signing key was introduced in [commit `e82a3c6`](https://github.com/BerriAI/litellm/commit/e82a3c646908ba0a6ee0beddc4310d7a6cac4065) and the public key is checked into the repository at [`cosign.pub`](https://github.com/BerriAI/litellm/blob/main/cosign.pub). Its SHA-256 fingerprint is `e3fe3e08c44b16407fe0b37c43b4f8b603b3a0f4ee74c29e647bc022d762c2c0`. It signs images from `v1.103.8`, `v1.104.6`, `v1.105.4`, `v1.106.3` and every later release.

:::warning[Previous signing key]
Earlier images are signed with the previous key from [commit `0112e53`](https://github.com/BerriAI/litellm/commit/0112e53046018d726492c814b3644b7d376029d0). That key was rotated on October 23, 2026, after the [October 21, 2026 incident](/blog/security-incident-oct-21-2026#image-signing-key-rotation). Trust a signature from it only on an image published before the `v1.107.0` release on October 21, 2026.
:::

## Verify image signatures

Install cosign following the [official instructions](https://docs.sigstore.dev/cosign/system_config/installation/).

### Verify with the pinned commit hash (recommended)

A commit hash is cryptographically immutable, making this the strongest verification method:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
  ghcr.io/berriai/litellm:v1.106.6
```

Replace the example tag with the release you deploy. Successful signature verification establishes who signed the image; check its release contents separately for the entrypoint and features your chart requires.

### Verify with a release tag (convenience)

Tags are protected in this repository and resolve to the same key:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/v1.106.6/cosign.pub \
  ghcr.io/berriai/litellm:v1.106.6
```

### Expected output

```
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
```

## Enforce verification in CI/CD

### Kubernetes: Sigstore Policy Controller

The [Sigstore Policy Controller](https://docs.sigstore.dev/policy-controller/overview/) rejects pods whose images fail cosign verification.

1. Install the controller:

```bash
helm repo add sigstore https://sigstore.github.io/helm-charts
helm install policy-controller sigstore/policy-controller \
  -n cosign-system --create-namespace
```

2. Create a `ClusterImagePolicy` with the LiteLLM public key:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: litellm-signed-images
spec:
  images:
    - glob: "ghcr.io/berriai/litellm*"
  authorities:
    - key:
        data: |
          -----BEGIN PUBLIC KEY-----
          MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEG06dpKM+vEDnmp2zcjyXgVCXxzRg
          JA5H2LnmwBKQafZGka6OOrWujCEWATQewiAgyD4WQdJ0pvU9RC4mvNAjvQ==
          -----END PUBLIC KEY-----
```

3. Label the namespace to enable enforcement:

```bash
kubectl label namespace litellm policy.sigstore.dev/include=true
```

Any pod in that namespace using an unsigned `ghcr.io/berriai/litellm*` image will be rejected at admission.

### GCP: Binary Authorization

[Binary Authorization](https://cloud.google.com/binary-authorization/docs) can enforce cosign signatures on Cloud Run and GKE.

1. Create a cosign-based attestor using the LiteLLM public key:

```bash
# Import the public key into a Cloud KMS keyring or use a PGP/PKIX attestor.
# See: https://cloud.google.com/binary-authorization/docs/creating-attestors-console
```

2. Configure a Binary Authorization policy that requires the attestor for `ghcr.io/berriai/litellm*` images.

3. Enable the policy on your Cloud Run service or GKE cluster.

Refer to the [GCP Binary Authorization docs](https://cloud.google.com/binary-authorization/docs/setting-up) for full setup steps.

### AWS: ECS / ECR

AWS does not natively verify cosign signatures at deploy time. Common approaches:

- **CI/CD gate**: Run `cosign verify` in your deployment pipeline before pushing to ECR or updating the ECS task definition. Fail the pipeline if verification fails.
- **OPA/Gatekeeper on EKS**: If running on EKS, use the Sigstore Policy Controller (same as the Kubernetes approach above).

### GitHub Actions gate

Add a verification step before any deployment job:

```yaml
- name: Verify LiteLLM image signature
  run: |
    cosign verify \
      --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
      ghcr.io/berriai/litellm:${{ env.LITELLM_VERSION }}
```

## Recommended deployment patterns

### Pin by digest

Digest pinning guarantees the exact image content regardless of tag mutations:

```yaml
image: ghcr.io/berriai/litellm@sha256:<digest>
```

Get the digest after pulling:

```bash
docker inspect --format='{{index .RepoDigests 0}}' \
  ghcr.io/berriai/litellm:v1.106.6
```

Cosign verification works with digests too:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
  'ghcr.io/berriai/litellm@sha256:<digest>'
```

### Use stable release tags

If digest pinning is too rigid for your workflow, use plain semver / PEP 440 release tags (e.g. `v1.86.2`). These are immutable release tags that will not be overwritten.

:::warning[`main-stable` and `main-latest` are deprecated]

LiteLLM has moved to PEP 440 / semver versioning, so stable releases are now published as plain `vX.Y.Z` tags (e.g. `v1.86.2`) instead of the older `vX.Y.Z-stable` form. The rolling `main-stable` tag is still being updated for backwards compatibility but is deprecated; pin to a specific `vX.Y.Z` tag (or a digest) instead. The rolling `main-latest` tag is deprecated and is no longer being updated; use `latest` instead.
:::

Avoid `latest` in production. This rolling tag points to the most recent build and can change between deployments.

### Safe upgrade checklist

1. **Verify the new image.** Run `cosign verify` against the new release tag or digest.
2. **Test in staging.** Deploy the verified image with the chart and values you intend to use.
3. **Update your pinned reference.** Change the digest or tag in your deployment manifest.
4. **Deploy to production.** Roll out using your standard deployment process.
5. **Check readiness.** Confirm the proxy is healthy after the upgrade.

### Runtime user and entrypoint

The [consolidated source image](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/Dockerfile#L212) runs as UID/GID `65532:65532`. Its entrypoint accepts `proxy`, `gateway`, `backend`, `ui`, `migrations`, `metrics`, or `collector` as the first argument. No argument, or a CLI flag such as `--config`, starts the full proxy. Keep this entrypoint intact; Kubernetes selects a component through `args`.

Check the exact image you use before relying on that non-root default. Older published images use a different entrypoint and can run as root:

```bash
docker image inspect "$LITELLM_IMAGE" \
  --format '{{.Config.User}} {{json .Config.Entrypoint}}'
```

Restrict mounted credentials to the runtime user. A read-only root filesystem requires explicit writable scratch volumes; the consolidated chart does not add them automatically. Configure security contexts and mounts for each enabled workload, including the migration Job. See the [chart values](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml).

## Further reading

- [CI/CD v2 announcement](https://docs.litellm.ai/blog/ci-cd-v2-improvements) explains LiteLLM's signing infrastructure.
- [Deployment overview](./deploy.md) covers Docker, Helm, and Terraform.
- [cosign documentation](https://docs.sigstore.dev/quickstart/quickstart-cosign/) covers signature verification and key management.
- [Sigstore Policy Controller](https://docs.sigstore.dev/policy-controller/overview/) covers Kubernetes admission control.
