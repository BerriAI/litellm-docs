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

The LTS line is for teams that want to stay on one version and keep getting fixes, without upgrading every week. Its patch releases follow the backport scope below.

While the pilot runs, the policy of patching the [four most recent stable lines](/docs/enterprise/version_support) is paused. The [LTS pilot](/docs/enterprise/lts_pilot) page has the details.

**Update (November 6):** The `lts` image tag now always points to the latest LTS release. Pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch, or pin a version such as `docker.litellm.ai/berriai/litellm:1.108.2`.

## What gets backported to LTS

- LLM translation bug fixes
- Cost tracking bug fixes
- Auth bug fixes
- Budget enforcement bug fixes
- Security fixes
- Any regression fix. A regression here means behavior that worked before LTS and on v1.100.x or later but is broken on LTS.
- New models and new endpoints, such as `/v1/decisions`

## What does not get backported to LTS

- New features or products
- Refactors, including Rust
- Performance improvements
- Fixes for pre-existing bugs in the router, UI, MCP, logging or guardrails. Pre-existing means the bug was there before 1.100.0.

## Why this scope

LLM translation and cost tracking fixes let teams use new models with accurate pricing without upgrading to a later version. Auth, budget enforcement and security fixes protect access and spending controls. Regression fixes restore behavior that worked before LTS. New endpoints such as `/v1/decisions` are included because they were assessed as low risk to existing behavior.

Every backport introduces a risk of regression. Keeping the scope limited lets teams stay on LTS for these fixes and model updates while reducing the changes they need to take. LTS does not receive every bug fix from later releases; new features, refactors, performance improvements and the pre-existing bugs listed above stay outside this scope.
