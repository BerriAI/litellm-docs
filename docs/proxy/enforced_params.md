---
title: Enforced required params
description: Require request fields globally, per virtual key, or for service account keys.
---

# Enforced required params

Reject requests that omit required fields, such as `user` or `metadata.generation_name`, before they reach the model provider. Use this to require attribution metadata from applications.

<EnterpriseFeature />

An active enterprise license is required. Set `LITELLM_LICENSE` in the proxy environment.

## Require fields for all keys

### 1. Configure the proxy

Save this as `config.yaml`. This example uses OpenAI and PostgreSQL so you can create virtual keys.

```yaml keep-model-ids
model_list:
  - model_name: small-openai
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enforced_params: ["user", "metadata.generation_name"]
```

### 2. Start the proxy

Install the [proxy CLI](./quick_start.md), use a running PostgreSQL database, and export your credentials. Replace the placeholder values before you run these commands.

```bash
export OPENAI_API_KEY="<your-openai-api-key>"
export LITELLM_LICENSE="<your-enterprise-license>"
export LITELLM_MASTER_KEY="sk-<your-long-random-master-key>"
export DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<database>"

litellm --config config.yaml --port 4000
```

### 3. Create a virtual key

Use the master key for key management. Copy the `key` from the response into `LITELLM_API_KEY`.

```bash
curl -sS http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"models":["small-openai"]}'

export LITELLM_API_KEY="<key-from-response>"
```

### 4. Send a request without the required fields

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"small-openai","messages":[{"role":"user","content":"Reply with OK."}]}'
```

Observed response from a live proxy. This build returns HTTP 500 for missing enforced fields, even though the message describes a bad request.

```text
{"error":{"message":"BadRequest please pass param=user in request body. This is a required param","type":"internal_server_error","param":null,"code":"500"}}
HTTP 500
```

If you send `"user":"user-123"` with `"metadata":{}`, the response identifies the missing nested field instead.

```text
{"error":{"message":"BadRequest please pass param=[metadata][generation_name] in request body. This is a required param","type":"internal_server_error","param":null,"code":"500"}}
HTTP 500
```

### 5. Include the required fields

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model":"small-openai",
    "messages":[{"role":"user","content":"Reply with OK."}],
    "user":"user-123",
    "metadata":{"generation_name":"docs-example"}
  }'
```

The live request returns HTTP 200 with `choices[0].message.content` equal to `"OK"`. Model output can vary.

## Require fields for one key

Pass `enforced_params` at the top level of `/key/generate`. LiteLLM stores it in the key's metadata. You can also set it through `/key/update` for an existing key.

This key requires `metadata.project` in addition to the global fields from the config above.

```bash
curl -sS http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"models":["small-openai"],"enforced_params":["metadata.project"]}'

export LITELLM_API_KEY="<key-from-this-response>"
```

Repeat the successful request from the previous section with this new key. It now fails because `metadata.project` is absent.

```text
{"error":{"message":"BadRequest please pass param=[metadata][project] in request body. This is a required param","type":"internal_server_error","param":null,"code":"500"}}
HTTP 500
```

Include the key-specific field along with the global fields.

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model":"small-openai",
    "messages":[{"role":"user","content":"Reply with OK."}],
    "user":"user-123",
    "metadata":{"generation_name":"docs-example","project":"support"}
  }'
```

The live request returns HTTP 200 with `choices[0].message.content` equal to `"OK"`.

To use only per-key requirements, remove `general_settings.enforced_params` from the config and restart the proxy.

## Require fields for service account keys

Use `general_settings.service_account_settings.enforced_params` to add requirements only for service account keys.

```yaml
general_settings:
  service_account_settings:
    enforced_params: ["user"]
```

These requirements apply in addition to global and per-key requirements. See [Service Accounts](./service_accounts.md) to create a service account key and test it.

## Supported field syntax

Use a top-level field name such as `user`, or one level of nesting such as `metadata.generation_name`. Deeper paths and array indexing are not supported.

Enforcement checks whether the field exists, not its type or whether its value is nonempty. Send nested fields inside a JSON object such as `"metadata":{"generation_name":"docs-example"}`. Per-key requirements add to global requirements rather than replace them.
