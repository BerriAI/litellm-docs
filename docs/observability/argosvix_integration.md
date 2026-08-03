import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Argosvix

:::tip

This is community maintained. Please make an issue if you run into a bug:
https://github.com/BerriAI/litellm

:::

[Argosvix](https://argosvix.com) is an observability service for AI agents and
LLM applications: it records cost, tokens, latency, errors and quality for
every LLM call, watches the records with a built-in AI, and lets you operate
everything in conversation over MCP.

The integration is a LiteLLM `CustomLogger` shipped with the `argosvix`
package — register it once and every completion (sync, async, streaming, and
failures) is recorded.

## Quick Start

Get an API key in the [Argosvix dashboard](https://dashboard.argosvix.com), then:

```shell
pip install argosvix
```

<Tabs>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
import litellm
from argosvix.litellm_callback import ArgosvixLogger

# reads ARGOSVIX_API_KEY from the environment
litellm.callbacks = [ArgosvixLogger()]

response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "hi"}],
)
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

Create `custom_callbacks.py` next to your `config.yaml`:

```python
from argosvix.litellm_callback import ArgosvixLogger

argosvix_logger = ArgosvixLogger()  # reads ARGOSVIX_API_KEY
```

Reference it in `config.yaml`:

```yaml
litellm_settings:
  callbacks: custom_callbacks.argosvix_logger
```

Start the proxy with the Argosvix key in the environment:

```shell
ARGOSVIX_API_KEY="argk_..." litellm --config config.yaml
```

</TabItem>
</Tabs>

## What gets logged

- Provider, model, prompt / completion / total tokens, cached tokens
- Cost — LiteLLM's own `response_cost` when available, with a fallback to the
  Argosvix pricing table; cache hits are recorded at $0.00
- Latency and errors, including failed streams with their partial usage

Calls are recorded for OpenAI (incl. Azure), Anthropic, Google Gemini
(incl. Vertex), Mistral, and xAI Grok. Calls to other providers run normally
but are not recorded — a one-time warning per provider is printed.

Recording is best-effort and never breaks the LLM call. In short-lived
processes call `logger.flush()` before exit.

## Support

- Docs: https://argosvix.com/en/docs/sdk-reference
- Contact: hello@argosvix.com
