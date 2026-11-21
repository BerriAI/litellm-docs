---
title: Customer identity from JWT claims
sidebar_label: Identity from JWT claims
description: Track customer spend using signed JWT claims, or identify the app with a JWT and pass customer identity in request headers.
---

# Customer identity from JWT claims

[Enable JWT authentication](../token_auth.md), then choose where LiteLLM reads customer identity. You can put the customer organization and member in signed claims, or use the JWT to identify the app and send the customer identity in request headers.

## Send customer identity in JWT claims

To track customer spend without customer headers, include the customer identity in your signed JWT. Configure claim paths under `general_settings.litellm_jwtauth`.

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    customer_org_alias_jwt_field: "customer.org_alias"
    customer_member_id_jwt_field: "customer.member_id"
    customer_team_id_jwt_field: "customer.team_id"
```

Your identity provider can issue a token with these claims:

```json
{
  "customer": {
    "org_alias": "example-org",
    "member_id": "member-123",
    "team_id": "example-org:default"
  }
}
```

Send the token as `Authorization: Bearer <JWT>`. LiteLLM verifies the token before it reads customer identity. Once any customer claim is mapped, a JWT request takes its customer identity only from the token and ignores customer headers, including custom header names. Missing customer claims do not fall back to headers. Requests that do not use a JWT still read the headers.

The organization alias and member ID use the same lookup, automatic registration, budgets, and spend tracking as headers. A new member joins the organization's `default` team. The optional customer-team claim selects one of the member's teams, not a regular LiteLLM team, and cannot add team membership. Omit it to use the member's default team.

For multiple identity providers, set these same fields on each entry in `litellm_jwtauth.issuers`. Issuer-specific mappings override global mappings when the issuer's claim supplies a value. These customer mappings are separate from `org_id_jwt_field`, `team_id_jwt_field`, and the legacy `end_user_id_jwt_field`.

## Send the app in a JWT and the customer in headers {#app-jwt-customer-headers}

Map the JWT's `client_id` to the LiteLLM team that represents the app. The `client_id` value must match the LiteLLM team ID. Leave all three `customer_*_jwt_field` settings unset, both globally and in issuer configurations, so LiteLLM reads the customer from headers.

By default, use `x-litellm-customer-org-alias` and `x-litellm-customer-member-id`. If your caller already sends `X-Tenant-ID` and `X-User-ID`, configure LiteLLM to read those names instead:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    team_id_jwt_field: client_id
  customer_org_alias_header: X-Tenant-ID
  customer_member_id_header: X-User-ID
```

The configured names replace the corresponding defaults. The tenant header carries the customer organization **alias**, and the user header carries the customer member **ID**. Send both headers with the JWT in the same request. Replace `example-model` with a model available to the app's team.

```bash
curl https://your-proxy.example.com/v1/chat/completions \
  -H "Authorization: Bearer ${LITELLM_JWT}" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: example-org" \
  -H "X-User-ID: member-123" \
  -d '{"model":"example-model","messages":[{"role":"user","content":"Hello"}]}'
```

LiteLLM records the app's team and the customer organization and member on the same spend log entry.

### Require selected customer headers

Customer headers are optional unless you require them. Set `required_customer_headers` to the actual header names callers must send. Use `["X-Tenant-ID"]` for the organization header, `["X-User-ID"]` for the member header, or both names for both headers.

For a gateway that serves internal and customer traffic, configure the requirement on a regular LiteLLM team or virtual key through its `metadata`. These are the app's LiteLLM team and key, separate from the customer organization, team, and member used for customer budgets.

Require the tenant header for a LiteLLM team with `/team/update`:

```bash
curl https://your-proxy.example.com/team/update \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"team_id":"customer-app","metadata":{"required_customer_headers":["X-Tenant-ID"]}}'
```

This requirement applies to the team's virtual keys, JWT requests that map to the team through `team_id_jwt_field`, and OAuth2 or trusted OAuth2-proxy requests that resolve to the team. The same metadata works when you create the team with `/team/new`.

Require the user header for one virtual key with `/key/update`:

```bash
curl https://your-proxy.example.com/key/update \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"key":"sk-your-virtual-key","metadata":{"required_customer_headers":["X-User-ID"]}}'
```

Only proxy administrators can set, change, or clear this policy on teams and keys. Key owners can still edit unrelated fields, but replacement metadata must retain the stored policy. The same protection applies to bulk key updates and key rotation. Only a proxy administrator can move or detach a key from a team with required headers.

The same metadata works with `/key/generate`. Team and key requirements add together. A key in the team above requires both headers if its own metadata requires `X-User-ID`. An empty key list does not remove a team requirement. Teams and keys with no requirement keep headers optional unless the gateway requires them. Merge the field into any existing metadata you want to preserve.

To require headers for every authenticated inference request, set the gateway-wide option in YAML and restart the proxy:

```yaml
general_settings:
  required_customer_headers: [X-Tenant-ID, X-User-ID]
```

The gateway-wide list also adds to team and key requirements. Omit a scope's setting or use `[]` to add no requirement at that scope. Team and key metadata also accept `null` for this field. The gateway-wide setting is YAML-only. It cannot be changed through the Admin API or dashboard, and values stored in the database are ignored. The scoped settings use the team and key management APIs; there is no dedicated dashboard control for them.

LiteLLM resolves the authenticated team using the existing auth cache and checks the combined requirements before customer lookup and budget reservation. Custom-auth deployments keep their existing common-checks contract. Enable `custom_auth_run_common_checks` to load stored team policies, or return trusted team metadata from the custom authenticator.

LiteLLM returns HTTP 403 when a required header is missing or blank. Header names are case-insensitive. Health, information, and management routes do not require these headers. A JWT does not substitute for a required header, and the requirement does not change whether LiteLLM reads customer identity from claims or headers. The header names must also match `customer_org_alias_header` and `customer_member_id_header` if you want them to identify the customer.

With Rust-first forwarding enabled (`LITELLM_RUST_FIRST=true`), a nonempty gateway-wide list sends master-key `POST /v1/messages` requests to the Python proxy for header validation. An empty or omitted gateway-wide list leaves that routing unchanged. Virtual-key and JWT requests already use the Python authentication path, where team and key requirements are checked.

:::warning
Customer headers are not signed by the JWT. Use them only with trusted callers or an ingress that strips incoming identity headers and sets them from verified identity. Use signed customer claims if untrusted clients can reach the proxy directly.
:::
