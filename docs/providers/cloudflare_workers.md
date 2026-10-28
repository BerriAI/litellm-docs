# Cloudflare Workers AI
https://developers.cloudflare.com/workers-ai/models/text-generation/

## Chat and decision model endpoints

Cloudflare Workers AI uses different endpoints for chat completions and decision models:

| Model type | Workers AI endpoint | Request shape |
| --- | --- | --- |
| Chat completions | `/ai/v1/chat/completions` | OpenAI-compatible `model` and `messages` |
| Decisions (Clef) | `/ai/run/{model}` | Native Workers AI `state`, typed `questions`, and optional `images` for supported models |

Both paths follow `https://api.cloudflare.com/client/v4/accounts/{account_id}`.

For chat completions, LiteLLM defaults to an `api_base` ending in `/ai/v1`.
If you supply a chat `api_base` ending in `/ai/run`, LiteLLM logs a warning and
rewrites it to `/ai/v1`.

For decision models such as `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash`,
and `@cf/cloudflare/clef-omni`, LiteLLM uses the native `/ai/run/{model}` endpoint.
The `/ai/run` path remains required for these models. Keep a separate
`api_base` ending in `/ai/run` for decision deployments when configuring it
explicitly; do not change it to `/ai/v1` to match a chat deployment.

Clef models do not accept chat `messages` through `/ai/v1/chat/completions`.
Use LiteLLM's decisions API for these models; LiteLLM translates the decision
request into Cloudflare's native format.

## API Key
```python
# env variable
os.environ['CLOUDFLARE_API_KEY'] = "3dnSGlxxxx"
os.environ['CLOUDFLARE_ACCOUNT_ID'] = "03xxxxx"
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['CLOUDFLARE_API_KEY'] = "3dnSGlxxxx"
os.environ['CLOUDFLARE_ACCOUNT_ID'] = "03xxxxx"

response = completion(
    model="cloudflare/@cf/meta/llama-2-7b-chat-int8", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['CLOUDFLARE_API_KEY'] = "3dnSGlxxxx"
os.environ['CLOUDFLARE_ACCOUNT_ID'] = "03xxxxx"

response = completion(
    model="cloudflare/@hf/thebloke/codellama-7b-instruct-awq", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Supported Models
All models listed here https://developers.cloudflare.com/workers-ai/models/text-generation/ are supported

| Model Name                        | Function Call                                            |
|-----------------------------------|----------------------------------------------------------|
| @cf/meta/llama-2-7b-chat-fp16     | `completion(model="mistral/mistral-tiny", messages)`    |
| @cf/meta/llama-2-7b-chat-int8     | `completion(model="mistral/mistral-small", messages)`   |
| @cf/mistral/mistral-7b-instruct-v0.1 | `completion(model="mistral/mistral-medium", messages)` |
| @hf/thebloke/codellama-7b-instruct-awq | `completion(model="codellama/codellama-medium", messages)` |

## Clairic extraction

[Clairic](https://developers.cloudflare.com/workers-ai/models/clairic/) is Cloudflare's typed extraction model. Call it as `cloudflare/@cf/cloudflare/clairic` or `cloudflare/clairic` with the same `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID`, on the proxy's `/v1/extraction` route or with `litellm.extraction`. See [/v1/extraction](../extraction.md) for the request and response format, errors and pricing. Available from v1.108.0.
