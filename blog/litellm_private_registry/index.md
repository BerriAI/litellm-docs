---
slug: litellm-private-registry
title: "Introducing the LiteLLM Private Registry"
date: 2026-10-27T10:00:00
authors:
  - oliver
  - krrish
  - ishaan
description: "LiteLLM is committing to a private registry to provide early access to fixes for the most severe security vulnerabilities, ahead of public release."
tags: [security]
hide_table_of_contents: false
image: /img/blog/litellm_private_registry/header.png
---

![LiteLLM Private Registry: private fixes for the most severe vulnerabilities](/img/blog/litellm_private_registry/header.png)

We are committed to continuously improving the security of LiteLLM, for both our open-source community and enterprise customers.
With AI agents, publicly releasing a security patch can give attackers an immediate blueprint for exploiting the vulnerability, before users have had time to upgrade.
To address this, we're introducing a LiteLLM Private Registry in the coming weeks. For the most severe vulnerabilities, we'll first distribute fixes privately, giving organizations time to upgrade before publishing the patch and security advisory publicly.
**Our commitment to open source remains unchanged.** All security fixes will continue to be released publicly.

{/* truncate */}

We recently piloted this approach, standing up a temporary private registry to ship a fix for a critical vulnerability to our enterprise customers ahead of public disclosure. The pilot was successful: customers had access to patched builds with reasonable time to upgrade before threat actors had the information needed to craft attacks against them.

We learned a great deal running it, and we are committing to making a private registry a permanent part of how we protect LiteLLM customers. This post covers what we did, what we learned, and what comes next.

## Why we built it

The threat landscape has changed rapidly for open source products in the last few months. Improvements in AI capabilities have effectively turned any public open source release containing a security fix into a de-facto vulnerability disclosure. Anyone can point a model at our patch diffs as they come out, prompting it to identify fixed vulnerabilities. We now operate under the assumption that attack traffic, that previously followed advisories, now follows releases.

On October 6, we completed a fix for a critical vulnerability in LiteLLM that affected only deployments running with an enterprise license. An unauthenticated attacker who could reach the proxy over HTTP could escalate to proxy admin. In some configurations, proxy admins can execute arbitrary code on the host, so for those deployments the impact was remote code execution.

The vulnerability was limited to enterprise deployments, which created an opportunity to test the idea of running a private registry.

## How the pilot worked

On October 6, we stood up a private package registry and began publishing patched LiteLLM releases to it. We attempted to notify every enterprise, and allocated credentials to pull the fixed versions. Throughout the embargo period we continued to publish new releases to both the private registry and our public channels, so customers who upgraded through the registry could stay current with new releases and bugfixes.

The embargo ended today, October 27. Patched versions are now being published to PyPI, GHCR, and Docker Hub, and the public advisory will follow once the release is available.

## What we learned

This was our first attempt at running a private registry, and we learnt valuable lessons along the way. Three in particular are worth discussing:

**Large burden on release engineering.** Every release and bugfix backport during the embargo period had to be built, tested and published twice: once for public channels and once for the private registry. The embargo period coincided with a period in which we significantly increased backport releases, which meant that for three weeks, release engineering spent most of their time just implementing and testing backports. This is workable in an emergency situation, but is not sustainable long-term.

**A stable v2 is needed.** Our priority was getting the fix into customers' hands as fast as possible, which is reflected in some of the choices around image delivery. They do not lay the correct foundation for a long-term resource. As such, the registry we used for this pilot will be retired and replaced with one designed from the start for the way we now know we want to use it.

**Proactive communication/assistance was essential.** Building the registry and publishing to it turned out to be the easy part. Making sure every affected customer knew the fix existed, knew how to get it, and had actually applied it was where we struggled, and it is the reason the embargo ran a week longer than we intended. This problem is ancillary to the implementation of a private registry, but nonetheless one that it highlighted and one that we must solve.

## Next steps

LiteLLM is committing to a permanent private registry. In the next few weeks, we will detail how this process will work. In addition to including our enterprise customers, we are evaluating how we can support OSS users with this registry.

If you have any feedback on this, we welcome it at [this GitHub discussion](https://github.com/BerriAI/litellm/discussions/48643).

## The advisory

The public security advisory for this vulnerability will be published on GitHub shortly, and this section will be updated with a link to the advisory once it is live.

If you run LiteLLM with an enterprise license and have not yet upgraded, please do so now. If you are an enterprise customer and did not receive a notification during the embargo period, we would like to hear from you so we can fix the gap: write to us at security@berri.ai.

If you want to be notified of future security releases, you can subscribe to our security mailing list, linked from the SECURITY.md in the LiteLLM repository.

