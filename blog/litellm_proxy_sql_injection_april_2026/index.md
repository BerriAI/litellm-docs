---
slug: cve-2026-42208-litellm-proxy-sql-injection
title: "Security Update: CVE-2026-42208 in LiteLLM Proxy"
date: 2026-04-29T12:00:00
authors:
  - krrish
  - ishaan-alt
description: "CVE-2026-42208 (SQL injection in LiteLLM Proxy's API key verification path) is fixed. Upgrade to v1.83.10-stable."
tags: [security]
hide_table_of_contents: false
---

We recently published a security advisory for LiteLLM Proxy.

We received a report through our bug bounty program regarding a SQL injection vulnerability in LiteLLM Proxy's API key verification path, tracked as **CVE-2026-42208**.

The issue was reviewed by our team, fixed in a stable release, and then published as a GitHub Security Advisory.

* **Affected versions:** `v1.81.16` through `v1.83.6`
* **Fixed versions:** `v1.83.7` and later
* **Recommended version:** `v1.83.10-stable`

Stable release: https://github.com/BerriAI/litellm/releases/tag/v1.83.10-stable

Advisory: https://github.com/BerriAI/litellm/security/advisories/GHSA-r75f-5x8p-qvmc

{/* truncate */}

## TLDR;

* This issue was reported through LiteLLM's bug bounty program.
* We fixed the issue in a stable release before publishing the GitHub Security Advisory.
* LiteLLM Proxy versions `v1.81.16` through `v1.83.6` are affected.
* The fix is available in `v1.83.7` and later.
* We recommend upgrading to `v1.83.10-stable`.
* If your proxy was reachable from an untrusted network while running an affected version, we recommend reviewing Postgres query history using the helper query below.

## What was the issue?

LiteLLM Proxy validates incoming requests by checking the `Authorization: Bearer` header during API key verification.

In affected versions, an unauthenticated request with a crafted `Authorization: Bearer` header could, under certain conditions, reach a vulnerable database query path.

This could potentially result in unintended database access. Practical impact depends on deployment configuration, network exposure, database permissions, and stored data.

## Our security process

This issue was reported through our bug bounty program. Our team reviewed the report, patched the vulnerable path, validated the fix, and released a stable build before publishing the GitHub Security Advisory.

We follow this process so users have a clear remediation path available at the time an advisory is published.

## What you should do

### 1. Upgrade to `v1.83.10-stable`

We recommend upgrading to the latest stable release:

https://github.com/BerriAI/litellm/releases/tag/v1.83.10-stable

If you are unable to upgrade directly to `v1.83.10-stable`, upgrade to any version `v1.83.7` or later.

### 2. Review Postgres query history if applicable

If your LiteLLM Proxy was reachable from an untrusted network while running an affected version, we recommend reviewing your Postgres query history using this helper query:

https://gist.github.com/ishaan-berri/6f31e56e878338eb4c01990bd08378ab

If the query returns results you'd like us to review, send them over and we can help triage.

## Continuing to invest in security

We will continue investing in our bug bounty program and coordinated disclosure process so issues can be identified, fixed, and communicated responsibly.

If you find a security issue in LiteLLM, please report it through our [GitHub Security Advisory process or our bug bounty program](https://github.com/BerriAI/litellm/security).
