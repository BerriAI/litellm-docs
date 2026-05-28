---
slug: anthropic-messages-streaming-perf
title: "Cutting Anthropic /v1/messages Streaming Overhead"
date: 2026-05-28T09:00:00
authors:
  - yassin
description: "How we reduced TTFT p99 by 88% and almost tripled streaming throughput on LiteLLM's Anthropic /v1/messages hot path, with byte-identical wire output."
tags: [performance, anthropic, streaming, proxy]
hide_table_of_contents: true
---

*Last Updated: May 2026*

The LiteLLM proxy's Anthropic `/v1/messages` streaming path was doing a surprising amount of work that nobody had asked for. On every request, every chunk, it was awaiting hooks that did nothing, rebuilding payloads it already had in hand, and constructing one Pydantic model per output token at end-of-stream. None of it shows up in a profile of a single request — but at 195 req/s of concurrent streaming load, the Python interpreter spends most of its time on it.

This post walks through the four categories of overhead we removed, the parity tests that gate the new paths, and the benchmark we ship with the proxy so anyone can reproduce the numbers.

{/* truncate */}

<!-- TODO(yassin): replace with hero diagram /img/blog/anthropic_messages_streaming_perf/hero.png -->

## The headline

500 streaming requests per run, concurrency 20, against a local mock Anthropic SSE provider on the same host. 80-request warmup, median of 5 back-to-back runs. Baseline is `HEAD^` of the optimization PR, optimized is `HEAD`.

| Metric | Baseline | Optimized | Delta |
| --- | ---: | ---: | ---: |
| TTFT p50 (ms) | 241.88 | 90.89 | **-62.4%** (2.66x) |
| TTFT p95 (ms) | 463.86 | 148.23 | **-68.0%** (3.13x) |
| TTFT p99 (ms) | 1313.46 | 155.77 | **-88.1%** (8.43x) |
| Full-request p50 (ms) | 242.26 | 91.32 | **-62.3%** |
| Output tokens / s | 4,394.5 | 12,504.4 | **+184.6%** (2.85x) |
| Requests / s | 68.66 | 195.38 | **+184.6%** (2.85x) |

Same wire output, same logged spend, same recorded callback payloads. The optimization PR adds parity tests that diff the byte-level proxy response and the billed/logged payloads between the new fast paths and the legacy paths.

<!-- TODO(yassin): replace with TTFT distribution chart /img/blog/anthropic_messages_streaming_perf/ttft_distribution.png -->

## Where the overhead was

Profiling a single concurrent streaming run pointed at four buckets of waste. Each one was individually small. Stacked, they were dominating the hot path.

### 1. Awaiting hooks that have nothing to do

Most LiteLLM proxy deployments do not have Datadog tracing on, do not have a per-chunk callback registered, and do not have a guardrail or cost-injection hook attached. The streaming handler did not know that — it spun up a Datadog span around every chunk, and awaited `async_post_call_streaming_iterator_hook` for every chunk. Both ended up no-ops, but the cost of `await`-ing a coroutine that does nothing is not zero: it is a `Task` allocation, an event-loop scheduling decision, and a context switch.

The bigger of the two offenders was the **agentic post-processing wrapper**. When any callback subclasses `CustomLogger.async_post_call_streaming_hook`, the proxy needs to buffer every SSE chunk, reconstruct the full response, and pass it to the callback. The reconstruction is non-trivial — `stream_chunk_builder` materializes one `ModelResponseStream` per chunk.

In the default config, no callback overrides that hook. So we were buffering, reconstructing, and dispatching to a hook that returned `(False, {})` and threw the reconstruction away. Detecting whether any registered callback actually overrides the hook is a one-time check at startup; once we do, we can short-circuit the entire wrapper.

The fix: gate each of these (Datadog span, per-chunk hook await, agentic wrapper) on whether *anything* downstream is going to consume them. Everything else falls back to the legacy path unchanged.

### 2. Doing the same work twice per request

Two double-work loops were easy to spot once we knew to look.

**Request body serialization.** The proxy serializes the inbound JSON body once for the pre-call logging callback (so loggers can record the request payload), and again to forward upstream. Same dict, same JSON, twice. We now serialize once and reuse the bytes for both.

**Optional-params type-hint resolution.** For each request, the proxy resolves the type hints on the provider's `OptionalParams` class to know which kwargs are accepted. Those type hints do not change between requests. The resolution was costing ~80 microseconds per request — small in isolation, real at 195 req/s. We memoize the resolved hints per provider class.

**Redundant `strip_empty_text_blocks` scan.** The async wrapper already sanitizes empty text blocks out of the assistant message before it hits the handler. The handler was running the same scan again on the same sanitized input. Now it does not.

