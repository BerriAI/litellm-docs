# LiteLLM Lens

Agent tracing + insights at scale.

![LiteLLM Lens architecture](/img/lens-architecture.svg)

**What Lens adds to the proxy** (green above):

- **ClickHouse**: stores agent traces and request spend
- **`POST /v1/traces`**: OTLP endpoint for your agent's spans
- **Agent Traces UI**: runs, spans, tokens and cost per request

1. Clone the repo and start [`docker-compose.tracing.yml`](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) (LiteLLM + Postgres + ClickHouse):

   ```bash
   git clone https://github.com/BerriAI/litellm.git
   cd litellm/docker
   export OPENAI_API_KEY=sk-...
   docker compose -f docker-compose.tracing.yml up --build
   ```

2. Send traces (OTLP/HTTP) to `POST http://localhost:4002/v1/traces` with `Authorization: Bearer local-tracing-master-key`.

3. Open `http://localhost:4002/ui/?page=logs` and select a run.
