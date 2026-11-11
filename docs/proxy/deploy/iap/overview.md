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
