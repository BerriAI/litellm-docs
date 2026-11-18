---
title: LTS pilot
description: LiteLLM is piloting a long-term support (LTS) line for one month, starting with 1.108.
---

# LTS pilot

Starting the week of November 2, 2026, LiteLLM is piloting a long-term support (LTS) line for one month. The first LTS line is 1.108. {/* keep-version-note */}

While the pilot runs, the [version support](./version_support.md) policy of patching the four most recent stable minor lines is paused.

The LTS line is for deployments that want to stay on one version and keep getting fixes, without upgrading every week. Its patch releases follow the backport scope below.

Refer to the [Release cycle](../proxy/release_cycle.md) for the weekly release schedule and for the difference between minor and patch versions.

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

## Stay on the latest LTS patch

The `lts` image tag always points to the latest LTS release, and it moves with every LTS patch. The `litellm-database` and `litellm-non_root` images carry the same tag.

```bash
docker pull docker.litellm.ai/berriai/litellm:lts
```

To control when you upgrade, pin a version such as `1.108.2` or `1.108.2-lts` instead. Both point to the same image as `lts` when that version is the latest LTS release.
