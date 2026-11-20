---
title: "Start Lens"
description: "Start Lens with one Docker Compose file, sign in, and look at traces. No LiteLLM gateway, Kubernetes, or Git checkout is needed."
slug: "/proxy/lens/deployment/local"
---

# Start Lens

Start Docker, then run this in an empty folder:

```sh
curl -fsSLO https://raw.githubusercontent.com/BerriAI/lens/main/deploy/lens/compose.yaml && docker compose up --wait && docker compose logs -n1 credentials
```

It finishes in under a minute and prints the address to open and your setup token:

```
credentials-1  | Open http://localhost:4318/ui/ and paste this setup token: <your token>
```

Open [http://localhost:4318/ui/](http://localhost:4318/ui/), paste the token into the **Setup token** field, and select **Sign in**. To look around without a token, select **Explore demo data** on the same page.

![Lens sign-in page with a field for the setup token.](/img/lens/quickstart-signin.webp)

You need Docker with Docker Compose 2.24 or newer, and Docker must be running. You do not need Git, LiteLLM, Kubernetes, PostgreSQL, or a model key. The command downloads one [Compose file](https://github.com/BerriAI/lens/blob/main/deploy/lens/compose.yaml) and starts Lens and ClickHouse from published images. Lens generates its credentials on the first start and saves them in `.env` beside that file, where the token is `LENS_ADMIN_TOKEN`.

## See traces

Turn on **Demo data** in the top right. Lens opens **Traces** with sample runs to look around. To record your own agent, follow [Send your first trace](../first-trace.md).

![Lens Traces page with Demo data turned on, listing sample support agent runs.](/img/lens/quickstart-demo-traces.webp)

Select a run to see its steps, input, and output.

![A sample run open in Lens, showing its steps, the user input, and the assistant output.](/img/lens/quickstart-demo-trace.webp)

Stop Lens with `docker compose down`. Your data is kept; adding `--volumes` deletes it.

Next: [Claude Code and Codex setup](../coding-agents.md), [run Lens on a server](./server.md), or [add Lens to LiteLLM](./litellm.md). If the start fails, see [Troubleshooting](./configuration.md#troubleshooting).
