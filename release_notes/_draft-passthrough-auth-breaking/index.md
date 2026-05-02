---
title: "[DRAFT] Pass-through endpoints — auth defaults flip + OSS unlock"
slug: "draft-passthrough-auth-breaking"
date: 2026-04-30T00:00:00
draft: true
unlisted: true
hide_table_of_contents: true
---

> **Placeholder — do not merge as-is.**
>
> This is a parking spot for the breaking-change warning that needs to ship
> alongside the release that lands [PR #26827](https://github.com/BerriAI/litellm/pull/26827).
> When the release version is cut, move the `:::warning` block below into the
> corresponding `release_notes/<version>/index.md` and delete this folder.

## Why a placeholder

[PR #26827](https://github.com/BerriAI/litellm/pull/26827) changes the default
authentication behavior for pass-through endpoints configured under
`general_settings.pass_through_endpoints`. Operators upgrading without changing
their config will see previously-unauthenticated forwarders start requiring a
valid LiteLLM API key.

## Drop-in warning block

Paste this admonition into the next release notes file (above `## Key Highlights`),
matching the format used in [v1.83.7](../v1.83.7/index.md):

```mdx
:::warning

**Breaking change — pass-through endpoints now require authentication by default.**
`general_settings.pass_through_endpoints` entries that omit an explicit `auth`
key will now require a valid LiteLLM API key. Previously the omitted-`auth`
default was unauthenticated and the safe `auth: true` setting was rejected on
the OSS tier. Operators who relied on unauthenticated forwarders (e.g. webhook
receivers) must explicitly set `auth: false` on those entries before upgrading.
The `auth: true` setting is no longer enterprise-gated —
[PR #26827](https://github.com/BerriAI/litellm/pull/26827).

:::
```

## Operator action required

For each entry under `general_settings.pass_through_endpoints` in your proxy
config, decide whether the route should require LiteLLM authentication:

```yaml
general_settings:
  pass_through_endpoints:
    # Public webhook receiver — must opt out explicitly after this release:
    - path: "/webhooks/stripe"
      target: "https://internal-svc/stripe"
      auth: false

    # Authenticated forwarder — was enterprise-only before this release,
    # now available on OSS:
    - path: "/anthropic-mirror"
      target: "https://api.anthropic.com"
      auth: true
```

Entries with no `auth` key will default to `auth: true` after the upgrade.
