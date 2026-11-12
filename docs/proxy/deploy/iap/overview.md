---
title: Identity-Aware Proxy
sidebar_label: Identity-Aware Proxy
toc_max_heading_level: 2
description: Forward verified corporate identities to LiteLLM with Cloudflare Access, AWS ALB, Microsoft Entra Application Proxy, or Google Cloud IAP.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Identity-Aware Proxy

{/* keep-version-note */}

Use an identity-aware proxy to check corporate identity before a request reaches LiteLLM. Forward that identity so LiteLLM can sign the user into the Admin UI or apply API permissions to the caller.

Keep LiteLLM on a private network. Allow access through your corporate network or approved access service. Identity checks do not replace these network restrictions.

| Use case | LiteLLM configuration |
| --- | --- |
| Sign employees into the Admin UI with their existing corporate identity | Validate the proxy's identity with the [UI sign-in handler](#admin-ui-sign-in). LiteLLM creates a session for that user and applies the user's stored role. |
| Authorize API calls without a separate LiteLLM key | Validate a signed token with [JWT authentication](../../token_auth.md). Map its claims to existing LiteLLM users and teams. |
| Track users behind an application that holds a virtual key | Forward a verified identity as a [customer header](../mtls.md#configure-litellm-identity). The virtual key still controls access. |

## Admin UI sign-in

This setup requires LiteLLM Enterprise and a database. Download [identity_sso.py](/examples/iap/identity_sso.py) and mount it beside `config.yaml` in the backend container. For a single-service deployment, mount it in the proxy container.

The handler verifies Cloudflare, AWS, or GCP assertions. For Azure, it reads headers from trusted Application Proxy connectors. It returns a stable user ID and email to LiteLLM.

```yaml title="config.yaml"
general_settings:
  custom_ui_sso_sign_in_handler: identity_sso.handler
  trusted_proxy_ranges: ["10.42.8.0/24"]
```

Replace the CIDR with the direct proxy or connector addresses that LiteLLM sees. Restrict network access to those same sources. Set `PROXY_BASE_URL` to your corporate HTTPS URL. Configure the handler's environment variables in the provider section below.

The handler preserves existing LiteLLM roles. New users receive `internal_user_viewer`. Assign roles and teams through [Access Management](../../access_management/sso_permissions.md). The proxy does not grant an admin role. This handler creates UI sessions. For API authentication, see [Authentication](../../authentication.md).

## Cloudflare Access {#cloudflare}

Use Access to authenticate employees and Tunnel to reach the private origin. Require Gateway so only devices enrolled in your Zero Trust account can connect.

<IngressArchitecture kind="iap-cloudflare" />

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
    service: https://litellm.internal.example.com:443
    originRequest:
      originServerName: litellm.internal.example.com
      caPool: /etc/cloudflared/origin-ca.pem
      noTLSVerify: false
      access:
        required: true
        teamName: YOUR_CLOUDFLARE_TEAM
        audTag: [ACCESS_APPLICATION_AUD]
  - service: http_status:404
```

Run connectors on separate hosts. Allow origin access only from the connectors. For a remotely managed tunnel, set the same origin options in its published application route. See [Tunnel origin settings](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).

Access forwards `Cf-Access-Jwt-Assertion`. Configure the UI handler:

```bash
export IAP_PROVIDER=cloudflare
export CF_ACCESS_TEAM_DOMAIN=https://YOUR_TEAM.cloudflareaccess.com
export CF_ACCESS_AUDIENCE=ACCESS_APPLICATION_AUD
```

The handler checks the token's signature, issuer, audience, and expiry. It maps `sub` to the LiteLLM user ID and `email` to the user email. It rejects service tokens for browser sign-in. [Cloudflare assertion format](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

## AWS Application Load Balancer (OIDC) {#aws}

Use an **internal ALB** reached through VPN, Direct Connect, or your corporate private access service. Limit listener access to corporate client CIDRs. Keep the LiteLLM targets private and allow target traffic only from the ALB security group.

<IngressArchitecture kind="iap-aws" />

Register an OIDC application with callback `https://llm.corp.example.com/oauth2/idpresponse`. Save these actions as `actions-oidc.json`. Set the IdP URLs, client ID, secret, and existing target group ARN:

```json title="actions-oidc.json"
[
  {
    "Type": "authenticate-oidc",
    "Order": 1,
    "AuthenticateOidcConfig": {
      "Issuer": "https://idp.example.com",
      "AuthorizationEndpoint": "https://idp.example.com/authorize",
      "TokenEndpoint": "https://idp.example.com/token",
      "UserInfoEndpoint": "https://idp.example.com/userinfo",
      "ClientId": "OIDC_CLIENT_ID",
      "ClientSecret": "LOAD_FROM_SECRET_STORE",
      "Scope": "openid email",
      "OnUnauthenticatedRequest": "authenticate"
    }
  },
  {
    "Type": "forward",
    "Order": 2,
    "TargetGroupArn": "EXISTING_TARGET_GROUP_ARN"
  }
]
```

Load the client secret from your secret store into the file. Apply the actions to an existing HTTPS browser rule:

```bash
aws elbv2 modify-rule \
  --rule-arn "$BROWSER_RULE_ARN" \
  --actions file://actions-oidc.json
```

Repeat for every browser route, including UI assets and management APIs. Keep each route's own target group. For a default forwarding rule, use `aws elbv2 modify-listener --listener-arn "$HTTPS_LISTENER_ARN" --default-actions file://actions-oidc.json`. These commands replace the action list. Preserve any existing routing options you need. See [ALB OIDC setup](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html), [modify-rule](https://docs.aws.amazon.com/cli/latest/reference/elbv2/modify-rule.html), and [modify-listener](https://docs.aws.amazon.com/cli/latest/reference/elbv2/modify-listener.html).

Internal ALBs need outbound access to the IdP's token and user-info endpoints.

ALB forwards the signed `x-amzn-oidc-data` header. Configure the UI handler:

```bash
export IAP_PROVIDER=aws
export AWS_ALB_ARN=arn:aws:elasticloadbalancing:REGION:ACCOUNT:loadbalancer/app/NAME/ID
export AWS_ALB_REGION=REGION
export AWS_ALB_OIDC_CLIENT_ID=OIDC_CLIENT_ID
export AWS_ALB_OIDC_ISSUER=https://idp.example.com
```

The handler validates the ALB signature, expected signer ARN, client ID, issuer, and expiry. It maps `sub` and `email` to the LiteLLM user. ALB browser assertions use a different format from standard IdP JWTs. Do not point LiteLLM's JWKS setting at an ALB key URL.

For machine API calls, use a separate hostname such as `api.corp.example.com` with a [`jwt-validation` listener rule](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-verify-jwt.html). Keep browser UI requests and their API calls on the OIDC hostname. Use RS256 tokens and configure the issuer, JWKS endpoint, audience, and required scope. ALB forwards the original IdP JWT. Use [LiteLLM JWT authentication](../../token_auth.md) to map it to a user and team.

ALB does not verify HTTPS target certificates. Restrict the target network to the ALB. Use an ingress that verifies backend certificates if your policy requires that check.

## Microsoft Entra Application Proxy {#azure}

Use Microsoft Entra Application Proxy to authenticate employees and reach LiteLLM through private-network connectors. Keep the origin private. Require your corporate device and access policies through Conditional Access.

<IngressArchitecture kind="iap-azure" />

This setup requires Microsoft Entra ID P1 or P2. Install private-network connectors on two hosts that can reach LiteLLM. In **Entra ID → Enterprise apps → New application**, choose **Add an on-premises application** and enter:

| Setting | Value |
| --- | --- |
| Name | `LiteLLM` |
| Internal URL | `https://litellm.internal.example.com/` |
| External URL | `https://llm.corp.example.com/` with your custom domain certificate and DNS |
| Pre Authentication | Microsoft Entra ID |
| Connector Group | The group containing your two connectors |
| Validate Backend TLS Certificate | Enabled |
| User assignment | Approved employees or groups |

For a new application, open **Permissions** and grant admin consent for the delegated `User.Read` permission. Follow [Application Proxy setup](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-add-on-premises-application) and [custom domain setup](https://learn.microsoft.com/en-us/entra/identity/app-proxy/how-to-configure-custom-domain).

Under **Single sign-on → Header-based → Headers → Add new header**, select **Attribute** and add these mappings:

| Request header | Entra user attribute |
| --- | --- |
| `X-LiteLLM-User-ID` | `user.objectid` |
| `X-LiteLLM-User-Email` | `user.mail` |

Configure Application Proxy to set these headers from the authenticated user. Populate the email attribute for every assigned user. Allow only connector hosts to reach the origin. These are trusted proxy headers, not signed JWTs. See [Entra header-based SSO](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-configure-single-sign-on-with-headers).

Target this Enterprise application with a Conditional Access policy. Under **Grant**, select **Require device to be marked as compliant**. Use your existing Intune compliance policy. Test in report-only mode, then enable the policy. See [device compliance setup](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-compliance).

```bash
export IAP_PROVIDER=azure
export AZURE_USER_ID_HEADER=X-LiteLLM-User-ID
export AZURE_EMAIL_HEADER=X-LiteLLM-User-Email
```

The UI handler uses these values for the LiteLLM user ID and email. Set `trusted_proxy_ranges` to the connector addresses that reach LiteLLM.

Application Proxy supports user sign-in and delegated user access. Use [Entra JWT authentication](../../token_auth.md) through a private API ingress for unattended service principals. Do not use an application-only token as a substitute for Application Proxy's user flow. See [Microsoft's API access guidance](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-secure-api-access).

## Google Cloud IAP {#gcp}

Use IAP on the internal Application Load Balancer in the [GCP architecture](../cloud/gcp.md). Corporate clients reach its private address through Cloud VPN or Cloud Interconnect. Set these values to your project, region, and deployment name prefix. This example keeps the module's `-gateway-bs`, `-backend-bs`, and `-ui-bs` names after the private-ingress changes:

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

<IngressArchitecture kind="iap-gcp" />

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

IAP forwards `x-goog-iap-jwt-assertion`. In the IAP console, open the resource's **More → Signed Header JWT Audience** and copy the value:

```bash
export IAP_PROVIDER=gcp
export GCP_IAP_AUDIENCE=SIGNED_HEADER_JWT_AUDIENCE
```

The handler verifies the signature, issuer, audience, and expiry. It maps `sub` and `email` to the LiteLLM user. Use the management backend's audience for UI sign-in. See [IAP signed headers](https://docs.cloud.google.com/iap/docs/signed-headers-howto).

You can also enable IAP directly on a Cloud Run service. Keep its ingress private and use that service's signed-header audience. Enable IAP at either Cloud Run or the load balancer, not both.

## Verify the configuration

| Check | Expected result |
| --- | --- |
| Approved employee opens the UI through the corporate access path | LiteLLM opens a session for the expected user with the stored role |
| User without corporate access tries the same route | The network or access proxy denies the request |
| Client sends forged identity headers or an invalid assertion | The proxy or LiteLLM handler rejects the identity |
| Client connects directly to LiteLLM | Network controls block the connection |

Confirm the signed-in user's ID and role in LiteLLM. For Cloudflare Access, AWS ALB, and Google Cloud IAP, test an expired assertion and an assertion for a different application. Test a long streaming request through the complete path.
