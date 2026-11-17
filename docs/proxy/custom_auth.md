# Custom Auth

Authenticate API requests with a Python handler that validates your application's credentials and returns the caller's LiteLLM identity.

## How it works

LiteLLM passes the FastAPI `Request` and bearer credential to your async handler. Return `UserAPIKeyAuth` after validating the credential, or raise an exception to reject it. The returned identity supplies usage attribution and any configured authorization checks.

:::warning[Enforcement with custom auth]

Returning `UserAPIKeyAuth` does not enable every authorization check. Rate limits set on the object apply directly; budgets and model access require additional flags. Configure them using [Custom auth permissions](./access_management/custom_auth_permissions.md).

:::

## Prerequisites

Start with a working proxy and a configured model; the examples use `my-model`. Make your Python module available beside `config.yaml` or on the proxy's Python import path. Store the credential used by the example in the proxy's `CUSTOM_AUTH_TOKEN` environment variable.

For an existing authentication service, replace the example's credential comparison with that service's validation and return its verified identity.

<a id="usage"></a>

## Setup

### 1. Write the handler {#1-create-a-custom-auth-file}

Save this as `custom_auth.py`. The example validates one application's credential and identifies it as `integration-client`.

```python title="custom_auth.py"
import os
from secrets import compare_digest

from fastapi import Request
from litellm.proxy._types import ProxyException, UserAPIKeyAuth


async def user_api_key_auth(request: Request, api_key: str) -> UserAPIKeyAuth:
    expected_token = os.environ["CUSTOM_AUTH_TOKEN"]
    if not expected_token or not api_key or not compare_digest(api_key, expected_token):
        raise ProxyException(
            message="Invalid credential",
            type="authentication_error",
            param="api_key",
            code=401,
        )
    return UserAPIKeyAuth(api_key=api_key, user_id="integration-client")
```

### 2. Configure the proxy {#2-pass-the-filepath-relative-to-the-configyaml}

Add the module and function name to your existing configuration. Keep your model and database settings.

```yaml title="config.yaml"
general_settings:
  custom_auth: custom_auth.user_api_key_auth
```

### 3. Start the proxy {#3-start-the-proxy}

```bash
litellm --config config.yaml
```

## Test authentication

Set `CUSTOM_AUTH_TOKEN` in your client environment to the same credential, then send it as the bearer token:

```bash
curl 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $CUSTOM_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"model":"my-model","messages":[{"role":"user","content":"Hello"}]}'
```

A valid credential passes authentication. Repeat with an incorrect credential; the example returns `401`. If the valid caller is denied a model or exceeds a limit, check [authorization separately](./access_management/custom_auth_permissions.md).

## Configuration reference

### Caller identity {#userapikeyauth-fields-reference}

<a id="identity"></a>

Return the identity fields LiteLLM uses for usage attribution. The `*_id` fields also identify the database records loaded when `custom_auth_run_common_checks: true`.

| Field | Meaning |
| --- | --- |
| `api_key` | Caller credential; LiteLLM hashes it for internal use. |
| `token` | Hashed token for internal use. |
| `key_alias` | A display name for the credential. |
| `user_id`, `user_email` | Verified caller identity. |
| `user_role` | LiteLLM role; see [roles and permissions](./access_management/custom_auth_permissions.md). |
| `team_id`, `org_id`, `end_user_id` | Team, organization, and end-user identities for the request. |

For model permissions, budgets, and rate-limit fields, use [Custom auth permissions](./access_management/custom_auth_permissions.md).

### Token expiration

Return the credential's original expiration time as `expires`, and enable the expiry check:

```yaml
litellm_settings:
  enable_post_custom_auth_checks: true
```

This helper accepts the expiration time obtained from your credential validator:

```python
from datetime import datetime
from litellm.proxy._types import UserAPIKeyAuth


def authentication_result(api_key: str, expires_at: datetime) -> UserAPIKeyAuth:
    return UserAPIKeyAuth(api_key=api_key, expires=expires_at)
```

Use a timezone-aware expiration time. Recomputing it from the current time on each request would keep extending the credential's lifetime.

### Accept Virtual Keys alongside custom credentials {#support-litellm-virtual-keys--custom-auth}

<a id="usage-1"></a>

<SinceVersion v="1.72.2" />

<EnterpriseFeature feature="Using Custom Auth with LiteLLM Virtual Keys" />

Set `mode: auto` to try the custom handler first and fall back to normal Virtual Key authentication when it raises an ordinary exception. A `ProxyException` is an explicit rejection and does not trigger fallback.

A handler can also return an existing Virtual Key string after validating an external credential. LiteLLM then authenticates that key through its normal path:

```python title="custom_auth_auto.py"
import os
from secrets import compare_digest

from fastapi import Request


async def user_api_key_auth(request: Request, api_key: str) -> str:
    expected_token = os.environ["CUSTOM_AUTH_TOKEN"]
    if not expected_token:
        raise ValueError("Custom credential is not configured")
    if api_key and compare_digest(api_key, expected_token):
        return os.environ["LITELLM_VIRTUAL_KEY"]
    raise ValueError("Credential not handled by custom auth")
```

Set `LITELLM_VIRTUAL_KEY` on the proxy to an existing key, then configure the handler:

```yaml
general_settings:
  custom_auth: custom_auth_auto.user_api_key_auth
  custom_auth_settings:
    mode: auto
```

Test with the external credential and with an existing Virtual Key. Both should authenticate. A credential accepted by neither path is rejected.

| Mode | Behavior |
| --- | --- |
| `on` | Run the custom handler. This is also the behavior when custom auth is configured without `custom_auth_settings`. |
| `off` | Skip the custom handler and use normal authentication. |
| `auto` | Try the custom handler; ordinary exceptions fall back to normal authentication. `ProxyException` is propagated. |

### Return a specific error {#bubble-up-custom-exceptions}

Raise `ProxyException` with the response message and HTTP code, as in the setup example. Let it propagate from the handler. Catching it and raising a generic exception discards the intended response and can enable fallback in `auto` mode.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Handler cannot be imported | Confirm the filename, function name, import path, and mounted file match `general_settings.custom_auth`. |
| Every credential is rejected | Confirm the validator's configuration and secret are present in the proxy process. |
| A Virtual Key is rejected before fallback | In `auto` mode, raise an ordinary exception for credentials the custom handler does not handle. Reserve `ProxyException` for explicit denials. |
| Custom error details disappear | Remove blanket exception handlers that replace `ProxyException`. |
| An expired credential still works | Return its original `expires` value and enable `enable_post_custom_auth_checks`. |
| Budget or model restrictions do not apply | Check [custom auth enforcement flags](./access_management/custom_auth_permissions.md#what-gets-enforced). |

## Related guides

Use [Custom auth permissions](./access_management/custom_auth_permissions.md) for authorization, [Virtual Keys](./virtual_keys.md) for credential management, or [custom SSO hooks](./custom_sso.md) for browser sign-in callbacks.
