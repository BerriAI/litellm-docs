---
slug: security-incident-oct-21-2026
title: "Contained: Oct 21, 2026 LiteLLM release v1.107.0 Compromised"
date: 2026-10-21T10:00:00
authors:
  - krrish
  - ishaan
  - oliver
  - nate
description: "LiteLLM release v1.107.0 was compromised by a malicious actor."
tags: [security, incident-report]
hide_table_of_contents: false
---

> **Status:** Incident contained, investigation located [here](/blog/security-incident-oct-21-2026-attack-chain)

> **Last updated:** October 21, 2026 20:30 UTC

In the early morning of October 21, LiteLLM's release pipeline was compromised
and pushed v1.107.0 to the docker registry and PyPi. This version contained
compiled malware which steals credentials and loads remote-code execution tools.
All previous versions are safe, and the impacted releases have been pulled.
**Enterprise Customers running the private enterprise release of LiteLLM were not impacted.**

**Update (20:30 UTC):** We believe we have identified the attack chain which facilitated this attack. The attacker had to compromise multiple independent security controls to be successful. See **How this happened** below.

**Update (October 23, 21:50 UTC):** This post was written while our investigation was ongoing. Some our assumptions and beliefs reflected in our status updates and the text below were later discovered to be inaccurate or incomplete. We have left them in their original form as a record of our investigation, but have posted a canonical record [here](https://docs.litellm.ai/blog/security-incident-oct-21-2026-attack-chain).

**Update (October 30):** The commit that rotated our cosign image signing key on October 23 now shows as verified on GitHub, and we added the new key's fingerprint to this post. See [Image signing key rotation](#image-signing-key-rotation).

{/* truncate */}

---

## TLDR;

- A malicious `litellm==1.107.0` package was published to PyPI and was live for approximately 2 hours (11:39 UTC to 13:23 UTC). **It has since been pulled.**
- Docker images `v1.107.0`, `latest`, `main-latest`, and `main-stable` were compromised from 11:46 UTC to 14:20 UTC. **The `v1.107.0` image was removed, and the others were pointed at secure sources.**
- **Enterprise Customers running the private enterprise release of LiteLLM were not impacted.**

## Overview

At around 4:40 AM PDT (11:40 UTC) October 21, LiteLLM's release pipeline was compromised
and pushed v1.107.0 to the docker registry and PyPi. This version contained
compiled malware which steals credentials and loads remote-code execution tools.
All previous versions are safe, and the impacted releases have been pulled.

## Confirmed Affected Versions

The following LiteLLM artifacts were impacted:

- **PyPI: `litellm==1.107.0`**: all seven wheels, live from 11:39:51 to 13:23 UTC
- **Docker Hub: `v1.107.0`, `latest`, `main-latest`, and `main-stable`**: pointed to compromised image index `sha256:1bbcb1443bc962e45f5aad53fe3d2c30600e0379715fb6c664cdd3ac126c339e` from 11:46:56 to 14:20 UTC
- **GHCR: `v1.107.0`, `latest`, `main-latest`, and `main-stable`**: pointed to the compromised image indexes below from 11:46:56 UTC until they were made unavailable by 13:51 UTC
  - `ghcr.io/berriai/litellm`: `sha256:1bbcb1443bc9…`
  - `ghcr.io/berriai/litellm-database`: `sha256:c00f9d92c427…`
  - `ghcr.io/berriai/litellm-non_root`: `sha256:7b00e91cd2fe…`

The official `v1.107.0` source tag in GitHub does not contain the malicious files. The compromised artifacts were built from an attacker-controlled repository.

If you installed or ran any of these artifacts, review the recommendations below immediately.

Note: These artifacts have already been removed from PyPI, Docker Hub, and GHCR.

---

## Who is affected

You are affected if you used an unpinned version of LiteLLM between 11:39 and 13:23 UTC via pip or if you used the docker image `v1.107.0`, `latest`, `main-latest`, or `main-stable` between 11:46 and 14:20 UTC.

**OSS Users**

If you ran `pip install` on LiteLLM v1.107.0 or started the docker image in the compromised interval, assume it is compromised.

For the time being, please pin your version to 1.106.2 or any explicit version published prior to now.

**Enterprise Customers**

There currently exists a private LiteLLM registry for enterprise customers, in which we are distributing an embargoed release that remediates a vulnerability whose disclosure date is scheduled for October 27. Our private registry is not affected. If you are an enterprise customer pulling from our private registry you are not affected.

### How to check if you are affected

If you ran `pip install` on LiteLLM v1.107.0 or started the docker image in the compromised interval, assume it is compromised.

- If an environment started Python with litellm==1.107.0, treat that environment as compromised. You can check with `pip show litellm`.
- If a container executed affected image digest sha256:1bbcb1443bc962e45f5aad53fe3d2c30600e0379715fb6c664cdd3ac126c339e, treat it as compromised.
- Search filesystem evidence for litellm-1.107.0.dist-info, cook.pth, and sitecustomize.py. Finding one confirms exposure, but not finding one does not prove the environment is clean.

We will be posting more detail on how specifically to find indication of compromise. For now, you can find details of the attack and our initial responses in this [GitHub Issue](https://github.com/BerriAI/litellm/issues/47826#issue-5960147552).

### What to do if you are affected

These instructions are courtesy of [LidorMachluf](https://github.com/LidorMachluf), who helped us to detect this incident.

**Don't start with `pip install`.** Any Python start in the affected environment runs `cook.pth` and `sitecustomize.py` again, and that includes running pip.

1. From the shell, delete `cook.pth`, `cook.py`, `sitecustomize.py` and any matching `__pycache__/cook*.pyc` and `sitecustomize*.pyc` from **every** affected site-packages.
2. Kill the detached python daemon (it holds `/tmp/remote_code_loader.lock`).
3. Reinstall pinned to `litellm==1.106.2`. Rebuilding images and venvs from scratch is better.
4. **If 1.107.0 was ever installed on a host with outbound internet, assume the exfil succeeded.** If the marker file exists, the exfil is confirmed. If it doesn't, that proves nothing: containers and tmp cleanup remove it.
5. Rotate everything listed above that the host could reach. In particular:
   - the instance/task IAM role
   - **every provider key stored in the LiteLLM proxy DB**, plus the master and virtual keys
   - the `DATABASE_URL` password
   - any secret that was in the environment of any process on the host
6. Check CloudTrail for `GetCallerIdentity` from the instance role around install time, then for use of the role's credentials from outside your infrastructure.

---

## How this happened?

:::tip Notice
This post was written while our investigation was ongoing. Some our assumptions and beliefs reflected in our status updates and the text below were later discovered to be inaccurate or incomplete. We have left them in their original form as a record of our investigation, but have posted a canonical record [here](https://docs.litellm.ai/blog/security-incident-oct-21-2026-attack-chain).
:::

After the prior incident in March, we [meaningfully hardened our CI release pipeline](/blog/ci-cd-v2-improvements). We moved releases to a private repo, have a strict set of workflows used in order to create them via Trusted GitHub Publishers, made our docker release tags immutable, and are signing docker images.

### Normal release flow

1. **Cut a release-candidate branch and tag.** This happens on Friday at 3AM, and the branch and tag do not change.
2. **Qualify the release candidate.** We run the code through our integration tests, both publicly through CircleCI and privately through Buildkite, and check that everything is correct.
3. **Create artifacts.** This step is a GitHub workflow that runs in a private repo, and creates artifacts based on the SHA that has been qualified. This must be done by an engineer with write permissions to the private release repo.
4. **Deploy artifacts to testing environment.** We run a second round of testing against the produced artifacts.
5. **Publish the artifacts.** This is a GitHub workflow that uses Trusted GitHub Publishers to publish the artifacts made in the previous step. Publishing can only be performed by an account locked to a specific laptop physically located within our office at all times. No docker image is rebuilt at publish time.

### How it was undermined

1. On Monday, we temporarily expanded release permissions to allow two internal engineers to publish daily bugfix backports for customers.
2. The attacker had access to three sets of developer GitHub CLI credentials ([more on this below](#github-cli-oauth-token-exposure)). One of these had the ability to run GitHub workflows.
3. The attacker tried to merge a change to allow the releaser to be pointed at a different source repository, but was unable to due to our protections. One of the tokens held by the attacker belonged to one of our two GitHub organization owners. The attacker used this to disable branch protections and force push the change.
4. Finally, they ran the compromised workflow, pointed at a lookalike repository (`Berri-AI/litellm` instead of `BerriAI/litellm`), which signed and published the poisoned artifacts.

### GitHub CLI OAuth token exposure

After a thorough investigation, we have observed specific situations in which Claude Code will embed a user's GitHub CLI OAuth token into a response body, and in situations where response bodies are logged, these tokens may appear in LiteLLM logs.

### Access to our internal LiteLLM deployment

We identified an unexpected, innocuously named user account in our internal LiteLLM deployment, which was exposed to the public internet. We believe the attacker gained access to this deployment, obtained the GitHub CLI OAuth tokens from its logs, and subsequently used those credentials to compromise our release workflow.

We have not yet confirmed how the attacker gained access to our internal deployment, but currently suspect it was through a recently patched vulnerability.

### Continued investigation

We are still working on confirming some of the above, and identifying a timeline. We will post additional details as we discover them.

Sincerely,
Oliver, Krrish, and Ishaan

---

## Timeline

All times are UTC on October 21, 2026.

- 10:08:29: GitHub branch protection rejected an unauthorized modification to our private release workflow because it had not passed the required pull-request and status-check process.
- 10:08:34: A credential associated with a privileged developer account was used to override those protections and apply workflow commit 9cf97e935aeaf791b9c8db224a2bb3ee156134ce.
- 10:46:39: The modified workflow started an official staging run. It used the attacker-controlled source repository Berri-AI/litellm at commit 20535d8fa11f786a6c24df7488a0e449ed5f09ad.
- 11:08:09: The staging run completed successfully.
- 11:08:53: The production release pipeline began.
- 11:11:18: A credential associated with a second developer account was used to satisfy the production approval gate.
- 11:39:51–11:40:13: Seven malicious litellm==1.107.0 wheels were uploaded to PyPI. The official 1.107.0 source tag did not contain the malicious files.
- 11:46:56: Container publication jobs ran for the same release. The published Docker image included malicious content from the attacker-controlled source.
- 11:53:49–11:54:01: Credentials associated with a third developer account were used to delete the production and staging workflow records. This limited the workflow logs available for investigation.
- 12:09:38–12:24:52: The unauthorized workflow revision was removed, and the release workflow was restored to its preceding revision.
- By 13:23: PyPI had removed litellm==1.107.0.
- 13:51: A registry verification found the affected GHCR tags unavailable. Docker Hub tags v1.107.0, latest, main-latest, and main-stable still resolved to compromised image index sha256:1bbcb1443bc962e45f5aad53fe3d2c30600e0379715fb6c664cdd3ac126c339e.
- 14:20: All affected Docker Hub tags and image variants were removed or repointed to verified clean artifacts.

## Response and Remediation

We have already taken the following steps:

- Removed compromised packages from PyPI
- Revoked maintainer credentials to minimal necessary while we investigate the scope of compromise

### Image signing key rotation

We believe the private half of our previous cosign key was exposed when the attacker [exfiltrated additional tokens](/blog/security-incident-oct-21-2026-attack-chain#exfiltrating-additional-tokens), so on October 23 we replaced it with a new key in [commit `e82a3c6`](https://github.com/BerriAI/litellm/commit/e82a3c646908ba0a6ee0beddc4310d7a6cac4065), merged in [PR #48103](https://github.com/BerriAI/litellm/pull/48103). The first releases signed with the new key, `v1.103.8`, `v1.104.6`, `v1.105.4` and `v1.106.3`, went out on October 24, and every later release uses it too.

The SHA-256 fingerprint of the new public key file, `cosign.pub`, is:

```
e3fe3e08c44b16407fe0b37c43b4f8b603b3a0f4ee74c29e647bc022d762c2c0
```

Check that the key you verify with matches it:

```bash
curl -sL https://raw.githubusercontent.com/BerriAI/litellm/e82a3c646908ba0a6ee0beddc4310d7a6cac4065/cosign.pub | shasum -a 256
```

Earlier images are signed with the previous key from [commit `0112e53`](https://github.com/BerriAI/litellm/commit/0112e53046018d726492c814b3644b7d376029d0). Trust a signature from the previous key only on an image published before the `v1.107.0` release on October 21. The compromised `v1.107.0` images also carry a valid signature from the previous key, so check their digests against the [affected versions](#confirmed-affected-versions) above. See the [Docker image security guide](/docs/proxy/docker_image_security) for the full verify commands.


---

If you discover a security issue in LiteLLM, please report it through our [bug bounty program](https://github.com/BerriAI/litellm/security).
