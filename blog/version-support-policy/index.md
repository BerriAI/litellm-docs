---
slug: version-support-policy
title: "Supporting the four most recent LiteLLM releases"
date: 2026-06-16T09:00:00
authors:
- litellm
description: "LiteLLM now supports the four most recent stable minor lines. Here is why, how it works, and what it means for you"
tags: [releases, maintenance]
hide_table_of_contents: true
---

Starting Monday, June 29, 2026, LiteLLM supports the four most recent stable minor lines. Each of those lines keeps getting patch releases; anything older reaches end of life. As of mid-June 2026 the supported lines are 1.86, 1.87, 1.88, and 1.89, and the set rolls forward as new releases ship

{/* truncate */}

## Why we are doing this

LiteLLM ships fast. A new minor line goes out roughly every week, and until now we patched lines well down the list. In one recent week that meant more than ten releases, because every fix had to be carried forward onto every line we kept alive. That cost grows with the number of lines we maintain, not the number of fixes we make, and it slows down getting fixes into the releases people actually run. Focusing on four lines lets us give each one more care

## How it works

The window always holds the four most recent stable minor lines. When we promote a new line, the oldest one drops out and stops receiving releases. End of life is a clean cutoff; there is no separate long-term maintenance track. For any supported line, the recommended build is its latest patch. For rare, high-severity issues we will use our judgment and may act beyond the window when the situation calls for it

## What it means for you

If you run one of the four most recent lines, this is exactly where our attention goes, and concentrating on fewer lines means we can put more care into each release. To check where you stand, take the latest stable line and count back four; if your version is older than that, plan an upgrade. The simplest path is to pin to a minor line, take its patches, and move onto a newer line before yours drops out
