---
title: LTS pilot
description: LiteLLM is piloting a long-term support (LTS) line for one month, starting with 1.108.
---

# LTS pilot

Starting the week of November 2, 2026, LiteLLM is piloting a long-term support (LTS) line for one month. The first LTS line is 1.108. {/* keep-version-note */}

While the pilot runs, the [version support](./version_support.md) policy of patching the four most recent stable minor lines is paused.

The LTS line is for deployments that want to stay on one version and keep getting fixes, without upgrading every week. It gets patch releases with LLM translation fixes, cost tracking fixes, and new endpoints.

Refer to the [Release cycle](../proxy/release_cycle.md) for the weekly release schedule and for the difference between minor and patch versions.

## Stay on the latest LTS patch

The `lts` image tag always points to the latest LTS release, and it moves with every LTS patch. The `litellm-database` and `litellm-non_root` images carry the same tag.

```bash
docker pull docker.litellm.ai/berriai/litellm:lts
```

To control when you upgrade, pin a version such as `1.108.2` or `1.108.2-lts` instead. Both point to the same image as `lts` when that version is the latest LTS release.
