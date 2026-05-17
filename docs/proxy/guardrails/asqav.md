import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Asqav

[Asqav](https://asqav.com) signs every LLM call with a post-quantum signature
(ML-DSA / FIPS 204) and stores a tamper-evident audit trail. Use it when you
need a cryptographically verifiable record of who called which model, with what
inputs, and what the response was, for SOC 2, ISO 42001, or EU AI Act evidence.

The integration ships as a `CustomGuardrail` callback in the
[`asqav` Python SDK](https://pypi.org/project/asqav/). It signs the following
LiteLLM lifecycle events:

- `pre_call` - before the LLM request is dispatched
- `post_call_success` - after a successful response, including token usage
- `post_call_failure` - on any provider error, tagged with `risk_class=medium`
- `moderation` - moderation hook events

Signing failures are fail-open and never block LLM requests.

## Quick Start

### 1. Install the SDK

```bash
pip install asqav[litellm]
```

### 2. Get an API key

Sign up at [asqav.com](https://asqav.com) and create a project. Copy the
`sk_live_...` key from the dashboard.

### 3. Register the callback

The Asqav guardrail is registered through `litellm.callbacks`, not the
`guardrails:` YAML block, because it observes every call rather than gating on a
named guardrail.

<Tabs>
<TabItem label="LiteLLM Proxy (config.yaml)" value="proxy">

Create a `custom_callbacks.py` next to your `config.yaml`:

```python
import asqav
from asqav.extras.litellm import AsqavGuardrail

asqav.init("sk_live_...")  # or set ASQAV_API_KEY in the environment

proxy_handler_instance = AsqavGuardrail(agent_name="my-litellm-proxy")
```

Then wire it up in `config.yaml`:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: custom_callbacks.proxy_handler_instance
```

Start the proxy:

```bash
litellm --config config.yaml
```

</TabItem>
<TabItem label="LiteLLM Python SDK" value="sdk">

```python
import asqav
from asqav.extras.litellm import AsqavGuardrail
import litellm

asqav.init("sk_live_...")
litellm.callbacks = [AsqavGuardrail(agent_name="my-litellm-proxy")]

response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
```

</TabItem>
</Tabs>

### 4. Verify the audit trail

Every call now appears in the Asqav dashboard with its signed envelope. Receipts
can be exported as JSON for downstream verification.

## Configuration

| Parameter     | Description                                                                       |
|---------------|-----------------------------------------------------------------------------------|
| `api_key`     | Optional override; defaults to the key passed to `asqav.init()` or `ASQAV_API_KEY`. |
| `agent_name`  | Name for a new agent (creates it on first run).                                   |
| `agent_id`    | ID of an existing agent (use instead of `agent_name` to reuse).                   |

## Links

- Integration guide: <https://asqav.com/docs/litellm>
- SDK source: <https://github.com/asqav/asqav-sdk>
- PyPI: <https://pypi.org/project/asqav/>
- Issues / questions: info@asqav.com
