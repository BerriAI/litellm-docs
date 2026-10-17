# CacheCanary

[CacheCanary](https://github.com/Haarris/cachecanary) is an open-source CLI and GitHub Action that finds why Claude prompt caching misses on Amazon Bedrock. It checks the exact requests LiteLLM sends to Bedrock, explains why a request missed the previous request's cache, and reads Bedrock invocation logs to report hit rates and what the misses cost.

To check your own calls, save the request bodies LiteLLM builds with a small callback. It works for normal, async and streaming calls:

```python
import json, pathlib, time
import litellm
from litellm.integrations.custom_logger import CustomLogger

class SaveBedrockRequests(CustomLogger):
    def log_pre_api_call(self, model, messages, kwargs):
        body = (kwargs.get("additional_args") or {}).get("complete_input_dict")
        if not body:
            return
        if isinstance(body, bytes):
            body = body.decode()
        if not isinstance(body, str):
            body = json.dumps(body, default=str)
        folder = pathlib.Path("litellm-requests")
        folder.mkdir(exist_ok=True)
        (folder / f"{time.time_ns()}.json").write_text(body)

litellm.callbacks = [SaveBedrockRequests()]
```

Then lint one saved request, or compare two requests in a row to see why the second one missed:

```bash
pip install cachecanary
cachecanary lint litellm-requests/first.json --model us.anthropic.{{anthropic}}
cachecanary diff litellm-requests/first.json litellm-requests/second.json
```

The [LiteLLM guide](https://cachecanary.com/litellm/) shows what `cache_control_injection_points` sends to Bedrock, the cases where the cache is lost (a `role: "user"` injection point, many parallel tool calls, a cache point on an assistant tool-call message, a dropped 1-hour lifetime), and a setup that keeps it. Each case was checked against live Bedrock.

- [GitHub](https://github.com/Haarris/cachecanary)
- [LiteLLM guide](https://cachecanary.com/litellm/)
