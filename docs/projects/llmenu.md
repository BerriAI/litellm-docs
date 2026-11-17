# llmenu

{/* keep-version-note */}

[llmenu](https://github.com/schowave/llmenu) is an open-source CLI for teams that reach their models through a LiteLLM proxy. It reads the proxy's model list from `/model/info`, shows context window, input and output prices and benchmark scores side by side in a terminal menu, and starts Claude Code, Codex CLI or GitHub Copilot CLI with the model you pick. For opencode and pi it writes the proxy's models, limits and prices into their configs.

Install it and point it at your proxy:

```bash
brew install --cask schowave/tap/llmenu   # or: go install github.com/schowave/llmenu/cmd/llmenu@latest
llmenu setup     # proxy URL and key; the key goes into the OS keyring
llmenu claude    # pick a model, then Claude Code starts against the proxy
```

`llmenu project` stores one virtual key per project or cost center and switches between them. The menu and Claude Code's status line show the budget of the key in use, read from `/key/info` and `/user/info`, so no admin rights are needed.

See the [project repository](https://github.com/schowave/llmenu) and the [website](https://schowave.github.io/llmenu/).
