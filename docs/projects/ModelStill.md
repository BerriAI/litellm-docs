# ModelStill

{/* keep-version-note */}

[ModelStill](https://github.com/modelstill/modelstill) is an open-source (Apache-2.0) CLI for checking model and prompt changes against recorded production calls. It works with a LiteLLM proxy in two ways.

Its LiteLLM custom provider puts a small model behind a model name your application already calls. The previous cloud deployment moves to a second model name, and a deployment file sets the mode: `off` sends every call to the cloud model, `shadow` also sends a sample of calls to the small model in the background and logs both answers, and `serve` returns the small model's answer when its confidence reaches a threshold and the cloud model's otherwise.

```yaml
model_list:
  - model_name: ticket-priority
    litellm_params:
      model: modelstill/ticket-priority
  - model_name: ticket-priority-cloud
    litellm_params:
      model: openai/{{openai_small}}
litellm_settings:
  custom_provider_map:
    - provider: modelstill
      custom_handler: modelstill_handler.handler
```

The plugin is installed in the proxy image, with `modelstill_handler.py` next to `config.yaml` and its own config file named by `MODELSTILL_LITELLM_CONFIG`. See the [plugin setup guide](https://docs.modelstill.com/guides/serve-with-litellm).

It also reads `LiteLLM_SpendLogs` exports into a dataset. Rows carry a prompt only when `general_settings.store_prompts_in_spend_logs` is true, and rows without one are skipped.

```bash
modelstill ingest litellm spend_logs.csv --out data/litellm.jsonl
```

See the [ModelStill LiteLLM docs](https://docs.modelstill.com/integrations/litellm) for both.
