# LiteLLM Lens

Agent tracing + insights at scale.

1. Download the [compose file](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.lens.yml):

   ```bash
   curl -O https://raw.githubusercontent.com/BerriAI/litellm/main/docker/docker-compose.lens.yml
   ```

2. Start it:

   ```bash
   export OPENAI_API_KEY=sk-...
   docker compose -f docker-compose.lens.yml up
   ```

3. Send traces (OTLP/HTTP) to `POST http://localhost:4000/v1/traces` with `Authorization: Bearer sk-1234`.

4. Open `http://localhost:4000/ui/?page=logs` (login: `admin` / `sk-1234`).

Set `LITELLM_PORT` to use a different port.
