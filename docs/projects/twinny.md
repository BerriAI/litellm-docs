# twinny

[twinny](https://github.com/twinnydotdev/twinny) is a free, MIT-licensed VS Code extension for code completion (fill-in-the-middle), chat, inline edit, workspace search, code review and commit messages. It works with any OpenAI-compatible server, so it can use any model a LiteLLM proxy routes to.

Start a proxy:

```bash
litellm --model ollama/qwen2.5-coder:7b-instruct --port 4000
```

In twinny, add a LiteLLM provider on port `4000`:

| Job | Path |
| --- | --- |
| Chat | `/v1` |
| Autocomplete | `/v1/chat/completions` |
| Embeddings | `/v1/embeddings` |

If the proxy has a master key, paste it into the provider's API key field. Autocomplete needs an upstream model that accepts a raw prompt, such as a base model served by Ollama.

See the [twinny LiteLLM guide](https://docs.twinny.dev/providers/other-local-servers/#litellm) and the [VS Code Marketplace listing](https://marketplace.visualstudio.com/items?itemName=rjmacarthy.twinny).
