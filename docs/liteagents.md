---
id: liteagents
title: liteagents SDK
sidebar_label: liteagents SDK
description: Switch between DeepAgents, Pydantic AI, Claude Agent SDK, Codex, and OpenCode through one Python SDK, with the same application code and your choice of model.
---

# liteagents SDK

liteagents lets you switch between **DeepAgents, Pydantic AI, Claude Agent SDK, Codex, and OpenCode** through one Python SDK. Pick a harness and a model, run your agent, then change `harness` to try another framework with the same application code.

:::info[Preview]
liteagents is in beta. This preview installs from a GitHub release wheel because the PyPI name belongs to a different package. The source, the full SDK reference, and the cookbooks are in the [liteagents repository](https://github.com/BerriAI/liteagents).
:::

[GitHub](https://github.com/BerriAI/liteagents) · [Product page](https://www.litellm.ai/liteagents) · [Introducing LiteAgents](/blog/liteagents-sdk)

## How it works

`your app → liteagents → selected harness → LiteLLM → model provider`

The harness owns the agent loop. liteagents translates shared configuration, tools, and MCP for it, then normalizes the output. LiteLLM's Python SDK handles model-provider translation. Harness-specific controls remain available through `profile.harness_options`.

The streaming and conversation interface is modeled after the Claude Agent SDK, with `query()`, `LiteAgentClient`, `AssistantMessage`, and `TextBlock`. These types come from `liteagents` and work across harnesses.

## Quickstart

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/BerriAI/liteagents/blob/main/cookbook/recipes/00_agent.ipynb)

### 1. Install

liteagents requires Python 3.11 or later. This command installs liteagents and the two harnesses used below: {/* keep-python-version */}

```sh
python -m pip install "liteagents[pydantic-ai,claude-sdk] @ https://github.com/BerriAI/liteagents/releases/download/v0.3.0a6/liteagents-0.3.0a6-py3-none-any.whl"
```

No repository checkout, gateway, or Temporal service is needed.

### 2. Set your API key

Use an [OpenAI API key](https://platform.openai.com/api-keys) with API credit:

```sh
export OPENAI_API_KEY="your-openai-key"
```

### 3. Run an agent

Save this as `agent.py` and run `python agent.py`. It prints the agent's answer.

```python
import asyncio
from liteagents import ProfileOptions, run

profile = ProfileOptions(
    harness="pydantic-ai",
    model="openai/gpt-5.4-mini",
)
prompt = "Explain what an agent harness does in one sentence."

async def main():
    result = await run(prompt, profile=profile)
    print(result.text)

asyncio.run(main())
```

`harness` chooses the agent framework. `model` chooses the model it calls. LiteLLM's Python SDK connects to the provider with your key. In Colab, use `await main()` instead of `asyncio.run(main())`.

### 4. Switch the harness

Change `harness="pydantic-ai"` to `harness="claude-sdk"` and run the same example. Claude Agent SDK now runs your prompt with the same OpenAI model and key. The response still comes back as `result.text`.

```python
profile.harness = "claude-sdk"
result = await run(prompt, profile=profile)
print(result.text)
```

Each `run()` is an independent task. Switching does not transfer a running session. For follow-up turns with shared history, keep a `LiteAgentClient` open.

## Use another provider

Set the matching key and change `profile.model`. The harness can stay the same.

| Provider | Model example | Key |
| --- | --- | --- |
| OpenAI | `openai/gpt-5.4-mini` | `OPENAI_API_KEY` |
| Anthropic | `anthropic/claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| OpenRouter | `openrouter/anthropic/claude-sonnet-4.6` | `OPENROUTER_API_KEY` |
| Google Gemini | `gemini/gemini-2.5-flash` | `GEMINI_API_KEY` |
| Groq | `groq/llama-3.3-70b-versatile` | `GROQ_API_KEY` |

[Model setup](https://github.com/BerriAI/liteagents/blob/main/docs/models.md) covers these providers plus Mistral, DeepSeek, Together AI, xAI, Azure, Bedrock, Vertex AI, and Ollama. Choose a model that is enabled for your account and that supports the tools and settings you use.

## Install other harnesses

Select the integrations you need in the square brackets of the install command. liteagents reuses compatible packages that are already installed and does not download harnesses during a run.

| Harness | Install extra |
| --- | --- |
| `deepagents` | `deepagents` |
| `pydantic-ai` | `pydantic-ai` |
| `claude-sdk` | `claude-sdk` |
| `codex` | `codex` |
| `opencode-v1` / `opencode-v2` | Either selector, plus `npm install -g opencode-ai@1.18.29` |

The Claude and Codex extras include their runtimes. `[all]` installs all Python integrations.

## Add your own tools

Pass typed Python functions. liteagents generates the schema and adapts the same tools to each harness:

```python
def lookup_order(order_id: str) -> str:
    """Look up an order's payment status and total."""
    return f"Order {order_id}: paid, total USD 12"

result = await run("Look up order A123.", profile=profile, tools=[lookup_order])
print(result.text)
```

Regular and `async` functions work. Type hints describe the inputs, and a docstring describes the tool. MCP servers go in `profile.mcp_servers`.

## Use a LiteLLM Gateway

If you already use a gateway, set its model alias, endpoint, and key in the profile:

```python
from getpass import getpass

profile = ProfileOptions(
    harness="pydantic-ai",
    model="my-model",
    model_kwargs={
        "api_base": "https://your-gateway.example/v1",
        "api_key": getpass("Gateway API key: "),
    },
)
```

The alias is sent unchanged, including slashes. Your application uses the gateway key instead of provider keys, so the gateway applies its budgets, logging, and guardrails to each agent turn.

## Next steps

| Try | Walkthrough |
| --- | --- |
| Give the agent a Python tool | [Look up an order](https://colab.research.google.com/github/BerriAI/liteagents/blob/main/cookbook/recipes/08_application_tools.ipynb) |
| Stream output and keep conversation history | [Streaming and conversations](https://colab.research.google.com/github/BerriAI/liteagents/blob/main/cookbook/recipes/01_quickstart.ipynb) |
| Connect an MCP server | [MCP tools](https://colab.research.google.com/github/BerriAI/liteagents/blob/main/cookbook/recipes/02_mcp.ipynb) |
| Keep native controls or load JSON and YAML profiles | [Profiles](https://github.com/BerriAI/liteagents/blob/main/docs/profiles.md) |
| Recover work after a worker stops | [Temporal walkthrough](https://colab.research.google.com/github/BerriAI/liteagents/blob/main/cookbook/recipes/06_durable.ipynb) |

The [SDK reference](https://github.com/BerriAI/liteagents/blob/main/docs/sdk.md) covers `run()`, `query()`, `start_run()`, streaming events, approvals, and durable runs.
