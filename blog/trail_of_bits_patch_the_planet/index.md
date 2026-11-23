---
slug: trail-of-bits-patch-the-planet
title: "Trail of Bits helped harden LiteLLM, and fixes are on the way"
date: 2026-11-23T14:00:00
authors:
  - oliver
description: "Trail of Bits worked on LiteLLM through Patch the Planet. Here is what is coming over the next several weeks, how the fixes will ship, and what to do."
tags: [security]
hide_table_of_contents: false
---

We're thrilled to share that LiteLLM was selected for [Patch the Planet](https://trailofbits.com/patch-the-planet/), the open-source security hardening program run by [Trail of Bits](https://www.trailofbits.com/) in partnership with OpenAI. The engagement has now concluded, and over the next three to four weeks we will be shipping a series of security fixes and publishing the corresponding security advisories.

Trail of Bits worked within our codebase, identifying and triaging vulnerabilities, and proposing remediation patches. Their work covers a combination of issues they discovered as well as reports from independent security researchers.

Fixes will begin shipping in the coming days. Most will ship in public releases accompanied by a security advisory. The most severe vulnerabilities will go to our private registry first, under embargo.


{/* truncate */}

## What's happening

Over the course of this year, we have significantly increased our investment in LiteLLM's security posture. We established dedicated security leadership, and are continuing to build out our security team. Much of this year's work has focused on areas surrounding the codebase: the release pipeline, identity and access, internal policies and procedures, and monitoring and detection. We've partnered with HackerOne for a managed vulnerability disclosure program. We built out a private registry to enable embargoed releases for high-risk vulnerabilities. We now have LTS releases of LiteLLM to decouple resolving vulnerabilities from pulling in new features.

We are also investing in the codebase itself, and this is where Trail of Bits came in.

Trail of Bits is one of the most highly respected security research firms today. In conjunction with OpenAI, they run an initiative called Patch the Planet, which combines frontier-model AI-driven vulnerability discovery with experienced security researchers who reproduce, validate, prioritize, and propose fixes for the findings.

LiteLLM had the privilege of being selected for this initiative, joining prominent open-source projects like SQLite, Python, Go, WordPress, curl, rsync, and others. Our experience working with Trail of Bits was immensely positive. I would strongly encourage maintainers of open source projects to apply.

Getting a patch is different from shipping it. LiteLLM is used in many different ways by our customers, and an external reviewer can't anticipate every use case. We still need to test each change carefully for regressions and adapt the patches where necessary.


## Contextualizing advisory counts

Over the coming weeks and as a result of this work, we will be publishing more advisories than in any comparable period.

Advisory volume reflects how closely software is examined and how openly its maintainers report what they find. Some of the most hardened software in the world publishes constantly: the Linux kernel issues thousands of CVEs a year, and Google Chrome hundreds. Trail of Bits examined LiteLLM very closely, and we are publishing an advisory for every fix that warrants one.

Each advisory published represents a weakness removed from the product. This high volume of upcoming advisories leaves us in a significantly better place.


## How the fixes will ship

Most fixes will ship in regular public releases and patches. When a fix is released, we will publish a GitHub Security Advisory on our [advisory feed](https://github.com/BerriAI/litellm/security/advisories) and request a CVE. The first of these should land in the coming days.

Fixes for the most severe vulnerabilities will be published first to the [LiteLLM Private Registry](/blog/litellm-private-registry-access) under embargo, with public releases and advisories following two weeks later.


## What you should do

If you are pulling from our public registries, please ensure you are on a supported release. Fixes will ship to our [supported release lines](/docs/enterprise/version_support). For the least friction, we recommend the LTS release, which is the v1.108.x line.

If you receive embargoed fixes through our private registry, please run the LTS line or the latest stable release. Given the size and breadth of these fixes, embargoed builds will only be available on those two lines; the rest of the supported versions will receive each fix at its public release.

We also recommend that you subscribe to the [Security Announcements mailing list](https://security.litellm.ai/mailinglist/), though please note that this list is reserved for urgent or critical matters only, and does not replace our advisory feed. Emails from this list come from `security@berri.ai`, so please allowlist that address in your spam filters.

If you have questions about this work or any advisory that comes out of it, please reach out to security@berri.ai.
