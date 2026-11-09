# llmledger

[llmledger](https://github.com/pouriaetab/llmledger) is an open-source price history for LiteLLM's model catalogue. Every day it reads the full git history of [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) and publishes a [free page](https://pouriaetab.github.io/llmledger/) with each listing's current price, every price change, retirement date and removal since 2023, and how likely a price is to change next. It joins the prices with the Arena leaderboard to suggest a model for a prompt and estimate what it costs.

Its MCP server, [`llmledger-mcp`](https://pypi.org/project/llmledger-mcp/), answers the same questions inside any MCP client, with nothing to host and no keys. In Claude Code:

```bash
claude mcp add llmledger -- uvx llmledger-mcp
```

To offer it to a whole team through the [LiteLLM MCP gateway](../mcp.md), add it as a stdio server and start the proxy with `LITELLM_ENABLE_MCP_STDIO=true`:

```yaml
mcp_servers:
  llmledger:
    transport: "stdio"
    command: "uvx"
    args: ["llmledger-mcp"]
```

Clients then see five read-only tools: `suggest_for_project`, `compare_models`, `estimate_cost`, `find_models` and `price_history`.
