---
title: "Start Lens"
description: "Start Lens with Docker Compose, sign in, and look at traces. No LiteLLM gateway or Kubernetes is needed."
slug: "/proxy/lens/deployment/local"
---

# Start Lens

You need Git and Docker with Docker Compose 2.24 or newer. You do not need LiteLLM, Kubernetes, PostgreSQL, or a model key.

## 1. Start

```sh
git clone https://github.com/BerriAI/lens.git
cd lens
docker compose up --wait
```

The command returns when Lens is ready, in under a minute.

## 2. Sign in

Open [http://localhost:4318/ui/](http://localhost:4318/ui/) and paste the `LENS_ADMIN_TOKEN` value from `deploy/lens/.env`.

## 3. See traces

Turn on **Demo data** in the top right to look around. To record your own agent, follow [Send your first trace](../first-trace.md).

Stop Lens with `docker compose down`. Your data is kept; adding `--volumes` deletes it.

Next: [Claude Code and Codex setup](../coding-agents.md), [run Lens on a server](./server.md), or [add Lens to LiteLLM](./litellm.md). If the start fails, see [Troubleshooting](./configuration.md#troubleshooting).
