---
title: "Build from source"
description: "Develop standalone Lens with its Rust backend, ClickHouse and shared UI."
slug: "/proxy/lens/deployment/development"
---

# Build from source

For optional help from your coding agent, [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md) has prompts for an existing LiteLLM deployment, standalone Lens, and external ClickHouse. The agent should inspect the installed version before applying this guide

Develop Lens from the public [Lens repository](https://github.com/BerriAI/lens). It owns the Rust backend and the shared UI that LiteLLM embeds. You can develop and run it with ClickHouse without a gateway or PostgreSQL

## Start a development environment {#local-development}

Install Git, Docker with Compose v2, Node.js 24.14.1 or newer, and npm 11.10.0 or newer. From a fresh checkout:

```sh
git clone https://github.com/BerriAI/lens.git
cd lens
npm ci
npm run dev
```

The first start builds Lens, generates private credentials in `deploy/lens/.env`, starts Lens and ClickHouse, and starts the UI at [http://127.0.0.1:3100/ui/](http://127.0.0.1:3100/ui/). Sign in using `LENS_ADMIN_TOKEN` from that file. Read it locally and keep it out of shared logs. UI changes reload automatically, and the development server forwards API requests to the Lens container

Open **Traces**, choose **Set up tracing**, select your framework and create a tracing key. Run your agent with the generated configuration, then use **Check for traces** and open the matching run. Provider configuration is only needed when you enable investigations or Signals

If port 4318 is occupied, use `LENS_PORT=4320 LENS_DEV_API_URL=http://127.0.0.1:4320 npm run dev`. The UI uses port 3100, so stop any previous preview using that port first

## Try backend changes

From the Lens repository root, build the complete runtime image and start it with the development UI:

```sh
docker build --build-arg LENS_VERSION=local-test \
  -f deploy/runtime/Dockerfile -t lens:local-test .
LENS_IMAGE=lens:local-test npm run dev
```

Repeat the build and restart after changing Rust code. The container includes the static UI and the native Linux calculation sandbox used by investigations. See [Developing Lens](https://github.com/BerriAI/lens/blob/main/CONTRIBUTING.md) for the Rust toolchain, focused checks, UI package checks and repository layout

## Stop and resume

Ctrl-C stops the UI development server. Stop Lens and ClickHouse while retaining their data with:

```sh
docker compose -f deploy/lens/compose.yaml stop
```

Run `npm run dev` again to resume. Keep the environment file and ClickHouse volume so your credentials and saved records survive

For the source installation without development tooling, use [Run Lens](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md). That guide also states the current published-release status. Official paired releases use the same Lens and LiteLLM version; connecting a gateway requires the compatible adapter and credentials described in the [gateway integration guide](./docker-compose.md)
