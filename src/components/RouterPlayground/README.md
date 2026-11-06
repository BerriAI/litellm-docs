# Router playground

Everything behind `/router-playground` lives in this folder, apart from the page frame in
`src/pages/router-playground.js` and the built core in `static/router-playground/`.

`index.js` is the playground component: config editor, deployments, request controls and state.
`Trace.js` renders one request's trace or a burst summary, `StateDiagram.js` steps through one
request as an environment diagram (globals, frames per fallback level with pick and attempt frames,
deployments as objects, the host edge), `diagramModel.js` folds a trace into the diagram's per-step
states, `StateDiagram.module.css` styles it, and `presets.js` holds the starting configs and default
outages.

The simulator runs steady traffic through its own fresh router on simulated time with the core's
incremental API. `simSession.js` wraps that API (`simStart`, `simAdvance`, `simSet`, `simTrace`,
`simStop`) and turns profiles and incidents into what it takes. `profiles.js` holds the behaviour
profiles (latency, weighted error classes, provider rpm and tpm caps), which live in the playground
state and never in the YAML, and `ProfileEditor.js` edits one; the config editor shows it too.
`Simulator.js` holds the behaviour panel and the live run: Play and speed, traffic and surges,
incidents per deployment, KPIs, one lane per deployment drawn from 2 second bins, numbered marks for
incidents, cooldowns and the first fallback, and a click on a bar or tick opens that request through
`simTrace` in the state diagram. `Scenario.js` lays incidents out on a timeline, runs config A and an
edited copy B on the same scenario and seed, compares them, and carries the scenario in the URL hash.
`Simulator.module.css` styles all three. Elsewhere,
`core.js` loads the WebAssembly core and parses the YAML config, and `styles.module.css` styles it
all. The core's `describe()` reports the merged settings and deployments the diagram shows, and
only `simple-shuffle` is accepted, since the other strategies still run in Python. `core/` is the Rust crate that wraps `litellm-router-core` for the browser; its README says how
to rebuild the files in `static/router-playground/`.

Nothing here reimplements routing. Every pick, retry, cooldown and fallback comes from the router
core itself, so new behaviour belongs in the core or in the host in `core/src/lib.rs`, and new UI
belongs in this folder.
