# Router playground core

This crate compiles the LiteLLM router core (`litellm-router-core`) to WebAssembly for the
[router playground](../index.js). It supplies the host the core asks for
everything outside itself: attempts follow each deployment's script or `mock_response` instead of
calling a provider, sleeps move a virtual clock forward, and the routing cache lives in memory on
that clock, so cooldowns and per-minute usage expire as simulated time passes.

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
