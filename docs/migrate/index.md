---
title: Migrate to LiteLLM
sidebar_label: Overview
description: Step-by-step guides and agent skills for moving to a self-hosted LiteLLM gateway from another AI gateway, keeping the model names and keys your apps already use.
---

# Migrate to LiteLLM

Each guide moves one gateway onto LiteLLM with as little client change as possible: your apps keep the model names they already send, and usually only the base URL and API key change. Every guide comes with an agent skill that reads your existing config or code and writes the LiteLLM `config.yaml` for you, and links a 1-click hosted deploy if you would rather not run Docker.

| Moving from | What carries over | Agent skill |
|---|---|---|
| [Bifrost](./bifrost.md) | `provider/model` names, `sk-bf-*` virtual key values, weights, budgets, rate limits, routing rules | `curl -fsSL https://docs.litellm.ai/skills/bifrost-migration` |
| [OpenRouter](./openrouter.md) | Every model ID, including variants, with OpenRouter kept as an upstream until you move models to direct providers | `curl -fsSL https://docs.litellm.ai/skills/openrouter-migration` |

To run a skill, tell Claude Code, Codex, or Cursor `run curl -fsSL <skill URL> and follow the instructions`. The skill asks before writing any file and never puts provider keys in the config. All skills are also listed on [Agent resources](../agent_resources.md).

Moving from a gateway that is not listed here? The [Quickstart](../proxy/docker_quick_start.md) and the [config.yaml reference](../proxy/configs.md) cover the same ground, or [talk to us](https://www.litellm.ai/enterprise#talk-to-sales) about help with a larger migration.
