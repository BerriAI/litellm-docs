# LiteLLM Keys (community key, discontinued)

The free community `sk-litellm-...` keys and the hosted proxy behind them are no longer available. The LiteLLM SDK has no special handling for these keys, so setting `OPENAI_API_KEY` (or any other provider key) to an `sk-litellm-...` value sends it straight to that provider, which rejects it with an authentication error

To get one key for many providers, run your own [LiteLLM Proxy](./proxy/quick_start.md) with your provider credentials, then call it from the SDK through the [`litellm_proxy/` provider](./providers/litellm_proxy.md) using a key issued by your proxy

```python
import os
from litellm import completion

os.environ["LITELLM_PROXY_API_BASE"] = "http://0.0.0.0:4000"  # your proxy
os.environ["LITELLM_PROXY_API_KEY"] = "sk-1234"  # a key issued by your proxy

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(model="litellm_proxy/{{openai_small}}", messages=messages)
```

The `litellm_proxy/` prefix works the same way in tools built on the LiteLLM SDK, as long as `LITELLM_PROXY_API_BASE` points at your proxy. For every model and provider you can call, see the [provider list](./providers/) or [models.litellm.ai](https://models.litellm.ai/)
