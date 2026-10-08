---
title: "Local quickstart"
description: "Start LiteLLM and Lens on your computer and send a test trace."
slug: "/proxy/lens/deployment/local"
---

# Local quickstart

This local setup starts LiteLLM, Lens, PostgreSQL, and ClickHouse together. You need Git, Python {{python_min_version}} or later, and Docker with Compose. Start Docker before running the commands.

## 1. Get the configuration

Select a [release with published Lens images](./releases.md). Replace `RELEASE_VERSION` with its version without the `v` prefix, then clone that release:

```bash
export LITELLM_VERSION="RELEASE_VERSION"
git clone --depth 1 --branch "v${LITELLM_VERSION}" https://github.com/BerriAI/litellm.git
cd litellm
```

Generate the configuration:

```bash
python3 deploy/lens/configure.py --version "$LITELLM_VERSION"
```

This saves private credentials in `deploy/lens/.env`. Back up that file with your databases. Running the command again preserves the credentials.

## 2. Start the services

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

Docker downloads the images and starts the services. Check their status:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml ps
```

`litellm` and `lens-worker` should be running. `db` and `clickhouse` should be healthy. If a service exits, [check its logs](./configuration.md#troubleshooting).

This stack binds to localhost and stores data in persistent volumes. For agents on other machines, use [Kubernetes](./kubernetes.md) or [Docker Compose on a server](./server.md).

## 3. Open Lens

1. Open [http://localhost:4000/ui/](http://localhost:4000/ui/).
2. Sign in as `admin`. Use the `LITELLM_MASTER_KEY` value from `deploy/lens/.env` as the password.
3. Open **Lens**, then **Set up Lens**. Under **Send your first trace**, choose your framework and click **Generate tracing key**.
4. Click **Copy tracing configuration**, then follow the displayed installation and code snippets in your agent's project.

To check tracing before running an agent, click **Send a test trace** under **Connection details**, then **View trace**. This does not call a model or require a provider key.

Your trace endpoint is `http://localhost:4318/v1/traces`. Model requests use `http://localhost:4000`. To run an agent through this gateway, first add a provider model under **Models** and create a model key under **Virtual Keys**. The [first-trace examples](../first-trace.md) show how to name your agent and record its steps.

To stop the stack while keeping your data, run:

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml down
```

To start it again, repeat the `up -d --wait` command with the same environment file. Do not add `-v` to `down` unless you intend to delete the database volumes.
