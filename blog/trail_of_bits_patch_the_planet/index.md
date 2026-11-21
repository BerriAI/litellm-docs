---
slug: trail-of-bits-patch-the-planet
title: "Trail of Bits helped harden LiteLLM, fixes are on the way"
date: 2026-11-23T10:00:00
authors:
  - oliver
description: "Trail of Bits worked on LiteLLM through Patch the Planet. What is coming, how the fixes and advisories will ship, and what to do."
tags: [security]
hide_table_of_contents: false
---

I am very excited to report that LiteLLM was selected for [Patch the Planet](https://trailofbits.com/patch-the-planet/), the open-source hardening program run by [Trail of Bits](https://www.trailofbits.com/), and that this engagement has recently concluded. They worked directly in our codebase, finding vulnerabilities and writing fixes for them. Their work covers roughly 90 vulnerabilities, a combination of novel issues they identified and reports from independent security researchers that they took on as part of the same work.

Fixes are beginnning to ship, and we expect every fix to be available within the next week or two. Most ship in public releases, each with an advisory. The most severe will first go to our [private registry](/blog/litellm-private-registry-access) under embargo, and their public release and advisory follow two weeks later.

You will see a lot of advisories from us over the next three to four weeks. This post covers the context behind them, how the fixes reach you, and what to do.

{/* truncate */}

## Why Trail of Bits

This year we built a security function at LiteLLM. The first priority was everything around the code: the release pipeline, identity and access, and detection. We launched a managed vulnerability disclosure program with HackerOne and stood up a [private registry](/blog/litellm-private-registry) for embargoed fixes. We are adding a security engineer and a detection engineer to the team.

The next step was the application itself, which is where Trail of Bits came in.

If you work in security, you already know of Trail of Bits. If you don't: they are one of the most respected security research firms in the world. They write tools and handbooks that much of the industry relies on, and their name carries real weight with security teams. Patch the Planet is their initiative with OpenAI for open-source software. It pairs AI-driven vulnerability discovery with Trail of Bits' researchers, who reproduce, validate and prioritize what the models find.

For a company of about sixteen people, being accepted into the program and having security engineers of that caliber working on our code is a big deal. And on a personal note, the folks at Trail of Bits were an absolute delight to work with. If you are eligible, I highly recommend applying.

One of the most impressive things about a Patch the Planet engagement is that they propose fixes for the vulnerabilities they identify. Most of the vulnerabilities in this engagement, whether Trail of Bits identified them or a researcher reported them, came back to us with a candidate patch, and together those patches touch nearly every part of the codebase.

Shipping the patches is, of course, up to us. An outside reviewer cannot know every way our customers use LiteLLM, so we test every proposed change thoroughly for regressions and rework it where needed.

## What a high volume of advisories tells you

Each of these advisories is a weakness removed from the product. A quiet advisory feed doesn't say much about a piece of software: sometimes the code is sound, but it can also mean that nobody with the skill and the time has looked closely enough. Bugs exist whether or not anyone finds them, and we cannot express enough how grateful we are to Trail of Bits for helping us get these found and fixed.

This high volume of upcoming advisories leaves us in a significantly better place.

## How the fixes will ship

Most fixes ship in regular public releases and patches. When a fix is public, we publish a GitHub Security Advisory on [BerriAI/litellm](https://github.com/BerriAI/litellm/security/advisories) and request a CVE. The first of these land this week.

Fixes for the most severe vulnerabilities are published first to the [LiteLLM Private Registry](/blog/litellm-private-registry-access), and the public release and advisory follow two weeks later. We are working directly with our customers to get them onto the patched versions during those two weeks.

We expect every fix to be out, publicly or through the private registry, within the next week or two. Accounting for the embargo period, the last of the public advisories from this effort should land three to four weeks from now.

## What you should do

If you are pulling from our public registries, please ensure you are on a supported release. Fixes will ship to our [supported release lines](/docs/enterprise/version_support). For the least friction we recommend the [LTS release](/docs/enterprise/lts_pilot), which is the `v1.108.x` line.

If you are pulling from our private registry and are part of our security embargo program, *please ensure you are on our LTS release line or keep up with latest stable.* Due to the size and breadth of the fixes coming, we cannot keep up with backporting all of them into our entire support window for the duration of the embargo period.

Subscribe to the [Security Announcements mailing list](https://security.litellm.ai/mailinglist/). This list is reserved for urgent or critical matters only, so it does not replace our [advisory feed on GitHub](https://github.com/BerriAI/litellm/security/advisories). The emails come from security@berri.ai, so please allowlist that address in your spam filters.

If you have questions about this work or any advisory that comes out of it, please reach out to security@berri.ai.

Oliver Jensen
Director of Security, LiteLLM
