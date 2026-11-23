---
description: LiteLLM signs the Docker images it publishes to GHCR with cosign, starting with v1.83.0. How to verify signatures, enforce verification in CI/CD, and follow recommended deployment patterns.
---

# Docker Image Security Guide

LiteLLM signs every Docker image it publishes to GHCR with [cosign](https://docs.sigstore.dev/quickstart/quickstart-cosign/) <SinceVersion v="1.83.0" />. Older images are not signed. This page covers how to verify signatures, enforce verification in CI/CD, and follow recommended deployment patterns.

## Signed images

Use `ghcr.io/berriai/litellm`, mirrored at `docker.litellm.ai/berriai/litellm`. Verify the exact release tag or digest you deploy.

The [Dockerfile](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/Dockerfile) builds one image for the proxy, gateway, backend, UI, migrations, metrics, and collector. Older release tags can use a different Dockerfile. Follow the [Helm guide](./deploy/helm.md) to match your chart and image. Sign internal builds with your own key or identity. LiteLLM's signing identity only matches images that LiteLLM signs.

Every release published since `v1.111.0-dev.3` on November 15, 2026 is signed with keyless cosign, including patch releases on older lines such as `v1.108.10` and later. There is no stored signing key. Each release run gets a short-lived certificate from Sigstore that is bound to LiteLLM's release workflow, and the signature is recorded in the public Rekor transparency log. A valid signature has the certificate identity `https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main` and the OIDC issuer `https://token.actions.githubusercontent.com`. The Helm chart at `ghcr.io/berriai/litellm/chart/litellm` is signed the same way.

:::warning[Releases published before November 15, 2026]
Older releases keep the key signature they were published with, and `cosign verify --key` does not work on keyless releases. Releases published from October 24 to November 15, 2026 are signed with the key from [commit `e82a3c6`](https://github.com/BerriAI/litellm/commit/e82a3c646908ba0a6ee0beddc4310d7a6cac4065), whose `cosign.pub` has the SHA-256 fingerprint `e3fe3e08c44b16407fe0b37c43b4f8b603b3a0f4ee74c29e647bc022d762c2c0`. Earlier releases are signed with the previous key from [commit `0112e53`](https://github.com/BerriAI/litellm/commit/0112e53046018d726492c814b3644b7d376029d0). That key was rotated on October 23, 2026, after the [October 21, 2026 incident](/blog/security-incident-oct-21-2026#image-signing-key-rotation). Trust a signature from it only on an image published before the `v1.107.0` release on October 21, 2026. The [image signing announcement](https://github.com/BerriAI/litellm/discussions/48242) lists which releases carry which signature.
:::

## Verify image signatures

Install cosign following the [official instructions](https://docs.sigstore.dev/cosign/system_config/installation/).

### Keyless releases

```bash
cosign verify \
  --certificate-identity https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/berriai/litellm:v1.108.15
```

Replace the example tag with the release you deploy. Signature verification identifies who signed the image. Check that the release includes the entrypoint and features your chart requires. Pass the exact identity rather than a loose `--certificate-identity-regexp`, so a signature from any other workflow or branch fails.

The Helm chart is verified the same way. Its tags are the bare version, without the `v` prefix:

```bash
cosign verify \
  --certificate-identity https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/berriai/litellm/chart/litellm:1.108.15
```

### Key-signed releases

Use the key the release was signed with, pinned by commit hash. A commit hash is immutable, so the key cannot change under you. For releases published from October 24 to November 15, 2026:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub \
  ghcr.io/berriai/litellm:v1.108.9
```

For releases published before October 21, 2026, use the previous key at `https://raw.githubusercontent.com/BerriAI/litellm/0112e53046018d726492c814b3644b7d376029d0/cosign.pub` instead.

### Expected output

```
Verification for ghcr.io/berriai/litellm:v1.108.15 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The code-signing certificate was verified using trusted certificate authority certificates
```

A key-signed release prints `The signatures were verified against the specified public key` as its last check instead.

## Enforce verification in CI/CD

### Kubernetes: Sigstore Policy Controller

The [Sigstore Policy Controller](https://docs.sigstore.dev/policy-controller/overview/) rejects pods whose images fail cosign verification.

1. Install the controller:

```bash
helm repo add sigstore https://sigstore.github.io/helm-charts
helm install policy-controller sigstore/policy-controller \
  -n cosign-system --create-namespace
```

2. Create a `ClusterImagePolicy` that requires LiteLLM's release identity:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: litellm-signed-images
spec:
  images:
    - glob: "ghcr.io/berriai/litellm*"
  authorities:
    - keyless:
        identities:
          - issuer: https://token.actions.githubusercontent.com
            subject: https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main
```

If you still run releases published before November 15, 2026, add the key from commit `e82a3c6` as a second authority. An image passes the policy when any one of its authorities matches, so remove the key once every workload runs a keyless release:

```yaml
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

Any pod in that namespace using a `ghcr.io/berriai/litellm*` image without a matching signature is rejected at admission.

### GCP: Binary Authorization

[Binary Authorization](https://cloud.google.com/binary-authorization/docs) attestors and its [Sigstore signature check](https://cloud.google.com/binary-authorization/docs/cv-sigstore-check) verify signatures against a public key, so they cannot check LiteLLM's keyless signatures. On GKE, use the Sigstore Policy Controller above. On Cloud Run, run `cosign verify` in your deployment pipeline, as in the GitHub Actions gate below, and deploy the verified image by digest.

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
      --certificate-identity https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main \
      --certificate-oidc-issuer https://token.actions.githubusercontent.com \
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
  ghcr.io/berriai/litellm:v1.108.15
```

Cosign verification works with digests too:

```bash
cosign verify \
  --certificate-identity https://github.com/BerriAI/project-releaser/.github/workflows/release.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
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

The [consolidated source image](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/Dockerfile#L212) runs as UID/GID `65532:65532`. Its entrypoint accepts `proxy`, `gateway`, `backend`, `ui`, `migrations`, `metrics`, or `collector` as the first argument. No argument, or a CLI flag such as `--config`, starts the full proxy. Keep this entrypoint. Select a component in Kubernetes through `args`.

Check the exact image you use before relying on that non-root default. Older published images use a different entrypoint and can run as root:

```bash
docker image inspect "$LITELLM_IMAGE" \
  --format '{{.Config.User}} {{json .Config.Entrypoint}}'
```

Restrict mounted credentials to the runtime user. If you use a read-only root filesystem, add writable volumes for temporary files. The chart does not add them automatically. Configure security contexts and mounts for each enabled workload, including the migration Job. See the [chart values](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml).

## Further reading

- [CI/CD v2 announcement](https://docs.litellm.ai/blog/ci-cd-v2-improvements) explains LiteLLM's signing infrastructure.
- [Keyless signing](/blog/security-incident-oct-21-2026#keyless-signing) in the October 21, 2026 incident post explains the move away from a stored key.
- [Image signing announcement](https://github.com/BerriAI/litellm/discussions/48242) lists which releases are signed with which key.
- [Deployment overview](./deploy.md) links to Helm, Terraform, and architecture guides.
- [cosign documentation](https://docs.sigstore.dev/quickstart/quickstart-cosign/) covers signature verification and key management.
- [Sigstore Policy Controller](https://docs.sigstore.dev/policy-controller/overview/) covers Kubernetes admission control.
