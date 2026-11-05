# Router playground

Everything behind `/router-playground` lives in this folder, apart from the page frame in
`src/pages/router-playground.js` and the built core in `static/router-playground/`.

`index.js` is the playground component: config editor, deployments, request controls and state.
`Trace.js` renders one request's trace or a burst summary, `StateDiagram.js` steps through one
request as an environment diagram (frames per fallback level, deployments as objects, folded from the
trace), `Timeline.js` runs steady traffic with
scheduled outages on a fresh router and charts it per deployment over simulated time, `presets.js`
holds the starting configs and default outages,
`core.js` loads the WebAssembly core and parses the YAML config, and `styles.module.css` styles it
all. `core/` is the Rust crate that wraps `litellm-router-core` for the browser; its README says how
to rebuild the files in `static/router-playground/`.

Nothing here reimplements routing. Every pick, retry, cooldown and fallback comes from the router
core itself, so new behaviour belongs in the core or in the host in `core/src/lib.rs`, and new UI
belongs in this folder.
