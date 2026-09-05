---
slug: rust-parity-by-design
title: "Rust Parity by Design: Keeping a Gateway Migration Boring"
date: 2026-09-05T09:00:00
authors:
  - yujonglee
description: "How LiteLLM is moving gateway work into Rust without changing the contracts customers depend on."
keywords: [rust, ai gateway, llm gateway, api compatibility, streaming, engineering]
tags: [rust, ai-gateway, engineering, reliability]
---

Moving a gateway hot path to Rust is the easy part. Preserving the behavior that has accumulated around it is the real engineering work.

LiteLLM accepts requests from many client libraries, speaks to many providers, and exposes more than a successful JSON response. Clients rely on error shapes, streaming events, usage fields, headers, retries, and configuration behavior. A faster implementation is only useful if those contracts remain stable.

This is the principle behind the Rust migration: make the internal boundary explicit, then prove the Rust path behaves like the existing path before it becomes the default.

{/* truncate */}

## Define the boundary before moving code

The first decision is what belongs in Rust and what stays in the host layer. The Rust core is a good fit for deterministic request and response work:

- transforming a normalized request into a provider request
- parsing provider responses and stream chunks
- normalizing errors and usage data
- token accounting and routing decisions that do not need host-specific I/O

The host layer continues to own environment-specific concerns such as credentials, network I/O, database access, and Python extensions. This keeps the Rust core small and testable. It also avoids making every existing integration migrate at once.

```text
client request
      |
      v
host: auth, configuration, network I/O
      |
      v
Rust core: transforms, streaming, normalized responses
      |
      v
host: callbacks, persistence, response delivery
```

## Treat compatibility as data

“The response looks right” is not a sufficient parity check. A gateway contract includes the fields that are present, fields that are absent, their types, ordering where streaming clients observe it, and error behavior for malformed or unsupported inputs.

For each route, we can capture representative inputs and compare normalized outputs from the established path and the Rust path. The comparison should cover successful responses, provider errors, tool calls, optional parameters, and streaming sequences. When they differ, the difference needs a reason: either a bug, or a deliberate contract change that is documented and released as such.

This turns a broad migration risk into focused mismatches that engineers can inspect and fix.

## Stream chunks are part of the API

Streaming is often where compatibility work gets difficult. A stream is not one response. It is a sequence with its own contract: which event starts the stream, how partial content is emitted, how tool-call arguments are assembled, when usage is reported, and how errors terminate the connection.

The safest approach is to make chunk normalization a first-class part of the core rather than rebuilding it inside each provider integration. One shared representation lets tests compare event sequences and keeps provider-specific parsing isolated at the edge.

## Move one surface at a time

Large migrations become risky when every variable changes together. A smaller route with a constrained schema is a better proving ground than the most feature-rich endpoint. Once a route has parity coverage and production confidence, the same approach can extend to streaming and larger request surfaces.

The rollout loop is straightforward:

1. choose one bounded route and provider path
2. add parity cases for normal, error, and streaming behavior
3. run the Rust implementation behind a flag or alongside the existing path
4. investigate every observed mismatch before expanding scope

This pace is intentionally unglamorous. It makes regressions local, keeps rollback simple, and builds reusable compatibility tooling instead of a one-off rewrite.

## Performance follows correctness

Rust gives us tighter control over allocation, concurrency, and CPU-bound work. Those gains matter most under high concurrency and for endpoints where gateway work is a meaningful part of total latency. But the order matters: first preserve the contract, then measure and optimize the hot path.

The destination is a lighter gateway implementation that still feels familiar to users. The same configuration, client API, and provider integrations should keep working while the implementation underneath becomes more efficient. That is how a migration becomes an upgrade rather than a fork.
