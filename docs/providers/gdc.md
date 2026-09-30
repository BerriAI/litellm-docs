import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Google Distributed Cloud (GDC) Gemini

Deploy and call Gemini models hosted on your [Google Distributed Cloud (GDC)](https://cloud.google.com/distributed-cloud?hl=en) air-gapped or connected hardware using LiteLLM.

## Supported Models

:::tip
All OpenAI-compatible Gemini chat models hosted on GDC (such as `gdc/gemini-2.5-flash`, `gdc/gemini-1.5-pro`) are supported via the `/chat/completions` endpoint.
:::

## Quick Start

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

# 1. Set environment variables
os.environ["GDC_API_BASE"] = "https://gdc-endpoint.example.com"
os.environ["VERTEX_PROJECT"] = "my-gdc-project"
os.environ["VERTEX_LOCATION"] = "us-east1"

# 2. Provide Service Account Credentials (as a JSON string or token)
# Note: For security against Local File Inclusion (LFI), passing a local file path
# via api_key is disabled by default unless explicitly enabled via GDC_ALLOW_LOCAL_FILE_ACCESS=true.
service_account_json = '{"type": "service_account", "project_id": "my-gdc-project", ...}'

response = completion(
    model="gdc/gemini-2.5-flash",
    messages=[{"role": "user", "content": "Hello from GDC!"}],
    api_key=service_account_json,
)
print(response)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

**1. Add to config.yaml**

```yaml
model_list:
  - model_name: gdc-gemini-flash
    litellm_params:
      model: gdc/gemini-2.5-flash
      api_base: "https://gdc-endpoint.example.com"
      api_key: "os.environ/GDC_SERVICE_ACCOUNT_JSON"
      vertex_project: "my-gdc-project"
      vertex_location: "us-east1"
      ssl_verify: true
      gdc_token_caching: true
```

**2. Start the proxy**

```bash
export GDC_SERVICE_ACCOUNT_JSON='{"type": "service_account", ...}'
litellm --config config.yaml
```

**3. Test the endpoint**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gdc-gemini-flash",
    "messages": [
      {
        "role": "user",
        "content": "What models are running on GDC?"
      }
    ]
  }'
```

</TabItem>
</Tabs>

## Configuration Parameters

| Parameter | Description | Required | Default / Env Var |
|---|---|---|---|
| `model` | Must start with the `gdc/` prefix (e.g., `gdc/gemini-2.5-flash`). | Yes | - |
| `api_base` | The base URL / hostname of your GDC endpoint. | Yes | `GDC_API_BASE` or `LITELLM_API_BASE` |
| `api_key` | Service account JSON credential string or Bearer token. | Yes | `GDC_API_KEY` or `LITELLM_API_KEY` |
| `vertex_project` | GDC Project ID where the Gemini endpoint is hosted. | Yes | `VERTEX_PROJECT` |
| `vertex_location` | Location ID of the GDC hardware/endpoint. | Yes | `VERTEX_LOCATION` |
| `ssl_verify` | Whether to verify SSL/TLS certificates against the GDC endpoint. | No | `True` (`SSL_VERIFY`) |
| `gdc_token_caching` | Cache and automatically refresh generated OAuth/GDC tokens in memory. | No | `False` (`GDC_TOKEN_CACHING`) |

## Security Hardening: Credential File Access

To protect proxy deployments against Local File Inclusion (LFI) and arbitrary file read vulnerabilities, LiteLLM disables reading local filesystem paths passed via the `api_key` parameter by default for GDC.

If you need to pass a local filesystem path (e.g., `/etc/secrets/service_account.json`) as `api_key` rather than passing the raw JSON string or OAuth bearer token directly, you must explicitly enable local file access by setting the environment variable:

- **Environment Variable**: Set `GDC_ALLOW_LOCAL_FILE_ACCESS=true`.
