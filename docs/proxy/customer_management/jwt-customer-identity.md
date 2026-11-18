---
title: Customer identity from JWT claims
sidebar_label: Identity from JWT claims
description: Map signed JWT claims to the customer org, customer member, and customer team so spend is attributed without customer headers.
---

# Customer identity from JWT claims

To track customer spend without customer headers, include the customer identity in your signed JWT. Configure claim paths under `general_settings.litellm_jwtauth` after you [enable JWT authentication](../token_auth.md).

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

Send the token as `Authorization: Bearer <JWT>`. LiteLLM verifies the token before it reads customer identity. Once any customer claim is mapped, a JWT request takes its customer identity only from the token and ignores the `x-litellm-customer-org-alias`, `x-litellm-customer-member-id`, and `x-litellm-customer-team-id` headers, so a caller cannot name a different customer. A token without the claims runs without customer tracking. Requests that do not use a JWT still read the headers.

The organization alias and member ID use the same lookup, automatic registration, budgets, and spend tracking as headers. A new member joins the organization's `default` team. The optional customer-team claim selects one of the member's teams, not a regular LiteLLM team, and cannot add team membership. Omit it to use the member's default team.

For multiple identity providers, set these same fields on each entry in `litellm_jwtauth.issuers`. Issuer-specific mappings override global mappings when the issuer's claim supplies a value. These customer mappings are separate from `org_id_jwt_field`, `team_id_jwt_field`, and the legacy `end_user_id_jwt_field`.
