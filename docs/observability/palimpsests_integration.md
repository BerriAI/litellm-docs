# Palimpsests — tamper-evident audit trail

[Palimpsests](https://github.com/Assault-Consulting/Palimpsests) writes a
**hash-chained, independently verifiable audit record** of the tool loop
your application runs through LiteLLM: which tools the model asked for,
with what argument digests, and which results were fed back. The record
is a frozen, published binary format ([PALA-1](https://github.com/Assault-Consulting/Palimpsests/blob/main/docs/specs/pala-1/PALA-1.md))
that anyone can verify from the specification alone, with no key and no
trust in the software that wrote it.

The callback is a single standard-library file. It sends **digests, not
content**: prompts, completions, tool arguments and tool outputs never
enter the record.

## What gets logged

LiteLLM sees the model's response and the next request, never the tool
run itself. The callback therefore reports exactly that, marked as such:

| LiteLLM sees | Recorded as | Meaning |
|---|---|---|
| `tool_calls` in a response | `TOOL_CALL` — tool name + SHA-256 of the arguments | the model asked for this tool |
| a `role: tool` message for a reported call | `TOOL_RESULT`, outcome `ok` | a result re-entered generation — **not** that the action took effect |
| a call whose result never comes back | `cancelled`, written by Palimpsests at shutdown | abandonment, recorded as abandonment |

Every record carries the mark `reported-by-client`: the chain proves that
LiteLLM observed the call and the result, and when — not that the tool
ran. Records that Palimpsests parses from its own wire carry a different
mark, so the two are never confused.

## Quick Start

1. Run the Palimpsests serve (the writer of the chain):

```shell
pip install 'palimpsests[serve]'
palimpsests serve            # http://127.0.0.1:11435
```

2. Copy [`palimpsests_audit.py`](https://github.com/Assault-Consulting/Palimpsests/blob/main/integrations/litellm/palimpsests_audit.py)
   next to your code, and register it:

```python
import litellm
from palimpsests_audit import PalimpsestsAudit

litellm.callbacks = [PalimpsestsAudit()]

response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is 6 times 7?"}],
    tools=[{"type": "function", "function": {"name": "calc.multiply", "parameters": {"type": "object"}}}],
)
```

3. Verify the chain — no key, no network:

```shell
palimpsests pala verify ~/.config/palimpsests/serve.pala
palimpsests pala export ~/.config/palimpsests/serve.pala \
  | grep '"kind_name":"TOOL_CALL"'
```

Each `TOOL_CALL` and `TOOL_RESULT` line carries `"source": 1` and
`"source_name": "reported-by-client"`. `pala verify` exits `2`
(`PARTIAL`) on a chain with no anchor — that is correct, not a failure:
it means internal consistency was checked and completeness was not.

## Usage with LiteLLM Proxy

Create `custom_callbacks.py` beside your `config.yaml`:

```python
from palimpsests_audit import PalimpsestsAudit

palimpsests_audit = PalimpsestsAudit()
```

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: custom_callbacks.palimpsests_audit

environment_variables:
  PALIMPSESTS_SERVE_URL: http://127.0.0.1:11435
```

Start the proxy and make a request that uses tools:

```shell
litellm --config config.yaml
```

Every framework that routes through the proxy is now on the record.

## Configuration

| Environment variable | Meaning | Default |
|---|---|---|
| `PALIMPSESTS_SERVE_URL` | base URL of the Palimpsests serve | `http://127.0.0.1:11435` |
| `PALIMPSESTS_SERVE_API_KEY` | bearer key when the serve runs with `--api-key` | unset |
| `PALIMPSESTS_AUDIT_REPORT` | `0` disables reporting | enabled |

## Behaviour

- **Never blocks, never alters a completion.** A failed report is a
  `logging` warning (`palimpsests.audit.litellm`); the completion
  proceeds.
- **One result per call.** A call id is reported once; its result once.
- **Hook order does not matter.** LiteLLM runs success hooks off the
  request thread, so the hook carrying a tool result can fire before the
  hook carrying its call; the callback holds the result and sends it
  after the call, in order.
- **Streaming** is assembled by LiteLLM before the hook runs.
- **Local by default.** The serve is a local process; nothing leaves the
  host unless you point `PALIMPSESTS_SERVE_URL` elsewhere.

## Verifying and sharing the record

```shell
palimpsests pala verify serve.pala            # exit 0 / 1 / 2 / 3
palimpsests pala report serve.pala --html     # a self-contained page
palimpsests pala bundle serve.pala            # records + proofs, one tar
```

The format has five independent verifier implementations, three of them
by external parties, and a [verification kit](https://github.com/Assault-Consulting/Palimpsests/blob/main/docs/specs/pala-1/verification-kit/README.md)
so a fourth party can write their own. A record's evidentiary value
rests on that, not on this integration.

## Support

- GitHub: [Assault-Consulting/Palimpsests](https://github.com/Assault-Consulting/Palimpsests)
- Plain-words introduction: [Start here](