### 3. End-of-stream reconstruction was O(output_tokens)

`stream_chunk_builder` assembles the final `ModelResponse` from the raw SSE stream by constructing a `ModelResponseStream` for every chunk and folding them together. For an Anthropic text-only response with N output tokens, that is roughly N Pydantic constructions, each with its own validation pass, just to throw the intermediate objects away.

Anthropic text streams are dominated by long runs of `content_block_delta` events that differ only in their `text` field. We collapse those runs into a single equivalent SSE event before `stream_chunk_builder` ever sees them, so the builder operates on O(content_blocks) chunks instead of O(tokens) chunks.

Tool-use, thinking blocks, and citations break the homogeneous-run assumption, so any non-text `content_block_delta` falls back to the unchanged legacy path. Long pure-text completions are the case that gets faster; everything else gets the same code path it always had.

<!-- TODO(yassin): replace with reconstruction diagram /img/blog/anthropic_messages_streaming_perf/reconstruction.png -->

### 4. Logging on the hot path

The streaming hot path had a handful of debug log lines like:

```python
verbose_logger.debug(f"streaming chunk: {chunk}")
```

`verbose_logger.debug(...)` is a no-op when the logger is not at DEBUG. The f-string is not — Python evaluates the entire format expression before the function is called, which means serializing `chunk` (and sometimes the full message buffer) on every chunk at non-debug levels. Gating each call behind `verbose_logger.isEnabledFor(logging.DEBUG)` keeps the call sites readable and stops paying the format cost when nobody is reading.

Two smaller wins:

- `cost_injection_active` was being recomputed per chunk inside the streaming loop. It is a per-request property; hoisted out of the loop, computed once.
- The SSE generator had an extra async-generator layer that wrapped every chunk in an outer generator before `yield`-ing it. Removing the extra layer drops one `asend()` per chunk.

## Parity, not approximation

Every fast path is gated on a precondition (no agentic hook override, no tracing, only text deltas, etc.). If the precondition fails, the request takes the legacy path that was there before. That is the only contract: same byte output, same logged payload, same billed token count.

The PR adds two layers of test for that:

1. **Parity tests.** Run the same request through the legacy path and the fast path, assert the streamed wire bytes are identical and the logged/billed payloads are identical. These run in CI for every change.
2. **Unit tests.** Targeted tests for the precondition checks themselves: detecting whether any callback overrides the agentic hook, confirming the memoized type-hint cache returns the same shape as a cold lookup, and confirming the pre-serialized body and the upstream-forwarded body are byte-identical.

If a future change accidentally takes the fast path on a tool-use stream — or vice versa — these tests fail loudly.

## Reproducing the benchmark

The proxy ships with the benchmark harness used to produce the numbers in this post. It boots a local mock Anthropic SSE provider plus the proxy on the same host, fires concurrent streaming requests, and reports TTFT percentiles and tokens/second.

```bash
uv run python scripts/benchmark_anthropic_messages_perf.py \
    --label baseline \
    --proxy-port 4099 --provider-port 8098 \
    --requests 500 --concurrency 20 --warmup 80 --repeats 5

# then check out the optimized commit and re-run with --label optimized
uv run python scripts/benchmark_anthropic_messages_perf.py \
    --label optimized \
    --proxy-port 4099 --provider-port 8098 \
    --requests 500 --concurrency 20 --warmup 80 --repeats 5
```

The harness writes per-run JSON so you can re-aggregate without re-running, and it runs both legs of the comparison back-to-back on the same machine to keep noise comparable. Running it on your hardware will give different absolute numbers — what should stay stable is the relative shape of the win: bigger reduction on the tails (p95, p99) than on the median, because the wins come from removing work that scales with chunk count and request count.

## Key takeaways

- The biggest streaming wins came from **not doing work that nobody asked for**: skipping hooks that were no-ops, skipping reconstruction that was thrown away, skipping the second pass over already-sanitized input.
- Long pure-text streams are dominated by **end-of-stream reconstruction cost** when every chunk becomes a Pydantic model. Collapsing homogeneous chunks before reconstruction turns an O(tokens) cost into an O(content_blocks) one.
- Hot-path debug logging is silent at runtime but **not free** — the format expression evaluates before the log function is called. Gate on `isEnabledFor(DEBUG)`.
- Parity tests are the contract. **Fast paths** are only safe if they fall back to legacy on anything they did not anticipate, and CI keeps proving that.

## Conclusion

The proxy still does exactly what it did before — same SSE bytes, same callback payloads, same billed spend. It just stops doing that work several times per request and several times per chunk when the result is already known to be discarded. The full PR with the parity tests and the benchmark script is in [BerriAI/litellm#28289](https://github.com/BerriAI/litellm/pull/28289).
