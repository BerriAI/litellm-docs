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

These examples use LiteLLM Enterprise and an existing database. Configure your users, teams, and model access through [Access Management](../../access_management/overview.md).

For general setup, see [Authentication](../../authentication.md).

## Cloudflare Access {#cloudflare}

Use Access to authenticate employees and Tunnel to reach the private origin. Require Gateway so only devices enrolled in your Zero Trust account can connect.

<IngressArchitecture kind="iap-cloudflare" />

### Configuration

Enroll employee devices in the Cloudflare One Client with **Traffic and DNS** or **Traffic only** mode. In **Zero Trust → Reusable components → Posture checks**, add the **Gateway** check. Route the application, IdP, and team domain through the client. See [Require Gateway](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/client-checks/require-gateway/) and [posture routing](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/).

Create a self-hosted Access application for `llm.corp.example.com` with no path limit. Allow IdP groups that correspond to LiteLLM teams. For example, this **Allow** policy grants access to two Okta groups:

| Rule | Selector | Value |
| --- | --- | --- |
| Include | Okta Groups | `litellm-engineering`, `litellm-data-science` |
| Require | Login Methods | Your Okta integration |
| Require | Gateway | Select the enabled Gateway check |

Configure Okta to return these groups in its `groups` claim. Push the groups through SCIM to populate the **Okta Groups** selector. See [Cloudflare's Okta setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/okta/).

All Require rules must pass. Apply the same requirements to every Allow policy for this hostname. Remove Bypass policies. The Gateway check requires your organization's client connection. The WARP check alone also accepts consumer WARP. See [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) and [Require Gateway](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/client-checks/require-gateway/).

Run two `cloudflared` replicas in your cluster. For a token-managed tunnel, read `TUNNEL_TOKEN` from a Kubernetes Secret and run `cloudflared tunnel --no-autoupdate run`. See [Deploy cloudflared on Kubernetes](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/).

Point the tunnel at NGINX's private HTTPS endpoint:

```yaml title="Locally managed cloudflared route"
ingress:
  - hostname: llm.corp.example.com
    service: https://ingress.internal.example.com:443
    originRequest:
      originServerName: ingress.internal.example.com
      caPool: /etc/cloudflared/origin-ca.pem
      noTLSVerify: false
      access:
        required: true
        teamName: YOUR_CLOUDFLARE_TEAM
        audTag: [ACCESS_APPLICATION_AUD]
  - service: http_status:404
```

For a remotely managed tunnel, set the same origin options in its published application route. See [Tunnel origin settings](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).

### Identity forwarding

Access sends a signed JWT in `Cf-Access-Jwt-Assertion`. `cloudflared` forwards it unchanged.

Use an Okta custom authorization server with the `groups` scope and set its **Authorization Server ID** in Cloudflare's [Okta integration](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/okta/). Add `groups` under **OIDC Claims** so Access includes it in the JWT as `custom.groups`. Limit the Okta claim to your LiteLLM groups. See [custom OIDC claims](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/#custom-oidc-claims).

Create LiteLLM teams with IDs `litellm-engineering` and `litellm-data-science`, then assign their [model permissions and budgets](../../access_management/jwt_permissions.md#control-model-access-with-teams). The group values must match the team IDs.

NGINX adds the `Bearer` prefix that LiteLLM expects. Add these directives to its HTTPS proxy location for LiteLLM:

```nginx
if ($http_cf_access_jwt_assertion = "") { return 401; }
proxy_set_header X-LiteLLM-IAP-Token "Bearer $http_cf_access_jwt_assertion";
proxy_set_header Authorization "";
proxy_set_header litellm_user_api_key "";
```

Keep [backend certificate verification](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify) enabled and [response buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) disabled.

Configure LiteLLM to verify the JWT and map its claims:

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_key_header_name: X-LiteLLM-IAP-Token
  litellm_jwtauth:
    user_id_jwt_field: sub
    user_email_jwt_field: email
    team_ids_jwt_field: custom.groups
    user_id_upsert: true
    enforce_team_based_model_access: true
    fallback_to_db_teams: false
```

```bash
export JWT_PUBLIC_KEY_URL=https://YOUR_TEAM.cloudflareaccess.com/cdn-cgi/access/certs
export JWT_ISSUER=https://YOUR_TEAM.cloudflareaccess.com
export JWT_AUDIENCE=ACCESS_APPLICATION_AUD
```

LiteLLM verifies the JWT and applies the mapped team's permissions. Keep database team fallback disabled and leave `team_id_default` unset so requests without team claims are rejected. Access can omit custom claims that exceed its token size limit. Limit the group list to LiteLLM teams. See [Access token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/) and [LiteLLM user and team mappings](../../jwt_user_team_auth.md).

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

Map the verified claims to [LiteLLM users and teams](../../jwt_user_team_auth.md). The ALB scope check controls access to the route. LiteLLM applies model permissions and budgets.

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

Populate the email attribute for every assigned user. Allow only connector hosts to reach the origin. These are trusted proxy headers, not signed JWTs. See [Entra header-based SSO](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-configure-single-sign-on-with-headers).

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

Replace the CIDR with the direct NGINX peers that LiteLLM sees. LiteLLM accepts the forwarded user and team without a client LiteLLM key. Use this mode separately from `custom_auth` and `enable_jwt_auth`.

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

LiteLLM verifies the signed assertion. Restrict access to the IAP path, disable response buffering, and keep backend TLS verification enabled for separate NGINX hosts.

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
