---
title: Microsoft Entra Application Proxy
sidebar_label: Azure
description: Publish a private LiteLLM Admin UI through Microsoft Entra Application Proxy. Configure connectors, TLS, user access, and delegated API calls.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Microsoft Entra Application Proxy

{/* keep-version-note */}

Use Microsoft Entra Application Proxy to publish a private LiteLLM web application for employees. A connector in your private network opens outbound connections to Microsoft's service; you do not open an inbound Internet port on the LiteLLM origin. Start with the [Azure architecture](../cloud/azure.md). [Microsoft architecture and API access](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-secure-api-access).

<IngressArchitecture kind="iap-azure" />

This guide uses Entra preauthentication for browser users. Keep LiteLLM's own UI login or SSO and role checks. Signing in through Entra Application Proxy does not grant a LiteLLM admin role.

## Configure the connectors and application

Application Proxy requires an Entra ID P1 or P2 license. Install supported Windows Server private-network connectors where they can resolve and reach the private ingress. LiteLLM itself can run on Linux or Kubernetes. Put at least two connectors in the application's connector group for availability, and permit Microsoft's documented outbound destinations. [Licensing and application support](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-faq), [connector deployment](https://learn.microsoft.com/en-us/entra/global-secure-access/concept-connectors).

In Entra **Enterprise applications**, add an on-premises application with these values. An Azure-hosted private application can use the same connector pattern.

| Setting | Example |
| --- | --- |
| Internal URL | `https://litellm.internal.example.com/` |
| External URL | The assigned `msappproxy.net` URL or `https://admin.example.com/` |
| Pre Authentication | **Microsoft Entra ID** |
| Connector Group | Your healthy private-network connectors |
| Validate Backend TLS Certificate | Enabled |

Publish the complete app origin, including assets, backend routes, and SSO callbacks. For a custom external hostname, configure its DNS record and certificate. Assign the users or groups allowed to open the application, and configure Conditional Access as needed. New Application Proxy apps require an explicit admin-consent grant for the `User.Read` delegated permission. Follow Microsoft's current [application setup](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-add-on-premises-application).

Set LiteLLM's `PROXY_BASE_URL` to the external HTTPS origin. Let the connector reach the origin over HTTPS with a valid certificate. Restrict the origin to connector traffic; the cloud preauthentication check does not protect a second public path to that origin.

## API clients need a user flow

Application Proxy supports native clients that use MSAL to acquire a delegated access token for a signed-in user. Microsoft's documented flow does not use application-only tokens. An unattended OpenAI SDK job cannot simply use a client ID and secret to pass this preauthentication layer. For workloads without a user, choose an API ingress that supports workload authentication, or a private route with [LiteLLM authentication](../../authentication.md). [Native-client support](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-configure-native-client-application).

For a user-delegated client, follow Microsoft's app-registration and delegated-permission setup, then acquire an access token for the published API using MSAL. The Entra token occupies `Authorization`. Configure a separate LiteLLM key header on the API deployment:

```yaml title="config.yaml fragment for the API deployment"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  litellm_key_header_name: X-Litellm-Key
```

With the user's delegated token in `ENTRA_ACCESS_TOKEN`, call the external URL:

```bash
curl --fail-with-body https://api.example.com/v1/models \
  -H "Authorization: Bearer $ENTRA_ACCESS_TOKEN" \
  -H "X-Litellm-Key: Bearer $LITELLM_API_KEY"
```

The app registration, scope, and user assignment must match Microsoft's [delegated API flow](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-secure-api-access). When the [custom LiteLLM header](../../virtual_keys.md#pass-litellm-key-in-custom-header) is present, LiteLLM uses it for key authentication; include `Bearer` before the key. Verify both the API call and UI sign-in if they share a deployment. Leave preauthentication enabled; **Passthrough** removes the Entra access check.

## Verify the result

An assigned employee must reach the LiteLLM sign-in screen and keep their LiteLLM role after sign-in. An unassigned user must be denied by Entra. A delegated API token plus a valid LiteLLM key must return JSON; a bad token must fail before LiteLLM, and a bad LiteLLM key must fail afterward. Test that the origin is unreachable from the Internet.

Test your longest non-streaming request and a representative stream. Application Proxy's backend timeout is 85 seconds by default or 180 seconds with **Long**; Microsoft does not support extending that limit. Do not assume an LLM request will fit because a UI page loaded successfully. [Timeout limits](https://learn.microsoft.com/en-us/entra/identity/app-proxy/application-proxy-faq).
