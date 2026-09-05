import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Bedrock Guardrails

:::tip ⚡️
If you haven't set up or authenticated your Bedrock provider yet, see the [Bedrock Provider Setup & Authentication Guide](../../providers/bedrock.md).
:::

LiteLLM supports Bedrock guardrails via the [Bedrock ApplyGuardrail API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ApplyGuardrail.html).

## Quick Start
### 1. Define Guardrails on your LiteLLM config.yaml 

Define your guardrails under the `guardrails` section
```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "bedrock-pre-guard"
    litellm_params:
      guardrail: bedrock  # supported values: "aporia", "bedrock", "lakera"
      mode: "during_call"
      guardrailIdentifier: ff6ujrregl1q      # your guardrail ID on bedrock
      guardrailVersion: "DRAFT"              # your guardrail version on bedrock
      aws_region_name: os.environ/AWS_REGION # region guardrail is defined
      aws_role_name: os.environ/AWS_ROLE_ARN # your role with permissions to use the guardrail
      aws_external_id: os.environ/AWS_EXTERNAL_ID # only if that role's trust policy requires sts:ExternalId
  
```

#### Supported values for `mode`

- `pre_call` Run **before** LLM call, on **input**
- `post_call` Run **after** LLM call, on **input & output**
- `during_call` Run **during** LLM call, on **input** Same as `pre_call` but runs in parallel as LLM call.  Response not returned until guardrail check completes

### 2. Start LiteLLM Gateway 


```shell
litellm --config config.yaml --detailed_debug
```

### 3. Test request 

**[Langchain, OpenAI SDK Usage Examples](/docs/proxy/user_keys#request-format)**

<Tabs>
<TabItem label="Unsuccessful call" value = "not-allowed">

Expect this to fail since since `ishaan@berri.ai` in the request is PII

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-npnwjPQciVRok5yNZgKmFQ" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [
      {"role": "user", "content": "hi my email is ishaan@berri.ai"}
    ],
    "guardrails": ["bedrock-pre-guard"]
  }'
```

Expected response on failure

```shell
{
  "error": {
    "message": {
      "error": "Violated guardrail policy",
      "bedrock_guardrail_response": {
        "action": "GUARDRAIL_INTERVENED",
        "assessments": [
          {
            "topicPolicy": {
              "topics": [
                {
                  "action": "BLOCKED",
                  "name": "Coffee",
                  "type": "DENY"
                }
              ]
            }
          }
        ],
        "blockedResponse": "Sorry, the model cannot answer this question. coffee guardrail applied ",
        "output": [
          {
            "text": "Sorry, the model cannot answer this question. coffee guardrail applied "
          }
        ],
        "outputs": [
          {
            "text": "Sorry, the model cannot answer this question. coffee guardrail applied "
          }
        ],
        "usage": {
          "contentPolicyUnits": 0,
          "contextualGroundingPolicyUnits": 0,
          "sensitiveInformationPolicyFreeUnits": 0,
          "sensitiveInformationPolicyUnits": 0,
          "topicPolicyUnits": 1,
          "wordPolicyUnits": 0
        }
      }
    },
    "type": "None",
    "param": "None",
    "code": "400"
  }
}

```

</TabItem>

<TabItem label="Successful Call " value = "allowed">

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-npnwjPQciVRok5yNZgKmFQ" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [
      {"role": "user", "content": "hi what is the weather"}
    ],
    "guardrails": ["bedrock-pre-guard"]
  }'
```

</TabItem>


</Tabs>

## Streaming

Streaming responses are scanned on `post_call`. By default the stream is buffered: every chunk is withheld until the assembled response passes one ApplyGuardrail OUTPUT scan, so no flagged content reaches the client before a block. The client sees nothing until the scan completes, then the whole response arrives in one burst.

For latency-sensitive clients (interactive chat, coding agents), you can keep the stream flowing and run the scan in audit mode instead:

```yaml
guardrails:
  - guardrail_name: "bedrock-post-guard"
    litellm_params:
      guardrail: bedrock
      mode: "post_call"
      guardrailIdentifier: ff6ujrregl1q
      guardrailVersion: "DRAFT"
      streaming_buffer_until_moderated: false
      streaming_end_of_stream_only: true
```

