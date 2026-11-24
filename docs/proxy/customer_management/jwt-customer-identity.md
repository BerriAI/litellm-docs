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

:::warning
Customer headers are not signed by the JWT. Use them only with trusted callers or an ingress that strips incoming identity headers and sets them from verified identity. Use signed customer claims if untrusted clients can reach the proxy directly.
:::
