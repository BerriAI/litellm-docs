# Cloudflare Workers AI
https://developers.cloudflare.com/workers-ai/models/text-generation/

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
