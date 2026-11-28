# Akmatori

{/* keep-version-note */}

[Akmatori](https://github.com/akmatori/akmatori) is an open-source (Apache-2.0), self-hosted AI SRE agent. It receives alerts from Alertmanager, Grafana, PagerDuty, Zabbix or Datadog, investigates each one with tools such as SSH, Kubernetes and metrics queries, and runs remediation only after a human approves it.

Akmatori talks to any OpenAI-compatible endpoint through its Custom provider, so a LiteLLM proxy lets it use Ollama, vLLM, Azure OpenAI, Bedrock or Vertex AI models with central keys, budgets and spend logs. In Akmatori, open Settings, then AI models, add a Custom configuration, set the Base URL to the proxy with `/v1` (for example `http://litellm:4000/v1`), the API key to a LiteLLM virtual key, and the model to a `model_name` from the proxy config.

```yaml
model_list:
  - model_name: sre-agent
    litellm_params:
      model: ollama_chat/qwen3:30b-a3b
      api_base: http://ollama:11434

litellm_settings:
  drop_params: true
```

Keep `drop_params: true` for `ollama_chat/` models. Akmatori sends OpenAI request fields such as `store`, which `ollama_chat` rejects with `UnsupportedParamsError` otherwise. The investigation agent relies on tool calls, so the model behind the alias must support them.

See the [Akmatori local models guide](https://akmatori.com/docs/local-models) for Docker networking, context length and tested models.
