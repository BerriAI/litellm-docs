---
title: Identity-Aware Proxy
sidebar_label: Overview
description: Put an identity check in front of LiteLLM. Choose a provider, connect a private origin, and keep browser and API authentication separate.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Identity-Aware Proxy

{/* keep-version-note */}

An identity-aware proxy checks who can reach LiteLLM before a request reaches your deployment. Use it to require company sign-in for the Admin UI, or a workload credential for API clients.

The proxy controls access to the service. LiteLLM still checks its own [authentication](../../authentication.md), [roles, teams, and permissions](../../access_management/overview.md). An allowed employee does not automatically become a LiteLLM administrator, and an allowed service still needs a LiteLLM key or a configured LiteLLM identity flow.

Start with a working [cloud deployment](../cloud/overview.md), then add one of these ingress options.

## Choose a provider

<Tabs>
<TabItem value="cloudflare" label="Cloudflare" default>

[Cloudflare Access and Tunnel](./cloudflare.md) work with origins in any cloud or a private network. Employees sign in through Access; API clients send an Access service token alongside their LiteLLM key. Tunnel connects the private origin to Cloudflare without a public origin listener.

</TabItem>
<TabItem value="aws" label="AWS">

[Application Load Balancer authentication](./aws.md) adds OIDC sign-in to browser routes. For unattended API traffic, use a separate ALB JWT validation rule and a separate header for the LiteLLM key. The guide also explains when AWS Verified Access is a better fit.

</TabItem>
<TabItem value="azure" label="Azure">

[Microsoft Entra Application Proxy](./azure.md) publishes a private web application through outbound connectors. Use it for employees and user-delegated native clients. It is not an application-only client-credentials gateway for unattended SDK jobs.

</TabItem>
<TabItem value="gcp" label="GCP">

[Google Cloud IAP](./gcp.md) supports browser sessions and service-account credentials. Send the IAP token in `Proxy-Authorization` so LiteLLM can still read its key from `Authorization`.

</TabItem>
</Tabs>

## Connect it to LiteLLM

Protect the complete browser application, including its API calls, assets, and sign-in callbacks. Protecting only `/ui` leaves other routes outside the identity policy. A separate Admin UI hostname and API hostname make different browser and machine policies easier to manage.

Set `PROXY_BASE_URL` to the public HTTPS origin, for example `https://llm.example.com`, and configure LiteLLM SSO callbacks for that origin. See [reverse proxy and secure cookie configuration](../../security_best_practices.md#8-configure-secure-cookies-behind-a-tls-terminating-reverse-proxy).

Close direct paths to the origin, including public load balancers, node ports, and default service URLs. Configure TLS for each hop: HTTPS at the public edge does not by itself encrypt the connection from the proxy or connector to LiteLLM.

## Check both authentication layers

An allowed proxy identity with a valid LiteLLM credential must succeed. A denied proxy identity must stop at the proxy. A valid proxy identity with an invalid LiteLLM credential must reach LiteLLM and fail there. Also test a non-admin UI user, direct-origin access, and a streaming request that lasts as long as your expected workload.
