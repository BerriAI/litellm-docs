# Sentry
import Image from '@theme/IdealImage';


:::tip

This is community maintained, Please make an issue if you run into a bug
https://github.com/BerriAI/litellm

:::


[Sentry](https://sentry.io/) provides error monitoring for production. LiteLLM can add breadcrumbs and send exceptions to Sentry with this integration

Track exceptions for:
- litellm.completion() - completion()for 100+ LLMs
- litellm.acompletion() - async completion()
- Streaming completion() & acompletion() calls

<Image img={require('../../img/sentry.png')} />


## Usage

### Set SENTRY_DSN & callback

```python
import litellm, os
os.environ["SENTRY_DSN"] = "your-sentry-url"
litellm.failure_callback=["sentry"]
```

### Sentry callback with completion
```python
import litellm
from litellm import completion 

litellm.input_callback=["sentry"] # adds sentry breadcrumbing
litellm.failure_callback=["sentry"] # [OPTIONAL] if you want litellm to capture -> send exception to sentry

import os 
os.environ["SENTRY_DSN"] = "your-sentry-url"
os.environ["OPENAI_API_KEY"] = "your-openai-key"

# set bad key to trigger error 
api_key="bad-key"
response = completion(model="{{openai_small}}", messages=[{"role": "user", "content": "Hey!"}], stream=True, api_key=api_key)

print(response)
```

#### Sample Rate Options

- **SENTRY_API_SAMPLE_RATE**: Controls what percentage of errors are sent to Sentry
  - Value between 0 and 1 (default is 1.0 or 100% of errors)
  - Example: 0.5 sends 50% of errors, 0.1 sends 10% of errors

- **SENTRY_API_TRACE_RATE**: Controls what percentage of transactions are sampled for performance monitoring
  - Value between 0 and 1 (default is 1.0 or 100% of transactions)
  - Example: 0.5 traces 50% of transactions, 0.1 traces 10% of transactions

These options are useful for high-volume applications where sampling a subset of errors and transactions provides sufficient visibility while managing costs.

#### Sentry Environment
- **SENTRY_ENVIRONMENT**: Specifies the environment name for your Sentry events (e.g., "production", "staging", "development")
  - Helps organize and filter errors by deployment environment in Sentry dashboard
  - Example: `os.environ["SENTRY_ENVIRONMENT"] = "staging"`
  - If not set, Sentry will use 'production' as the default environment

## PII and secret scrubbing

By default LiteLLM sends Sentry events with `send_default_pii` off and scrubs them before they leave the proxy, so the frame locals Sentry attaches to an exception never carry credentials or user identity

Secrets are always removed. API keys (any `sk-` value, wherever it appears), the request headers a virtual key arrives in (`Authorization`, `x-api-key`, `api-key`, `x-goog-api-key`, `x-litellm-api-key`), the master key, the database URL, tokens, cookies, and passwords read `[Filtered]` whether they sit in a top-level variable, in a nested dict such as `general_settings`, or inside the repr of an object such as `UserAPIKeyAuth(token='...')`

User identity is removed unless you opt in. `user_id`, `user_email`, `end_user_id`, the hashed virtual key (`user_api_key_hash`), and the `user_api_key_*` metadata fields read `[Filtered]` in the same three places, and any email-shaped value or 64-character hex key hash left elsewhere in the event is replaced too

Set `SENTRY_SEND_DEFAULT_PII=true` when you want Sentry to show which user or key an error belongs to. The identity fields then pass through while secrets stay filtered

```shell
export SENTRY_SEND_DEFAULT_PII=true
```

## Redacting Messages, Response Content from Sentry Logging 

Set `litellm.turn_off_message_logging=True` This will prevent the messages and responses from being logged to sentry, but request metadata will still be logged.

[Let us know](https://github.com/BerriAI/litellm/issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yml&title=%5BFeature%5D%3A+) if you need any additional options from Sentry. 

