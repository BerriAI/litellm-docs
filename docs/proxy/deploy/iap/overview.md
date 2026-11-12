---
title: Identity-Aware Proxy
sidebar_label: Identity-Aware Proxy
toc_max_heading_level: 2
description: Forward verified corporate identities to LiteLLM with Cloudflare Access, AWS ALB, Microsoft Entra Application Proxy, or Google Cloud IAP.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Identity-Aware Proxy

{/* keep-version-note */}

An identity-aware proxy authenticates the caller before forwarding the request to LiteLLM. It sends the verified identity in a signed token or trusted headers. LiteLLM reads that identity and applies user and team permissions.

Keep LiteLLM private. Allow access only from the proxy or its private connector. These examples use LiteLLM Enterprise and an existing database. Configure your users, teams, and model access through [Access Management](../../access_management/overview.md).

Each section shows the proxy configuration and the identity it forwards. General authentication setup lives in [Authentication](../../authentication.md).

## Cloudflare Access {#cloudflare}

Use Access to authenticate employees and Tunnel to reach the private origin. Require Gateway so only devices enrolled in your Zero Trust account can connect.

<IngressArchitecture kind="iap-cloudflare" />

### Configuration

Enroll employee devices in the Cloudflare One Client with **Traffic and DNS** or **Traffic only** mode. In **Zero Trust → Reusable components → Posture checks**, add the **Gateway** check. Route the application, IdP, and team domain through the client. See [Require Gateway](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/client-checks/require-gateway/) and [posture routing](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/).

Create a self-hosted Access application for `llm.corp.example.com` with no path limit. Configure this **Allow** policy:

| Rule | Selector | Value |
| --- | --- | --- |
| Include | Emails | `employee@example.com` and other approved employees |
| Require | Login Methods | Your corporate IdP |
| Require | Gateway | Select the enabled Gateway check |

All Require rules must pass. Apply the same requirements to every Allow policy for this hostname. Remove Bypass policies. The Gateway check requires your organization's client connection. The WARP check alone also accepts consumer WARP. See [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) and [Require Gateway](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/client-checks/require-gateway/).

Configure a Tunnel connector that can reach your private ingress:

```yaml title="cloudflared configuration"
ingress:
  - hostname: llm.corp.example.com
    service: https://identity.internal.example.com:443
    originRequest:
      originServerName: identity.internal.example.com
      caPool: /etc/cloudflared/origin-ca.pem
      noTLSVerify: false
      access:
        required: true
        teamName: YOUR_CLOUDFLARE_TEAM
        audTag: [ACCESS_APPLICATION_AUD]
  - service: http_status:404
```

Run connectors on separate hosts. Allow origin access only from the connectors. For a remotely managed tunnel, set the same origin options in its published application route. See [Tunnel origin settings](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).

### Identity forwarding

Access sends the signed identity in `Cf-Access-Jwt-Assertion`. Route the tunnel to a private NGINX ingress. Add these directives inside its existing HTTPS location for LiteLLM:

```nginx
if ($http_cf_access_jwt_assertion = "") { return 401; }
proxy_set_header X-LiteLLM-IAP-Token "Bearer $http_cf_access_jwt_assertion";
proxy_set_header Authorization "";
proxy_set_header litellm_user_api_key "";
```

NGINX overwrites the header and adds the `Bearer` prefix that LiteLLM expects. Allow only tunnel connectors to reach NGINX and only NGINX to reach LiteLLM. Keep [backend certificate verification](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify) enabled and [response buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) disabled.

Add these fields to your existing LiteLLM JWT configuration:

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_key_header_name: X-LiteLLM-IAP-Token
  litellm_jwtauth:
    user_id_jwt_field: sub
    user_email_jwt_field: email
