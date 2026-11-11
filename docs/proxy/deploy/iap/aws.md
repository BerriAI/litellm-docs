---
title: AWS identity-aware ingress
sidebar_label: AWS
description: Add browser OIDC authentication or machine JWT validation to an AWS ALB in front of LiteLLM, while preserving LiteLLM keys and roles.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# AWS identity-aware ingress

{/* keep-version-note */}

For the [AWS deployment](../cloud/aws.md), use Application Load Balancer (ALB) authentication when the ALB already routes your LiteLLM traffic. Use an `authenticate-oidc` action for browser sign-in and a separate `jwt-validation` rule for machine API clients.

<IngressArchitecture kind="iap-aws" />

AWS Verified Access is another option when you need access policies that evaluate user and device trust before a private application. It is a separate service and policy model; adding OIDC to an ALB does not enable Verified Access. See [how Verified Access works](https://docs.aws.amazon.com/verified-access/latest/ug/how-it-works.html).

## Protect the Admin UI with OIDC

Use an HTTPS listener with a certificate for your public hostname. Register a confidential OIDC application with your identity provider and allow `https://admin.example.com/oauth2/idpresponse` as its callback. Restrict the IdP application's access policy to approved employees. The ALB needs the issuer, authorization, token, and user-info URLs, plus the client ID and secret. Its network must reach the token and user-info endpoints over IPv4. [ALB OIDC setup](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html).

On every rule that forwards traffic for the admin hostname, place authentication before the existing forwarding action:

| Action | Configuration |
| --- | --- |
| First: `authenticate-oidc` | Your IdP settings; `Scope=openid`; `OnUnauthenticatedRequest=authenticate` |
| Last: `forward` | The existing target group for that route |

Keep the UI, backend, and gateway routing intact. Protect the default forwarding rule too. A rule covering only `/ui` misses its assets and management requests. The [Terraform AWS module](../terraform.md#aws) does not configure these identity rules for you; maintain them in the infrastructure code that owns the listener.

The ALB redirects a browser to the IdP and then uses a session cookie. A bearer token from an SDK does not replace this browser flow. Set LiteLLM's `PROXY_BASE_URL` to the public origin and retain its UI login or SSO. ALB claims do not automatically become LiteLLM roles. [ALB authentication flow](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html).

## Protect machine API traffic

ALB supports [machine-to-machine JWT validation](https://aws.amazon.com/about-aws/whats-new/2025/11/application-load-balancer-jwt-verification/). Use a separate API hostname or rule with **Validate token**, followed by **Forward**. Configure the issuer and a publicly accessible HTTPS JWKS endpoint. Use RS256 tokens, require the audience and scope intended for this API, and check that your issuer meets the [JWKS limits](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-verify-jwt.html).

For example, this action fragment requires a string-valued `aud` claim. Use the claim format that your issuer actually emits and add its required API scope as another claim check. Keep your existing forwarding action after this action. [Action fields](https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_JwtValidationActionConfig.html), [claim formats](https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_JwtValidationActionAdditionalClaim.html).

```json
{
  "Type": "jwt-validation",
  "Order": 1,
  "JwtValidationConfig": {
    "Issuer": "https://issuer.example.com",
    "JwksEndpoint": "https://issuer.example.com/.well-known/jwks.json",
    "AdditionalClaims": [
      {"Name": "aud", "Format": "single-string", "Values": ["litellm-api"]}
    ]
  }
}
```

ALB reads the JWT from `Authorization: Bearer ...` and forwards the valid token unchanged to its target. [ALB header requirements](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html), [ALB token forwarding](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-verify-jwt.html).

Configure a [custom LiteLLM key header](../../virtual_keys.md#pass-litellm-key-in-custom-header) so clients can supply both credentials. When this header is present, LiteLLM uses its value for key authentication. Include the `Bearer` prefix:

```yaml title="config.yaml fragment for the API deployment"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  litellm_key_header_name: X-Litellm-Key
```

Obtain `IDP_ACCESS_TOKEN` through your issuer's supported workload flow, then send both credentials:

```bash
curl --fail-with-body https://api.example.com/v1/models \
  -H "Authorization: Bearer $IDP_ACCESS_TOKEN" \
  -H "X-Litellm-Key: Bearer $LITELLM_API_KEY"
```

Verify both the API call and Admin UI sign-in if they share a deployment. With LiteLLM Enterprise, [JWT identity mapping](../../jwt_user_team_auth.md) can validate the issuer token in LiteLLM instead of using a second key header.

## Keep the origin private and test

Allow target ingress only from the ALB security group. Frontend HTTPS terminates at the ALB; configure HTTPS targets if the next hop must also use TLS. The default Terraform targets use HTTP. If custom code uses ALB identity claims, verify the signed `x-amzn-oidc-data` token and its expected ALB signer before trusting it. [AWS origin and claims guidance](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html).

Confirm browser sign-in reaches LiteLLM, an unassigned IdP user is denied, and a normal LiteLLM user cannot perform admin actions. For API rules, missing, expired, wrong-audience, and invalid-signature tokens must fail at the ALB. A valid IdP token with a bad LiteLLM key must fail at LiteLLM. Direct target access must fail. Use the ALB [authentication error codes](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html) to identify which layer rejected the request.
