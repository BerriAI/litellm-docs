---
title: Model optimizations demo
description: Explore Live, Shadow, and Offline model comparisons with sample traffic and results.
slug: /proxy/lens/model-optimizations-demo
---

# Model optimizations demo

{/* keep-version-note: This walkthrough runs the Lens source demo, independent of a LiteLLM release. */}

Run the actual LiteLLM gateway dashboard with the local Lens package. Lens's existing **Demo data** mode provides synthetic traffic, comparisons, datasets, and runner connections

The demo starts with four completed optimizations, each for a different agent: support with live user feedback, sales with a live LLM judge, research with Shadow, and release reviews with Offline

## Start locally

Use Node 24.14.1 or newer, npm 11.10.0 or newer, Docker, and a separate LiteLLM development checkout with its dashboard dependencies and proxy Python environment installed. The proxy source needs its normal Rust extension and Prisma client. Keep this checkout separate from a daily-use gateway

From the Lens repository:

```sh
npm ci
export LENS_GATEWAY_SOURCE=/path/to/litellm
export LENS_GATEWAY_PYTHON=/path/to/litellm/.venv/bin/python
npm run demo:gateway
```

Open [the local gateway](http://127.0.0.1:3100/). The launcher signs into a dedicated local demo gateway and opens its regular Lens page. Keep the terminal open; press Ctrl+C to stop the gateway and dashboard

The launcher installs the local Lens package in the gateway checkout's `node_modules`. It leaves gateway source and package manifests unchanged. The gateway has a dedicated Postgres container. Credentials are generated for the running session and never written to configuration files. No model provider is configured

If the dashboard checkout uses a separate prepared proxy checkout, set `LENS_GATEWAY_BACKEND_SOURCE` to that checkout. `LENS_DEMO_PORT` changes the starting port; the dashboard, gateway, and database ports are derived from it. Diagnostic logs live in `.lens-dev/gateway-demo/gateway.log`

## Rehearse

1. Open **Model optimizations** and inspect any completed example
2. Choose **New optimization > Live**. Set the agent, traffic percentage, and model preset. Choose **User feedback** or **LLM judge**, then start. Judge sampling is under **Advanced**. Try **Pause**, **Resume**, and **Finish test**
3. Choose **New optimization > Shadow**. Select models and start. Lens compares the final model call with the recorded trace context
4. Open **Datasets > Customer support > Optimize models**. Keep **Final model call** and run the comparison. The batch completes automatically. Open a case to compare answers or follow **Open source trace**
5. Create an Offline comparison and select **Full agent > Connect agent**. Keep the example runner URL and choose **Connect runner**. Run the comparison to show the full-agent path. The connection and execution are simulated; no request is sent to the runner URL
6. Use **Start live test** from a Shadow or Offline result to carry its recommended model into Live setup

Presets exclude models unavailable to the selected agent. Case results include successful answers, quality regressions, and existing tool limitations. Serving costs and scores are synthetic

## Reset and persistence

Use **Reset demo** on the Model optimizations list before presenting. It restores the four completed examples and clears demo comparisons, runner connections, dataset edits, and eval definitions

Comparisons, connections, dataset revisions, and eval definitions persist in the browser. Offline batches resume when Model optimizations is opened. Live and Shadow traffic advances while that section is open

Datasets support edits, revision history, adding trace cases, and JSONL export. The existing Evals section includes a sample eval and a simulated **Run eval** action. Findings and signal settings can be changed within the demo session

The product changes live in the Lens UI package and load through the gateway's existing `EmbeddedLens` integration. Restart the launcher after editing Lens source to refresh the installed package
