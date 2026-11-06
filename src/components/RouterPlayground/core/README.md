# Router playground core

This crate compiles the LiteLLM router core (`litellm-router-core`) to WebAssembly for the
[router playground](../index.js). It supplies the host the core asks for
everything outside itself: attempts follow each deployment's script or `mock_response` instead of
calling a provider, sleeps move a virtual clock forward, and the routing cache lives in memory on
that clock, so cooldowns and per-minute usage expire as simulated time passes.

## Simulation

Besides single calls (`send`), a `Playground` runs Poisson traffic with many calls in flight on
simulated time. Each deployment gets a profile: lognormal latency from `p50_ms` and `p95_ms`, an
`error_rate` whose failures take a class drawn from `errors` (`{"RateLimitError": 3,
"InternalServerError": 1}`), and the provider's own `rpm_cap` and `tpm_cap` (each request costs
`tokens`, 1000 by default). Incidents (`{key, id, from, to, latency_factor, error_rate, rpm_cap,
tpm_cap, outage}`) make one deployment worse for a stretch of time.

`simulate(spec)` runs a whole scenario at once. `simStart(spec)`, `simAdvance(seconds)`,
`simSet(change)` and `simStop()` run one step by step: each advance returns the requests that
completed with their attempts, every deployment's cooldown, usage and attempts in flight, and
marks for cooldowns, first fallbacks and incidents. `simTrace(id)` returns a recent request's
trace in the shape `send` returns, so the state diagram draws it. All of it replays exactly from
the seed, the spec and the times of the `simSet` calls. JSON in and out; see `src/lib.rs` for
the fields.

The built files are checked in under `static/router-playground/`, so the docs build never needs
Rust.

## Rebuild

Check out BerriAI/litellm main next to this repo (so `../litellm` from the litellm-docs root), then run from
this directory:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.126 --locked
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir ../../../../static/router-playground \
  "${CARGO_TARGET_DIR:-target}/wasm32-unknown-unknown/release/router_playground.wasm"
rm ../../../../static/router-playground/*.d.ts
```

The checked-in build comes from litellm main at 62823005.
