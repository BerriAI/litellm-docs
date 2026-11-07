# Event Hooks for SSO Login

Use a Python callback to read a verified identity from an upstream authentication proxy or customize the identity returned after an SSO sign-in.

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required. The custom UI sign-in hook for an upstream authentication proxy requires Enterprise.</EnterpriseFeature>

<a id="overview"></a>

## How it works

Choose the hook that matches where authentication happens:

| Hook | When it runs | Return value |
| --- | --- | --- |
| `custom_ui_sso_sign_in_handler` | An upstream authentication proxy has authenticated the user; the hook reads its identity headers. | `OpenID` |
| `custom_sso` | LiteLLM has completed its provider sign-in flow; the callback receives the provider's user information. | `SSOUserDefinedValues` |

LiteLLM uses the returned identity to complete sign-in. Configure roles, team membership, and restrictions through [SSO permissions](./access_management/sso_permissions.md).

## Prerequisites

Use a working LiteLLM deployment with the Admin UI, database, and master key configured. Put the handler module beside `config.yaml` or on the proxy's Python import path.

For the upstream-proxy hook, configure the proxy to authenticate requests, strip client-supplied identity headers, and set its own verified values. Restrict direct access to LiteLLM to that proxy. Set `general_settings.trusted_proxy_ranges` to its direct peer IPs or CIDRs; LiteLLM rejects header-based sign-in from untrusted peers.

For the post-sign-in callback, first configure [OpenID Connect](./admin_ui_sso.md) or [SAML](./saml_sso.md) and verify a normal sign-in.

## Setup

### Read identity headers from an authentication proxy {#option-1-custom-ui-sso-sign-in-handler}

<a id="usage"></a>
<a id="1-create-a-custom-ui-sso-handler-file"></a>

Save this as `custom_ui_sso.py`. Adjust the header names to match your authentication proxy. Reject missing identities instead of assigning a shared placeholder user.

```python title="custom_ui_sso.py"
from fastapi import HTTPException, Request
from fastapi_sso.sso.base import OpenID
from litellm.integrations.custom_sso_handler import CustomSSOLoginHandler


class HeaderIdentityHandler(CustomSSOLoginHandler):
    async def handle_custom_ui_sso_sign_in(self, request: Request) -> OpenID:
        user_id = request.headers.get("x-forwarded-user") or request.headers.get("x-user")
        email = request.headers.get("x-forwarded-email") or request.headers.get("x-email")
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Missing authenticated identity")
        display_name = (
            request.headers.get("x-forwarded-preferred-username")
            or request.headers.get("x-preferred-username")
            or user_id
        )
        return OpenID(
            id=user_id,
            email=email,
            display_name=display_name,
            provider="oauth-proxy",
        )


custom_ui_sso_sign_in_handler = HeaderIdentityHandler()
```

<a id="2-configure-in-configyaml"></a>

Add the handler instance to your existing configuration. Replace the example address with your authentication proxy's direct peer address:

```yaml title="config.yaml"
general_settings:
  custom_ui_sso_sign_in_handler: custom_ui_sso.custom_ui_sso_sign_in_handler
  trusted_proxy_ranges: ["10.0.0.10/32"]
```

### Customize the identity after provider sign-in {#option-2-custom-sso-handler-post-authentication}

<a id="how-it-works-1"></a>
<a id="usage-1"></a>
<a id="1-create-a-custom-sso-handler-file"></a>

Save this as `custom_sso.py`. The callback receives provider user information after sign-in and returns the stable user ID and email LiteLLM should use.

```python title="custom_sso.py"
from fastapi_sso.sso.base import OpenID
from litellm.proxy._types import SSOUserDefinedValues


async def custom_sso_handler(userIDPInfo: OpenID) -> SSOUserDefinedValues:
    if not userIDPInfo.id:
        raise ValueError("The identity provider returned no user ID")
    return SSOUserDefinedValues(
        user_id=userIDPInfo.id,
        user_email=userIDPInfo.email,
        user_role=None,
    )
```

`user_role=None` preserves the stored LiteLLM role; new users default to `internal_user_viewer`. An explicit role overrides it on every login. Configure role assignment in [SSO permissions](./access_management/sso_permissions.md).

<a id="2-configure-in-configyaml-1"></a>

Add the callback to the same configuration that contains your provider settings:

```yaml title="config.yaml"
general_settings:
  custom_sso: custom_sso.custom_sso_handler
```

<a id="3-start-the-proxy"></a>
<a id="3-start-the-proxy-1"></a>

Restart the proxy after configuring either hook:

```bash
litellm --config config.yaml
```

## Test sign-in

<a id="4-navigate-to-the-admin-ui"></a>

For the upstream-proxy hook, open the Admin UI through the authentication proxy and sign in with a test account. Confirm LiteLLM shows that account. A request from the trusted proxy with missing identity headers should be rejected by the example handler; a direct request from an untrusted peer should also fail.

For the post-sign-in callback, start a fresh browser session, sign in through your configured provider, and confirm the expected account opens in LiteLLM. Sign in again to check that the stable user ID resolves to the same account.

## Configuration reference

| Setting or callback | Contract |
| --- | --- |
| `general_settings.custom_ui_sso_sign_in_handler` | Module path to an instance of `CustomSSOLoginHandler`. |
| `handle_custom_ui_sso_sign_in(request)` | Async method returning an `OpenID` identity from the trusted request. |
| `general_settings.trusted_proxy_ranges` | Direct peer IPs or CIDRs allowed to supply identity headers. |
| `general_settings.custom_sso` | Module path to an async function receiving provider user information. |
| `SSOUserDefinedValues` | Supplies `user_id`, `user_email`, and optional overrides. See [SSO permissions](./access_management/sso_permissions.md) for permission fields. |

### Read additional provider fields

For a generic provider, set `GENERIC_USER_EXTRA_ATTRIBUTES` to the fields needed by your callback. They are available through `getattr(userIDPInfo, "extra_fields", None) or {}`. See [OIDC provider field mapping](./admin_ui_sso.md) for configuration.

Use the returned identity for authentication. For user and team lifecycle operations, see [identity provisioning](./identity_provisioning.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Handler cannot be imported | Confirm the module path and mounted Python file. The header hook refers to an instance; `custom_sso` refers to a function. |
| Header sign-in reports an untrusted proxy | Configure `trusted_proxy_ranges` for the direct peer that reaches LiteLLM, and confirm the request passes through that proxy. |
| Header sign-in reports a missing identity | Confirm the authentication proxy sets the expected headers after validating the user. |
| `user_custom_sso must be a coroutine function` | Define the post-sign-in callback with `async def`. |
| Repeated sign-ins create different users | Return a stable, nonempty provider ID instead of a changing email or display name. |
| Roles or teams are wrong after sign-in | Check [SSO permissions](./access_management/sso_permissions.md) and any explicit callback overrides. |

## Related guides

Configure providers through [OpenID Connect](./admin_ui_sso.md) or [SAML](./saml_sso.md). Use [SSO permissions](./access_management/sso_permissions.md) for access policies, [identity provisioning](./identity_provisioning.md) for user lifecycle management, and [Custom Auth](./custom_auth.md) for API request handlers.
