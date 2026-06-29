# LiteLLM Rust gateway benchmark

Reproducible harness for the numbers in the blog post *Migrating LiteLLM to Rust*.
It measures per-request gateway forwarding overhead for a thin Rust gateway versus
the LiteLLM Python path, against the same local mock upstream.

## What it measures

- Per-request overhead (median), Rust gateway vs LiteLLM (Python), at 10 concurrent
  clients against a local mock upstream.
- The Rust side is a thin axum forwarding gateway with a light request transform.
- The Python side is `litellm.acompletion` served over uvicorn (the same ASGI stack
  the proxy uses), so it exercises LiteLLM's real transform and cost path.

## Files

- `main.rs` / `Cargo.toml` — mock upstream, the Rust gateway, and a microsecond
  resolution load client. Modes: `mock`, `gateway`, `bench <url> <total> <conc>`.
- `llm_app.py` — the LiteLLM (Python) request path over uvicorn.
- `orchestrate_compare.py` — starts all three, runs the load, prints median and p95
  overhead plus peak RSS.

## Run

```bash
cargo build --release
# Use a Python that has litellm + fastapi + uvicorn installed:
LITELLM_PYTHON=/path/to/venv/bin/python python3 orchestrate_compare.py
```

## Result (reference run)

| | Per-request overhead (median) |
|---|---|
| Rust gateway | ~0.05ms |
| LiteLLM (Python) | ~7.5ms |

Numbers vary by machine; the methodology is what travels. Same upstream and payload
for both runtimes; the only variable is Python versus Rust.
