---
title: LTS pilot
description: LiteLLM is piloting a long-term support (LTS) line for one month, starting with 1.108. The LTS line and the newest stable minor line get patch releases.
---

# LTS pilot

Starting the week of November 2, 2026, LiteLLM is piloting a long-term support (LTS) line for one month. The first LTS line is 1.108. {/* keep-version-note */}

While the pilot runs, the [version support](./version_support.md) policy of patching the four most recent stable minor lines is paused. Two lines get patch releases instead, the LTS line and the newest stable minor line. Older lines do not get updates.

For a high-severity problem, LiteLLM can still release a fix outside these lines. This does not occur frequently.

## The LTS line

The LTS line is for deployments that want to stay on one version and keep getting fixes, without upgrading every week.

The LTS line gets patch releases with LLM translation fixes, cost tracking fixes, and new endpoints. Other changes ship only in the weekly stable lines. Only one LTS line is supported at a time.

When the pilot ends, this page will describe what comes next.

## The newest stable line

LiteLLM releases a new stable minor line approximately each week. When a new stable line comes out, the previous one stops getting patch releases, unless it is the LTS line.

## Find your status

1. If you run 1.108, you are on the LTS line. Install its latest patch.
2. Otherwise, find the latest stable line in the [release notes](/release_notes). If you run it, you are on the newest stable line.
3. If you run any other line, plan an upgrade to the LTS line or to the newest stable line.

## Recommended upgrade practice

1. Pin your deployment to one minor line, the LTS line or the newest stable line.
2. Install the latest patch for that line.
3. If you pin to the newest stable line, move to each new stable line as it comes out.

Refer to the [Release cycle](../proxy/release_cycle.md) for the weekly release schedule and for the difference between minor and patch versions.
