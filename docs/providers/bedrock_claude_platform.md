import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Platform on AWS

Use the `bedrock/claude_platform/<model>` route to call Claude Platform on AWS through the Bedrock auth path. LiteLLM sends requests to the Anthropic Messages endpoint through the AWS gateway, so the same configured model can be used with OpenAI-compatible `/chat/completions` and Anthropic-compatible `/v1/messages`.

Required configuration:

- AWS credentials available to `boto3`, or a Claude Platform API credential passed through LiteLLM.
- `aws_region_name`, unless you set a custom Claude Platform gateway base URL.
- `workspace_id` for your Claude Platform workspace.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

response = completion(
    model="bedrock/claude_platform/claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    aws_region_name="us-east-1",
    workspace_id="workspace-id",
)

print(response)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: claude-platform-sonnet
    litellm_params:
      model: bedrock/claude_platform/claude-sonnet-4-6
      aws_region_name: us-east-1
      workspace_id: workspace-id
```

</TabItem>
</Tabs>

## Test with OpenAI chat completions

```bash
curl --location 'http://0.0.0.0:4000/v1/chat/completions' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <proxy-key>' \
  --data '{
    "model": "claude-platform-sonnet",
    "messages": [
      {
        "role": "user",
        "content": "Write a short hello world response."
      }
    ]
  }'
```

## Test with Anthropic Messages

```bash
curl --location 'http://0.0.0.0:4000/v1/messages' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <proxy-key>' \
  --header 'anthropic-version: 2023-06-01' \
  --data '{
    "model": "claude-platform-sonnet",
    "max_tokens": 256,
    "messages": [
      {
        "role": "user",
        "content": "Write a short hello world response."
      }
    ]
  }'
```
