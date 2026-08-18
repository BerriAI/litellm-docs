# Amazon Comprehend Medical

Pass-through endpoints for [Amazon Comprehend Medical](https://docs.aws.amazon.com/comprehend-medical/latest/dev/comprehendmedical-welcome.html) - detect entities, PHI, and medical ontology links in clinical text, in native AWS format (no translation).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | For the sync text operations listed below |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Not offered by the Comprehend Medical API |

Just replace `https://comprehendmedical.{aws_region_name}.amazonaws.com` with `LITELLM_PROXY_BASE_URL/comprehendmedical` 🚀

LiteLLM signs the forwarded request with SigV4 using the proxy's AWS credentials, so clients only need a LiteLLM virtual key.

## Quick Start

1. Set AWS credentials and region in the proxy environment

```bash showLineNumbers
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY=""
export AWS_REGION_NAME="us-east-1"
```

2. Start the proxy

```bash showLineNumbers
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Call a Comprehend Medical operation through the proxy

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/comprehendmedical/DetectEntitiesV2' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{"Text": "Patient is taking 40mg of atorvastatin daily for hyperlipidemia."}'
```

The operation name in the URL is one of the supported sync text operations: `DetectEntitiesV2`, `DetectPHI`, `InferICD10CM`, `InferRxNorm`, or `InferSNOMEDCT`. Other operations (e.g. the async batch job APIs) return a 400 listing the supported set. [See all Comprehend Medical operations](https://docs.aws.amazon.com/comprehend-medical/latest/api/API_Operations.html)

## Usage with the AWS SDK (boto3)

Point the SDK's `endpoint_url` at `LITELLM_PROXY_BASE_URL/comprehendmedical`. The proxy reads the operation from the SDK's `X-Amz-Target` header, per the AWS JSON 1.1 protocol.

```python showLineNumbers
import boto3

client = boto3.client(
    "comprehendmedical",
    region_name="us-east-1",
    endpoint_url="http://0.0.0.0:4000/comprehendmedical",
    aws_access_key_id="placeholder",
    aws_secret_access_key="placeholder",
)
client.meta.events.register(
    "before-send.comprehendmedical.*",
    lambda request, **kwargs: request.headers.__setitem__("x-litellm-api-key", "sk-1234"),
)

response = client.detect_phi(Text="John Smith was admitted on 2026-08-01.")
print(response["Entities"])
```

The SDK still signs the request locally with the placeholder credentials, but LiteLLM discards that signature, authenticates the call with the LiteLLM virtual key from the `x-litellm-api-key` header, and re-signs the request with the proxy's AWS credentials.

## Cost Tracking

Spend is computed from the request's `Text` length: Comprehend Medical bills per started 100-character unit with a 1-unit minimum. LiteLLM applies the first-tier on-demand price per unit for each operation:

| Operation | Price per unit |
|-------|-------|
| `DetectEntitiesV2` | $0.01 |
| `DetectPHI` | $0.0014 |
| `InferICD10CM` | $0.0005 |
| `InferRxNorm` | $0.00025 |
| `InferSNOMEDCT` | $0.0075 |

Requests are logged with model `comprehendmedical/{Operation}` and provider `comprehendmedical`, and spend shows up in the usual places (SpendLogs, key/team budgets, logging integrations). Operations outside this table are rejected with a 400, so no Comprehend Medical call can slip past spend tracking.
