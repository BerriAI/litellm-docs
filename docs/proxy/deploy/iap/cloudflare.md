---
title: Cloudflare Access and Tunnel
sidebar_label: Cloudflare
description: Protect LiteLLM with Cloudflare Access and a private Tunnel origin. Use employee sign-in for the UI and service tokens for API clients.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Cloudflare Access and Tunnel

{/* keep-version-note */}

Use Cloudflare Access to check employee or service identity, and Cloudflare Tunnel to reach a private LiteLLM deployment. This works with the [AWS](../cloud/aws.md), [Azure](../cloud/azure.md), and [GCP](../cloud/gcp.md) architectures.

<IngressArchitecture kind="iap-cloudflare" />

Access authenticates the caller at Cloudflare. A `cloudflared` connector reaches your private ingress through an outbound tunnel. LiteLLM then checks its own key or UI session and applies its roles and budgets.

## Publish a protected hostname

Create a self-hosted Access application for `llm.example.com` before publishing its tunnel route. Add an **Allow** policy for the employees or groups that need browser access. Use the complete hostname so that assets and API requests receive the same protection. Enable **Protect with Access** on the tunnel route to let `cloudflared` validate the Access application token. [Cloudflare setup guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

Create a remotely managed tunnel, install its connector in a network that can reach LiteLLM, and publish a route with these values:

| Setting | Example |
| --- | --- |
| Public hostname | `llm.example.com` |
| Origin service | `https://litellm.internal.example.com:443` |
| Access application | The application for `llm.example.com` |
| Origin certificate | Valid for the origin hostname, with a trusted CA |

Run more than one connector on separate hosts for availability. Keep the origin private and allow ingress only from the connector network. Tunnel provides the connection; its route alone does not grant application access. See [published application routes](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).

The browser-to-Cloudflare and tunnel connections are encrypted. The connector-to-origin hop uses the service URL above. Keep certificate verification enabled; configure the origin server name and CA pool if your private certificate needs them. Do not use `noTLSVerify` to fix a certificate mismatch. [Origin TLS settings](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).

Set `PROXY_BASE_URL=https://llm.example.com` for LiteLLM. Open `/ui`, complete Access sign-in, then sign in to LiteLLM. Access group membership does not assign a LiteLLM role.

## Call the API from a service

Create an Access service token and add a **Service Auth** policy that includes that token. Send both Cloudflare headers on every request. Keep `Authorization` for the LiteLLM virtual key. Do not configure Cloudflare's single-header service-token option to consume that same header. [Service token setup](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

```bash
curl --fail-with-body https://llm.example.com/v1/models \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

An OpenAI-compatible client can supply the same headers:

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://llm.example.com/v1",
    api_key=os.environ["LITELLM_API_KEY"],
    default_headers={
        "CF-Access-Client-Id": os.environ["CF_ACCESS_CLIENT_ID"],
        "CF-Access-Client-Secret": os.environ["CF_ACCESS_CLIENT_SECRET"],
    },
)
print(client.models.list())
```

Keep the service secret in your workload's secret store. Access token rotation and LiteLLM key rotation are separate operations.

## Verify the result

Test an allowed employee and an employee outside the policy. With both API credentials, `/v1/models` must return JSON. Remove the Access secret: the request must not reach LiteLLM. Depending on the account's service-token authentication settings, failure can be an Access `401`/`403` or a login redirect. With valid Access headers and a bad LiteLLM key, LiteLLM must reject the request. [Service-token behavior](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

Try the origin from outside the private network; it must be unreachable. Test streaming and confirm that an Access login page is never treated as an API success. For the shared rollout checks, see the [IAP overview](./overview.md).
