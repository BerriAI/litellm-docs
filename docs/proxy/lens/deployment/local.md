---
title: "Start Lens"
description: "Start Lens with one Docker Compose file, sign in, and look at traces. No LiteLLM gateway, Kubernetes, or Git checkout is needed."
slug: "/proxy/lens/deployment/local"
---

# Start Lens

Start Docker, then run this in an empty folder:

```sh
curl -fsSLO https://raw.githubusercontent.com/BerriAI/lens/main/deploy/lens/compose.yaml && docker compose up --wait
```

The command returns when Lens is ready, in under a minute. Then print your sign-in token, open [http://localhost:4318/ui/](http://localhost:4318/ui/), and paste the token into the **Setup token** field:

```sh
grep LENS_ADMIN_TOKEN .env
```

To look around without a token, select **Explore demo data** on the sign-in page.

You need Docker with Docker Compose 2.24 or newer, and Docker must be running. You do not need Git, LiteLLM, Kubernetes, PostgreSQL, or a model key.

## 1. Start

The line above is these two steps. The first downloads one [Compose file](https://github.com/BerriAI/lens/blob/main/deploy/lens/compose.yaml), and the second starts Lens and ClickHouse from published images:

```sh
curl -fsSLO https://raw.githubusercontent.com/BerriAI/lens/main/deploy/lens/compose.yaml
docker compose up --wait
```

Lens generates its own credentials on the first start and saves them in `.env` beside the Compose file.

## 2. Sign in

In the same folder, print the token that Lens generated:

```sh
grep LENS_ADMIN_TOKEN .env
```

Open [http://localhost:4318/ui/](http://localhost:4318/ui/), paste the value after `LENS_ADMIN_TOKEN=` into the **Setup token** field, and select **Sign in**. To skip the token, select **Explore demo data** on the same page. It opens Lens with sample data only.

![Lens sign-in page with a field for the setup token.](/img/lens/quickstart-signin.webp)

## 3. See traces

Turn on **Demo data** in the top right to look around. To record your own agent, follow [Send your first trace](../first-trace.md).

![Lens Traces page with Demo data turned on, listing sample support agent runs.](/img/lens/quickstart-demo-traces.webp)

Select a run to see its steps, input, and output.

![A sample run open in Lens, showing its steps, the user input, and the assistant output.](/img/lens/quickstart-demo-trace.webp)

Stop Lens with `docker compose down`. Your data is kept; adding `--volumes` deletes it.

Next: [Claude Code and Codex setup](../coding-agents.md), [run Lens on a server](./server.md), or [add Lens to LiteLLM](./litellm.md). If the start fails, see [Troubleshooting](./configuration.md#troubleshooting).