```

```bash
export JWT_PUBLIC_KEY_URL=https://YOUR_TEAM.cloudflareaccess.com/cdn-cgi/access/certs
export JWT_ISSUER=https://YOUR_TEAM.cloudflareaccess.com
export JWT_AUDIENCE=ACCESS_APPLICATION_AUD
```

LiteLLM verifies the Access assertion and reads `sub` and `email`. Merge these fields with your [user and team mappings](../../jwt_user_team_auth.md). Require a nonempty `sub` with a [claim validator](../../jwt_auth_reference.md#custom-jwt-validate). This example uses employee tokens. Cloudflare service tokens use `common_name` instead of `sub` and need a separate Access policy and identity mapping. See [Access token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) and [token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

## AWS Application Load Balancer {#aws}

Use an internal ALB to authenticate application requests with JWT validation. Corporate clients reach it through VPN, Direct Connect, or approved private access. Allow only the ALB security group to reach LiteLLM.

<IngressArchitecture kind="iap-aws" />

### Configuration

Use an HTTPS listener. Configure your IdP to issue RS256 tokens signed with a 2048-bit RSA key. Clients send the token in `Authorization: Bearer`. Save these actions as `actions-jwt.json`:

```json title="actions-jwt.json"
[
  {
    "Type": "jwt-validation",
    "Order": 1,
    "JwtValidationConfig": {
      "JwksEndpoint": "https://idp.example.com/.well-known/jwks.json",
      "Issuer": "https://idp.example.com",
      "AdditionalClaims": [
        {"Name": "aud", "Format": "single-string", "Values": ["litellm-proxy"]},
        {"Name": "scope", "Format": "space-separated-values", "Values": ["llm:invoke"]}
      ]
    }
  },
  {
    "Type": "forward",
    "Order": 2,
    "TargetGroupArn": "EXISTING_TARGET_GROUP_ARN"
  }
]
```

Replace the issuer, JWKS URL, claim values, and target group. Use `string-array` for `aud` if your IdP puts the audience in an array. Apply the actions to the API rule:

```bash
aws elbv2 modify-rule \
  --rule-arn "$API_RULE_ARN" \
  --actions file://actions-jwt.json
```

This replaces the rule's action list. Preserve any weighted targets or stickiness settings you need. Protect every API route and remove unprotected default forwarding. ALB requires a public HTTPS JWKS endpoint with at most 10 keys and a response of at most 150 KB. See [ALB JWT validation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-verify-jwt.html), [claim formats](https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_JwtValidationActionAdditionalClaim.html), and [modify-rule](https://docs.aws.amazon.com/cli/latest/reference/elbv2/modify-rule.html).

### Identity forwarding

ALB validates the token and forwards the original `Authorization` header unchanged. Use the same issuer, audience, and JWKS endpoint in LiteLLM's existing [JWT configuration](../../token_auth.md):

```bash
export JWT_PUBLIC_KEY_URL=https://idp.example.com/.well-known/jwks.json
export JWT_ISSUER=https://idp.example.com
export JWT_AUDIENCE=litellm-proxy
```

Map the verified claims to [LiteLLM users and teams](../../jwt_user_team_auth.md). No client LiteLLM key or header adapter is needed. The ALB scope check controls access to the route. LiteLLM applies model permissions and budgets.

ALB does not verify HTTPS target certificates. Restrict target access to the ALB. Use an ingress that verifies backend certificates if your policy requires that check. See [ALB target group protocols](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html).

## Microsoft Entra Application Proxy {#azure}

Use Microsoft Entra Application Proxy to authenticate employees and reach LiteLLM through private-network connectors. Keep the origin private. Require your corporate device and access policies through Conditional Access.

<IngressArchitecture kind="iap-azure" />

### Configuration

This setup requires Microsoft Entra ID P1 or P2. Install private-network connectors on two hosts that can reach LiteLLM. In **Entra ID → Enterprise apps → New application**, choose **Add an on-premises application** and enter:

| Setting | Value |
| --- | --- |
| Name | `LiteLLM` |
| Internal URL | `https://identity.internal.example.com/`, your private NGINX ingress |
| External URL | `https://llm.corp.example.com/` with your custom domain certificate and DNS |
| Pre Authentication | Microsoft Entra ID |
| Connector Group | The group containing your two connectors |
| Validate Backend TLS Certificate | Enabled |
| User assignment | Approved employees or groups |

