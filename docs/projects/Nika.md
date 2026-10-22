
# Nika

[Nika](https://github.com/supernovae-st/nika) is an open-source (AGPL, Rust) workflow engine for AI: repeatable work lives in plain `.nika.yaml` DAG files, statically checked before execution (schema, permits, cost floor) with tamper-evident traces after.

Nika's provider layer speaks the OpenAI chat dialect, so a LiteLLM proxy slots in as the gateway: point Nika's `openai` provider at the proxy's base URL and every `infer` task in a workflow routes through LiteLLM — one gateway for keys, budgets and provider fallbacks, while Nika keeps the workflow-side guarantees (static checks before the run, hash-chained trace after).

- [Github](https://github.com/supernovae-st/nika)
- [Docs](https://docs.nika.sh)
- [Provider catalog (the `openai` + `base_url` mechanism)](https://docs.nika.sh/reference/providers-catalog)
