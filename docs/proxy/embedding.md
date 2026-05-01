import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Embeddings - `/embeddings`

See supported Embedding Providers & Models [here](https://docs.litellm.ai/docs/embedding/supported_embedding)

## Supported Input Formats

The `/v1/embeddings` endpoint follows the [OpenAI embeddings API specification](https://platform.openai.com/docs/api-reference/embeddings/create). The following input formats are supported:

| Format | Example |
|--------|---------|
| String | `"input": "Hello"` |
| Array of strings | `"input": ["Hello", "World"]` |
| Array of tokens (integers) | `"input": [1234, 5678, 9012]` |
| Array of token arrays | `"input": [[1234, 5678], [9012, 3456]]` |

## Quick start
Here's how to route between GPT-J embedding (sagemaker endpoint), Amazon Titan embedding (Bedrock) and Azure OpenAI embedding on the proxy server: 

1. Set models in your config.yaml
```yaml
model_list:
  - model_name: sagemaker-embeddings
    litellm_params: 
      model: "sagemaker/berri-benchmarking-gpt-j-6b-fp16"
  - model_name: amazon-embeddings
    litellm_params:
      model: "bedrock/amazon.titan-embed-text-v1"
  - model_name: azure-embeddings
    litellm_params: 
      model: "azure/azure-embedding-model"
      api_base: "os.environ/AZURE_API_BASE" # os.getenv("AZURE_API_BASE")
      api_key: "os.environ/AZURE_API_KEY" # os.getenv("AZURE_API_KEY")
      api_version: "2023-07-01-preview"

general_settings:
  master_key: sk-1234 # [OPTIONAL] if set all calls to proxy will require either this key or a valid generated token
```

2. Start the proxy
```shell
$ litellm --config /path/to/config.yaml
```

3. Test the embedding call

```shell
curl --location 'http://0.0.0.0:4000/v1/embeddings' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
    "input": "The food was delicious and the waiter..",
    "model": "sagemaker-embeddings",
}'
```
## Default `encoding_format` {#embedding-encoding-format}

For embeddings routed through LiteLLM’s **OpenAI-compatible embedding path** (for example OpenAI models, `openai/...` with a custom `api_base`, or the proxy `/v1/embeddings` route that forwards to that path), LiteLLM sends an explicit `encoding_format` when the caller omits it.

**Resolution order** (first match wins):

1. Value in the embedding request body (`encoding_format` in JSON).
2. Per-model default from `litellm_params.encoding_format` in `config.yaml`.
3. Process environment variable **`LITELLM_DEFAULT_EMBEDDING_ENCODING_FORMAT`** (e.g. `float` or `base64`).
4. Fallback **`float`**.

You can still override per request from any OpenAI-compatible client:

```bash
curl --location 'http://0.0.0.0:4000/v1/embeddings' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{"model": "my-embedding-model", "input": "hello", "encoding_format": "base64"}'
```

See also: [Config settings](./config_settings.md) (`LITELLM_DEFAULT_EMBEDDING_ENCODING_FORMAT`).