For a new application, open **Permissions** and grant admin consent for the delegated `User.Read` permission. Follow [Application Proxy setup](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-add-on-premises-application) and [custom domain setup](https://learn.microsoft.com/en-us/entra/identity/app-proxy/how-to-configure-custom-domain).

Target this Enterprise application with a Conditional Access policy. Under **Grant**, select **Require device to be marked as compliant**. Use your existing Intune compliance policy. Test in report-only mode, then enable the policy. See [device compliance setup](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-compliance).

### Identity forwarding

Under **Single sign-on → Header-based → Headers → Add new header**, select **Attribute** and add these mappings:

| Request header | Entra user attribute |
| --- | --- |
| `X-LiteLLM-User-ID` | `user.objectid` |
| `X-LiteLLM-User-Email` | `user.mail` |

Configure Application Proxy to set these headers from the authenticated user. Populate the email attribute for every assigned user. Allow only connector hosts to reach the origin. These are trusted proxy headers, not signed JWTs. See [Entra header-based SSO](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-configure-single-sign-on-with-headers).

At the private NGINX ingress, reject missing identity headers and supply the approved LiteLLM team. Add these directives inside its existing HTTPS location:

```nginx
if ($http_x_litellm_user_id = "") { return 401; }
if ($http_x_litellm_user_email = "") { return 401; }
proxy_set_header X-LiteLLM-User-ID $http_x_litellm_user_id;
proxy_set_header X-LiteLLM-User-Email $http_x_litellm_user_email;
proxy_set_header X-LiteLLM-Team-ID corporate-api;
proxy_set_header Authorization "";
proxy_set_header litellm_user_api_key "";
```

Create the `corporate-api` team in LiteLLM and configure its model access and budgets. Allow only connector hosts to reach NGINX and only NGINX to reach LiteLLM. Keep backend TLS verification enabled. Configure LiteLLM's native trusted-header authentication:

```yaml title="config.yaml"
general_settings:
  enable_oauth2_proxy_auth: true
  trusted_proxy_ranges: ["10.20.1.10/32"]
  oauth2_config_mappings:
    user_id: X-LiteLLM-User-ID
    user_email: X-LiteLLM-User-Email
    team_id: X-LiteLLM-Team-ID
```

Replace the CIDR with the direct NGINX peers that LiteLLM sees. Each mapping value is a header name. LiteLLM accepts the forwarded user and team without a client LiteLLM key. Use this mode separately from `custom_auth` and `enable_jwt_auth`.

Entra application assignments control who can connect. A missing LiteLLM user record does not by itself deny access in this mode. The fixed team selects the stored model and budget policies. Do not accept a client-supplied team or role. See [LiteLLM configuration](../../config_settings.md) and the [trusted-header implementation](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/auth/oauth2_proxy_hook.py).

Application Proxy supports user sign-in and delegated user access. It does not provide this flow for unattended service principals. See [Microsoft's API access guidance](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-secure-api-access).

## Google Cloud IAP {#gcp}

Use IAP on the internal Application Load Balancer in the [GCP architecture](../cloud/gcp.md). Corporate clients reach its private address through Cloud VPN or Cloud Interconnect.

<IngressArchitecture kind="iap-gcp" />

### Configuration

Set these values to your project, region, and deployment name prefix. This example keeps the module's `-gateway-bs`, `-backend-bs`, and `-ui-bs` names after the private-ingress changes:

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
export LITELLM_NAME=litellm-prod

gcloud services enable iap.googleapis.com --project "$PROJECT_ID"

for COMPONENT in gateway backend ui
do
  BACKEND_SERVICE="${LITELLM_NAME}-${COMPONENT}-bs"
  gcloud compute backend-services update "$BACKEND_SERVICE" \
    --project "$PROJECT_ID" --region "$REGION" --iap=enabled

  gcloud iap web add-iam-policy-binding \
    --project "$PROJECT_ID" --region "$REGION" \
    --resource-type=backend-services --service="$BACKEND_SERVICE" \
    --member="group:litellm-users@example.com" \
    --role=roles/iap.httpsResourceAccessor
done
```

This grants the group access to each protected backend. See [regional IAP setup](https://docs.cloud.google.com/iap/docs/enabling-compute-howto) and [IAP IAM bindings](https://docs.cloud.google.com/sdk/gcloud/reference/iap/web/add-iam-policy-binding).

For the three Cloud Run services, [create the IAP service agent](https://docs.cloud.google.com/sdk/gcloud/reference/beta/services/identity/create) and grant it access:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud beta services identity create --service=iap.googleapis.com --project "$PROJECT_ID"

for COMPONENT in gateway backend ui
do
  SERVICE="${LITELLM_NAME}-${COMPONENT}"
  gcloud run services add-iam-policy-binding "$SERVICE" \
    --project "$PROJECT_ID" --region "$REGION" \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com" \
    --role=roles/run.invoker

  gcloud run services remove-iam-policy-binding "$SERVICE" \
    --project "$PROJECT_ID" --region "$REGION" \
    --member=allUsers --role=roles/run.invoker

  gcloud run services update "$SERVICE" \
    --project "$PROJECT_ID" --region "$REGION" \
    --ingress=internal --invoker-iam-check --no-default-url
done
```

The removal command applies to the module's existing `allUsers` grants. Skip it if you already removed them. Also remove any `allAuthenticatedUsers` invoker grant. Keep these settings in your Terraform fork so a later apply preserves them. See [IAP with Cloud Run](https://docs.cloud.google.com/iap/docs/enabling-cloud-run) and [Cloud Run ingress and IAM flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update). For GKE or VM backends, restrict access to the internal load balancer and required health checks.

### Identity forwarding

IAP sends the caller's signed identity in `x-goog-iap-jwt-assertion`. Put a private NGINX adapter before LiteLLM. For Cloud Run, expose only NGINX on port `8080`. Listen over HTTP on `0.0.0.0:8080` and proxy to LiteLLM's existing port on `localhost`. Remove the exposed port from the LiteLLM container. See [Cloud Run port requirements](https://docs.cloud.google.com/run/docs/container-contract#port).

Add these directives inside NGINX's proxy location:

```nginx
if ($http_x_goog_iap_jwt_assertion = "") { return 401; }
proxy_set_header X-LiteLLM-IAP-Token "Bearer $http_x_goog_iap_jwt_assertion";
proxy_set_header Authorization "";
proxy_set_header litellm_user_api_key "";
```

The adapter adds the `Bearer` prefix. It does not authenticate the user. LiteLLM verifies the signed assertion. Restrict access to the IAP path, disable response buffering, and keep backend TLS verification enabled for separate NGINX hosts.

Add these fields to your existing LiteLLM JWT configuration:

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_key_header_name: X-LiteLLM-IAP-Token
  litellm_jwtauth:
    user_id_jwt_field: sub
    user_email_jwt_field: email
```

```bash
export JWT_PUBLIC_KEY_URL=https://www.gstatic.com/iap/verify/public_key-jwk
export JWT_ISSUER=https://cloud.google.com/iap
export JWT_AUDIENCE=SIGNED_HEADER_JWT_AUDIENCE
```

In IAP, open the protected API backend's **More → Signed Header JWT Audience** and copy that value. It identifies the backend resource. Do not use the OAuth client ID as this audience. Configure each separately protected LiteLLM backend with its own audience.

Map `sub` and `email` through your [user and team mappings](../../jwt_user_team_auth.md). Require a nonempty `sub` with a [claim validator](../../jwt_auth_reference.md#custom-jwt-validate). See [IAP signed headers](https://docs.cloud.google.com/iap/docs/signed-headers-howto) and [Cloud Run ingress containers](https://docs.cloud.google.com/run/docs/configuring/services/containers).

You can also enable IAP directly on a Cloud Run service. Keep its ingress private and use that service's signed-header audience. Enable IAP at either Cloud Run or the load balancer, not both.

## Verify the architecture

| Check | Expected result |
| --- | --- |
| Approved caller uses the protected route | LiteLLM records the forwarded user and expected team |
| Caller fails the IAP access policy | The IAP rejects the request before it reaches LiteLLM |
| Caller sends a forged token or identity header | The IAP, private adapter, or LiteLLM rejects it or replaces it with verified identity |
| Caller connects directly to LiteLLM | Network controls block the connection |
| Allowed caller requests a model outside the mapped team's permissions | LiteLLM rejects the request |

For signed-token paths, test an expired token and a token for a different application. For Entra, test missing identity headers and a caller outside the assigned groups. Confirm user and team attribution in LiteLLM's request logs. Test a long streaming request through the complete path.