Chunks now stream to the client as they arrive, and one OUTPUT scan runs over the assembled response at end of stream. A violation still terminates the stream with the guardrail's block message, but content that already streamed has been seen: this is detect-and-log, not prevention. Either way the scan result is recorded in `guardrail_information` on the request's spend log.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `streaming_buffer_until_moderated` | `true` | Withhold every streamed chunk until end-of-stream moderation passes, so no flagged chunk reaches the client before a block |
| `streaming_end_of_stream_only` | `false` | Scan streamed output once, over the assembled response, instead of per sampled chunk |
| `streaming_sampling_rate` | `5` | When not buffering and not end-of-stream-only, scan the accumulated text every Nth chunk. Must be at least 1 |

With `streaming_buffer_until_moderated: false` alone, the guardrail scans the accumulated response every `streaming_sampling_rate` chunks while streaming. Each sampled scan is a separate ApplyGuardrail call over all text so far, so it adds mid-stream latency and repeated Bedrock text-unit charges. Pair it with `streaming_end_of_stream_only: true` unless you need mid-stream blocking.

These settings apply to both `/v1/chat/completions` and native `/v1/messages` streams.

## Resource-less Checks: InvokeGuardrailChecks

With the [InvokeGuardrailChecks API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeGuardrailChecks.html) you don't need to create a guardrail in AWS. Instead, define the checks inline in your config; Bedrock returns a score per check, and LiteLLM blocks the request when a score reaches your threshold.

