---
title: Version support
description: LiteLLM supports the four most recent stable minor lines with patch releases. Enterprise and open source use one image and one version number.
---

# Version support

LiteLLM supports the four most recent stable minor lines. Each of these lines gets patch releases. Older lines are at end of life and do not get updates.

Enterprise and open source use one image and one version number. The license key enables the Enterprise features. Thus this policy applies to Enterprise and to open source in the same way.

## How the window moves

LiteLLM releases a new stable minor line approximately each week. When a new line comes out, the oldest line goes out of the window and does not get more releases. There is no separate long-term support track.

This policy started on Monday, June 29, 2026. For example, in mid-June 2026 the supported lines were 1.86, 1.87, 1.88, and 1.89.

For a high-severity problem, LiteLLM can still release a fix outside the window. This does not occur frequently.

## Why four lines

A fix for each supported line is an additional release. The cost increases with the number of lines, not with the number of fixes. Four lines is the window that LiteLLM can maintain with full care.

## Find your status

1. Find the latest stable line in the [release notes](/release_notes).
2. Count back four lines from the latest stable line.
3. If your version is older than these four lines, plan an upgrade.

## Recommended upgrade practice

1. Pin your deployment to one minor line.
2. Install the latest patch for that line.
3. Move to a newer line before your line goes out of the window.

Refer to the [Release cycle](../proxy/release_cycle.md) for the weekly release schedule and for the difference between minor and patch versions.
