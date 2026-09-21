---
title: LiteLLM Rust Migration
description: Current status and technical design for LiteLLM's Rust migration.
hide_table_of_contents: true
---

# LiteLLM Rust Migration

Follow the migration of LiteLLM's latency-sensitive execution, provider translation, and gateway orchestration from Python to Rust.

## Migration status

The concise status brief covers the delivery roadmap, customer experience, and adoption path.

[![Latest LiteLLM Rust migration status](/img/rust-migration-status.webp)](/img/rust-migration-status.webp)

[Open the migration status image](/img/rust-migration-status.webp)

## Technical design

The technical design document covers architecture, compatibility contracts, implementation ownership, rollout, and validation.

[View the latest technical design PDF](https://github.com/BerriAI/litellm-typst/releases/download/latest-pdf/migration-tdd.pdf)

## Posts

### [OCR uses Rust by default starting with v1.102.0-rc.1](/blog/litellm-rust-ocr)

How LiteLLM moved OCR calls to the Rust implementation by default while preserving the existing API.

### [Migrating LiteLLM to Rust: Building the Fastest and Litest AI Gateway](/blog/litellm-rust-launch)

Why LiteLLM is moving its gateway hot path to Rust, the compatibility goals, and the staged migration plan.

### [Benchmarking the LiteLLM Rust AI Gateway: Overhead, Memory, and Cost](/blog/rust-ai-gateway-benchmarks)

Measurements of gateway-added latency, memory, throughput efficiency, cost, and agentic coding sessions.

[Browse all Rust migration posts](/blog/tags/rust-migration)

:::note Document access

The status image is public on this page. The technical design PDF is rebuilt from the latest successful `litellm-typst` build and currently requires GitHub access to the internal repository.

:::