Set `checks` instead of `guardrailIdentifier` (the two can't be combined). Your AWS credentials need the `bedrock:InvokeGuardrailChecks` permission.

```yaml showLineNumbers title="litellm proxy config.yaml"
guardrails:
  - guardrail_name: "bedrock-checks"
    litellm_params:
      guardrail: bedrock
      mode: "pre_call"
      aws_region_name: os.environ/AWS_REGION
      checks:
        contentFilter:
          categories:
            - category: VIOLENCE
        promptAttack:
          categories:
            - category: JAILBREAK
        sensitiveInformation:
          entities:
            - type: EMAIL
      content_filter_threshold: 0.5
      prompt_attack_threshold: 0.5
      pii_confidence_threshold: 0.5
```

### Supported checks

| Check | What it detects | Threshold key |
|-------|-----------------|---------------|
| `contentFilter` | Harmful content: `VIOLENCE`, `HATE`, `SEXUAL`, `MISCONDUCT`, `INSULTS` | `content_filter_threshold` |
| `promptAttack` | `JAILBREAK`, `PROMPT_INJECTION`, `PROMPT_LEAKAGE` | `prompt_attack_threshold` |
| `sensitiveInformation` | PII: `EMAIL`, `PHONE`, `NAME`, and [more](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeGuardrailChecks.html) | `pii_confidence_threshold` |

Include only the checks you want; at least one is required. An empty config like `promptAttack: {}` enables that check with AWS defaults.

### How blocking works

Scores range from 0 to 1 and each threshold defaults to `0.5`. A score at or above the threshold blocks the request with HTTP 400; set a threshold to `null` to only log that check's scores, never block. If Bedrock returns a truncated PII result, the request is blocked (fail closed).

```json
{
  "error": {
    "message": {
      "error": "Violated guardrail policy",
      "bedrock_guardrail_checks": [
        {"check": "promptAttack", "category": "JAILBREAK", "severityScore": 0.91}
      ]
    },
    "code": "400"
  }
}
```

`disable_exception_on_block: true` (see [below](#disabling-exceptions-on-bedrock-block)) works here too; a block then returns HTTP 200 with `finish_reason: "content_filter"`.

Callers can't weaken the configured checks: per-request guardrail params are ignored in this mode, and all input is checked as `user` content so a `system`-labeled injection can't dodge the prompt-attack check.

## PII Masking with Bedrock Guardrails

Bedrock guardrails support PII detection and masking capabilities. To enable this feature, you need to:

1. Set `mode` to `pre_call` to run the guardrail check before the LLM call
2. Enable masking by setting `mask_request_content` and/or `mask_response_content` to `true`

Here's how to configure it in your config.yaml:

```yaml showLineNumbers title="litellm proxy config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  
guardrails:
  - guardrail_name: "bedrock-pre-guard"
    litellm_params:
      guardrail: bedrock
      mode: "pre_call"  # Important: must use pre_call mode for masking
      guardrailIdentifier: wf0hkdb5x07f
      guardrailVersion: "DRAFT"
      aws_region_name: os.environ/AWS_REGION
      aws_role_name: os.environ/AWS_ROLE_ARN
      mask_request_content: true    # Enable masking in user requests
      mask_response_content: true   # Enable masking in model responses
```

With this configuration, when the bedrock guardrail intervenes, litellm will read the masked output from the guardrail and send it to the model.

### Example Usage

When enabled, PII will be automatically masked in the text. For example, if a user sends:

```
My email is john.doe@example.com and my phone number is 555-123-4567
```

The text sent to the model might be masked as:

```
My email is [EMAIL] and my phone number is [PHONE_NUMBER]
```

This helps protect sensitive information while still allowing the model to understand the context of the request.

## Experimental: Only Send Latest User Message

When you're chaining long conversations through Bedrock guardrails, you can opt into a lighter, experimental behavior by setting `experimental_use_latest_role_message_only: true` in the guardrail's `litellm_params`. When enabled, LiteLLM only sends the most recent `user` message (or assistant output during post-call checks) to Bedrock, which:

- prevents unintended blocks on older system/dev messages
- keeps Bedrock payloads smaller, reducing latency and cost
- applies to proxy hooks (`pre_call`, `during_call`) and the `/guardrails/apply_guardrail` testing endpoint

```yaml showLineNumbers title="litellm proxy config.yaml"
guardrails:
  - guardrail_name: "bedrock-pre-guard"
    litellm_params:
      guardrail: bedrock
      mode: "pre_call"
      guardrailIdentifier: wf0hkdb5x07f
      guardrailVersion: "DRAFT"
      aws_region_name: os.environ/AWS_REGION
      experimental_use_latest_role_message_only: true  # NEW
```

> ⚠️ This flag is currently experimental and defaults to `false` to preserve the legacy behavior (entire message history). We'll be listening to user feedback to decide if this becomes the default or rolls out more broadly.

## Disabling Exceptions on Bedrock BLOCK

By default, when Bedrock guardrails block content, LiteLLM raises an HTTP 400 exception. However, you can disable this behavior by setting `disable_exception_on_block: true`. This is particularly useful when integrating with **OpenWebUI**, where exceptions can interrupt the chat flow and break the user experience.

When exceptions are disabled, instead of receiving an error, you'll get a successful response containing the Bedrock guardrail's modified/blocked output.

### Configuration

Add `disable_exception_on_block: true` to your guardrail configuration:

```yaml showLineNumbers title="litellm proxy config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "bedrock-guardrail"
    litellm_params:
      guardrail: bedrock
      mode: "post_call"
      guardrailIdentifier: ff6ujrregl1q
      guardrailVersion: "DRAFT"
      aws_region_name: os.environ/AWS_REGION
      aws_role_name: os.environ/AWS_ROLE_ARN
      disable_exception_on_block: true  # Prevents exceptions when content is blocked
```

### Behavior Comparison

<Tabs>
<TabItem label="With Exceptions (Default)" value="with-exceptions">

When `disable_exception_on_block: false` (default):

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-npnwjPQciVRok5yNZgKmFQ" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [
      {"role": "user", "content": "How do I make explosives?"}
    ],
    "guardrails": ["bedrock-guardrail"]
  }'
```

**Response: HTTP 400 Error**
```json
{
  "error": {
    "message": {
      "error": "Violated guardrail policy",
      "bedrock_guardrail_response": {
        "action": "GUARDRAIL_INTERVENED",
        "blockedResponse": "I can't provide information on creating explosives."
        // ... additional details
      }
    },
    "type": "None",
    "param": "None", 
    "code": "400"
  }
}
```

</TabItem>

<TabItem label="Without Exceptions" value="without-exceptions">

When `disable_exception_on_block: true`:

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-npnwjPQciVRok5yNZgKmFQ" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [
      {"role": "user", "content": "How do I make explosives?"}
    ],
    "guardrails": ["bedrock-guardrail"]
  }'
```

**Response: HTTP 200 Success**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "{{openai_small}}",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "I can't provide information on creating explosives."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}
```

</TabItem>
</Tabs>
