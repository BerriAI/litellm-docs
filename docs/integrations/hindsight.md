import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hindsight Integration

[Hindsight](https://github.com/vectorize-io/hindsight) is an open-source long-term memory engine for LLM applications. The `hindsight-litellm` package adds persistent, cross-session memory to any of LiteLLM's 100+ providers: relevant memories are injected into your prompts before each call, and conversations are stored back to Hindsight afterward — automatically.

## What is Hindsight?

Hindsight gives your LLM app durable memory across sessions. With the LiteLLM integration you get:

- **Automatic memory injection** — relevant context is retrieved and added to the prompt before each `completion()` call.
- **Automatic conversation storage** — exchanges are stored back to Hindsight (async by default) so they can be recalled later.
- **Two retrieval modes** — `recall` (raw memories) or `reflect` (a synthesized, query-focused summary).
- **Works with every LiteLLM provider** — OpenAI, Anthropic, Azure, Bedrock, Vertex AI, Groq, and more.

It works against [Hindsight Cloud](https://hindsight.vectorize.io) out of the box, or against a self-hosted Hindsight server.

## Prerequisites

```bash
pip install hindsight-litellm
```

Get a free API key from [Hindsight Cloud](https://hindsight.vectorize.io), or run Hindsight [locally](https://github.com/vectorize-io/hindsight) and point at `http://localhost:8888`.

## Quick Start

`hindsight-litellm` wraps `litellm.completion`, so once it's enabled you keep calling LiteLLM exactly as before — memory injection and storage happen transparently.

<Tabs>
<TabItem value="cloud" label="Hindsight Cloud">

```python
import os
import litellm
import hindsight_litellm

os.environ["OPENAI_API_KEY"] = "your-openai-key"

# 1. Configure Hindsight (defaults to Hindsight Cloud)
hindsight_litellm.configure(
    api_key=os.environ["HINDSIGHT_API_KEY"],  # from https://hindsight.vectorize.io
)

# 2. Set the memory bank to read/write
hindsight_litellm.set_defaults(
    bank_id="my-agent",
    use_reflect=True,  # synthesize a focused context summary
)

# 3. Enable the integration (patches litellm.completion / acompletion)
hindsight_litellm.enable()

# 4. Use LiteLLM as normal — memory is injected and stored automatically
response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What did we decide about the database?"}],
    hindsight_query="database decisions",  # what to search memory for
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="selfhosted" label="Self-Hosted">

```python
import os
import litellm
import hindsight_litellm

os.environ["OPENAI_API_KEY"] = "your-openai-key"

# Point at your own Hindsight server instead of Hindsight Cloud
hindsight_litellm.configure(
    hindsight_api_url="http://localhost:8888",
)

hindsight_litellm.set_defaults(
    bank_id="my-agent",
    use_reflect=True,
)

hindsight_litellm.enable()

response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What did we decide about the database?"}],
    hindsight_query="database decisions",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

:::info
When `inject_memories` is enabled (the default), pass `hindsight_query` on each call to tell Hindsight what to search memory for. This keeps retrieval intentional and focused.
:::

## Memory Modes

Choose how retrieved memory is added to the prompt with `use_reflect`:

<Tabs>
<TabItem value="reflect" label="reflect (synthesized)">

`reflect` asks Hindsight to synthesize a single, query-focused summary from the
underlying memories — useful when you want compact, reasoned context.

```python
hindsight_litellm.set_defaults(
    bank_id="my-agent",
    use_reflect=True,
    reflect_context="I am a support agent helping a returning customer.",
)
```

</TabItem>
<TabItem value="recall" label="recall (raw)">

`recall` injects the raw matching memories — useful when you want the model to
see the individual facts.

```python
hindsight_litellm.set_defaults(
    bank_id="my-agent",
    use_reflect=False,
    max_memories=10,
    fact_types=["world", "opinion"],
)
```

</TabItem>
</Tabs>

## Per-Call Overrides

Any default set via `set_defaults()` can be overridden on an individual call
using `hindsight_*` keyword arguments:

```python
response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Where is Alice now?"}],
    hindsight_query="Alice's current location",          # required when inject_memories=True
    hindsight_reflect_context="The team is mid-incident", # per-call reflect context
    hindsight_bank_id="ops-team",                         # override the bank for this call
)
```

## How It Works

```
completion(query) ──► recall/reflect from Hindsight ──► inject into prompt
                                                              │
                                                              ▼
                              LLM call (any LiteLLM provider)
                                                              │
                            store conversation to Hindsight ◄─┘
                                                              │
                                                              ▼
                                                   response returned
```

1. You call `litellm.completion(...)` with a `hindsight_query`.
2. Hindsight retrieves relevant memory (raw via `recall`, or synthesized via `reflect`).
3. The memory is injected into the prompt (system message by default).
4. The enriched request is sent to your chosen LiteLLM provider.
5. The conversation is stored back to Hindsight (async by default) for future recall.
6. You get the response back exactly as a normal LiteLLM call.

## Configuration Reference

| Function | Key settings |
| --- | --- |
| `configure()` | `hindsight_api_url`, `api_key`, `inject_memories`, `store_conversations`, `sync_storage`, `injection_mode`, `excluded_models`, `verbose` |
| `set_defaults()` | `bank_id` (required), `use_reflect`, `budget`, `fact_types`, `max_memories`, `max_memory_tokens`, `reflect_context`, `document_id` |
| Per-call `hindsight_*` kwargs | `hindsight_query` (required when injecting), plus overrides for any default above |

See the [package README](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/litellm) for the full option list.

## Direct SDK without `enable()`

If you prefer not to patch `litellm.completion` globally, call the wrapper
directly — it has the same signature as `litellm.completion`:

```python
import hindsight_litellm

hindsight_litellm.configure(api_key=os.environ["HINDSIGHT_API_KEY"])
hindsight_litellm.set_defaults(bank_id="my-agent", use_reflect=True)

response = hindsight_litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Catch me up."}],
    hindsight_query="recent project status",
)
```

## Resources

- [Hindsight on GitHub](https://github.com/vectorize-io/hindsight)
- [hindsight-litellm package](https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/litellm)
- [Hindsight Cloud](https://hindsight.vectorize.io)
- [LiteLLM SDK Documentation](/docs/#litellm-python-sdk)
- [Custom Callbacks](/docs/observability/custom_callback)
