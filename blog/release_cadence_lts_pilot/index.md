---
slug: release-cadence-and-lts-pilot
title: "Release cadence changes and an LTS version pilot"
date: 2026-11-02
authors:
  - yuneng
description: "Starting the week of November 2, 2026, release candidates and stable releases ship on Tuesday mornings, and LiteLLM is piloting a long-term support line on 1.108 for one month."
tags: [release, support]
hide_table_of_contents: false
---

*Starting the week of November 2, 2026, LiteLLM release candidates and stable releases move from Saturday to Tuesday morning, and we are piloting a long-term support (LTS) line for one month.*

{/* truncate */}

## Releases move to Tuesday

Release candidates and stable releases now ship on Tuesday mornings instead of Saturdays, in line with the industry-standard Patch Tuesday release day. The [release cycle](/docs/proxy/release_cycle) page has the full weekly schedule.

## An LTS pilot on 1.108

We are also piloting a long-term support (LTS) line for one month. The first LTS line is 1.108.

The LTS line is for teams that want to stay on one version and keep getting fixes, without upgrading every week. It gets patch releases with LLM translation fixes, cost tracking fixes, and new endpoints.

We chose LLM translation and cost tracking so you can support new models with accurate pricing without upgrading to a later version.

While the pilot runs, the policy of patching the [four most recent stable lines](/docs/enterprise/version_support) is paused. The [LTS pilot](/docs/enterprise/lts_pilot) page has the details.

**Update (November 6):** The `lts` image tag now always points to the latest LTS release. Pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch, or pin a version such as `docker.litellm.ai/berriai/litellm:1.108.2`.

## Update (November 16): narrower LTS backport scope

This update is a change to the backport process from this date forward. It adds to the guidance above and does not replace it: the Tuesday release cadence, the 1.108 LTS line, and the `lts` image tag work as described earlier in this post, and LTS patches that already shipped are unchanged.

An LTS line that suits every type of team is not practical, so the LTS line now gets only three types of fixes. These are security fixes, major LLM translation fixes (for example, new request or response fields), and major cost tracking fixes (for example, a new model that needs code changes or new cost map fields to price correctly, including prompt caching).

The LTS line no longer gets new products or features, new endpoints, refactors, performance improvements, or fixes for bugs that already existed in the router, UI, MCP, logging, or guardrails.

The LTS line is for teams that pin one version for a long time and upgrade only when a security or pricing fix requires it. If you want new features and bug fixes as they land, upgrade to the latest stable release; general bug fixes are backported to the latest stable and release candidate lines.
