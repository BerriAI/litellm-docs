---
slug: august-2026-deprecations
title: "Deprecation notice: features being retired in the August 25, 2026 release"
date: 2026-06-25
authors:
  - ryan
description: "We're retiring a set of older, low-usage features and integrations in the August 25, 2026 release. You have ~60 days to migrate. Most paths are a one-line config change; full migration guide included."
tags: [deprecations, packaging]
hide_table_of_contents: false
---

We're focusing LiteLLM on being the most reliable LLM gateway in production. As part of that, we're retiring a set of older features and integrations that few teams use and that we can no longer maintain to the standard you expect. Removing them keeps the core of LiteLLM stable and performant.

These features are targeted for removal in the release on **August 25, 2026**, roughly 60 days from now. If you don't use any of them, nothing changes and you can stop reading. If you do, the full [Deprecations migration guide](https://docs.litellm.ai/docs/deprecations) walks through each one; most paths are a one-line config change.

This list is not final. If you depend on something here and want it to stay, reach out with the feature and your use case.

{/* truncate */}

## Dashboard features going away

| Feature | Why it's going | What to use instead |
| --- | --- | --- |
| Workflows | Experimental feature, did not get usage | None |
| Memory | Experimental feature, did not get usage | None |
| Playground's Agent Builder | Experimental feature, did not get usage | None |
| Prompt Management | Experimental feature, did not get usage | None |
| Old Usage page | Replaced by a faster, more accurate Usage dashboard | New Usage dashboard |
| API Reference tab | Replaced by a guided getting-started flow | Guided getting-started flow |
| Learning Resources | Low usage | None |
| MCP Network Settings + "Internal network only" flag | Not core, and inherently insecure as a network control | Filter at a load balancer; gate public vs private MCP servers with teams |

## Integrations and backends going away

| Feature | Why it's going | What to use instead |
| --- | --- | --- |
| GreenScale logging | Low usage; can't maintain to standard | None |
| DynamoDB as a proxy database | Can't maintain to our reliability bar as a proxy database | PostgreSQL |
| Gradient AI provider | Upstream service was discontinued | None |
| S3 logging v1 | Superseded by S3 logging v2 | S3 logging v2 |
| OpenTelemetry v1 | Superseded by OTEL v2 | OTEL v2 |
| Disk caching | Low usage; can't maintain to standard | None |
| CloudZero connector | Replaced by the OTEL v2 connector | OTEL v2 connector |
| Prisma resolve v1 | Superseded by the v2 migration resolver | Prisma resolver v2 |

## Packaging change

We're consolidating the PyPI and Docker packages down to a single `litellm` package. The extra variants (`litellm-database`, `litellm-ee`, `litellm-dev`, `litellm-non_root`) are going away. The `litellm` package will be the only supported package going forward and will absorb the functionality from `litellm-database` and `litellm-non_root`.

## What you need to do

If you use any of the above, follow the [Deprecations migration guide](https://docs.litellm.ai/docs/deprecations). Most paths are a one-line config change. If you're unsure whether you're affected, reach out and we'll check for you.

Thanks for building on LiteLLM.
