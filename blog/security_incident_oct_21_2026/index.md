---
slug: security-incident-oct-21-2026
title: "Contained: Oct 21, 2026 LiteLLM release v1.107.0 Compromised"
date: 2026-10-21T10:00:00
authors:
  - nate
description: "LiteLLM release v1.107.0 was compromised by a malicious actor."
tags: [security, incident-report]
hide_table_of_contents: false
---

> **Status:** Incident contained, investigation in progress

> **Last updated:** October 21, 2026 16:00 UTC

In the early morning of October 21, LiteLLM's release pipeline was compromised
and pushed v1.107.0 to the docker registry and PyPi. This version contained
compiled malware which steals credentials and loads remote-code execution tools.
All previous versions are safe, and the impacted releases have been pulled.
**Customers running the private enterprise release of LiteLLM were not impacted.**

{/* truncate */}

---

## TLDR;

- PyPI wheels for version v1.107.0 were compromised from 11:39 UTC to 13:23 UTC. They are now pulled.
- Docker images `v1.107.0`, `latest`, `main-latest`, and `main-stable` were compromised from 11:46 UTC to 14:20 UTC. The `v1.107.0` image was removed, and the others were pointed at secure sources.
- Customers running the private enterprise release of LiteLLM were not impacted.
- Attackers compromised 3 unique developer github credentials and used them to put out an unsafe release. As a temporary mitigation, we have removed all but one (unaffected) user from our GitHub organization. In addition, we have updated our public registries to remove any trusted links to our GitHub organization, in order to prevent further publication of malicious packages.

## Overview

At 4:00 AM PST October 21, LiteLLM's release pipeline was compromised
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

## What Happened

We have identified that the malicious actions were taken through three
engineers' GitHub accounts, appearing to be by way of stolen GitHub CLI OAuth
tokens. The threat actor used one user's account to make changes to our release
pipeline and trigger the project-releaser run, and another user's account to
approve it. All tokens which were involved in this attack have been revoked.

These versions include a credential stealer and infrastructure for attackers to
execute remote code on impacted machines.

We have not yet identified the mechanism by which the threat actor acquired the
relevant tokens, so cannot yet assert that there is no further access to these GitHub
accounts. As a temporary mitigation, we have removed all but one (unaffected)
user from our GitHub organization. In addition, we have updated our public
registries to remove any trusted links to our GitHub organization, in order to
prevent further publication of malicious packages.

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

We will keep this post updated with the most recent information, and continue to update every two hours. Our next update will be at 18:30 UTC.

## Response and Remediation

We have already taken the following steps:

- Removed compromised packages from PyPI
- Revoked maintainer credentials to minimal necessary while we investigate the scope of compromise


---

If you discover a security issue in LiteLLM, please report it through our [bug bounty program](https://github.com/BerriAI/litellm/security).
