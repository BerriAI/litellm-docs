---
title: Google Cloud Identity-Aware Proxy
sidebar_label: GCP
description: Protect a LiteLLM HTTPS load balancer with Google Cloud IAP. Authorize browser users and service accounts without replacing the LiteLLM key.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Google Cloud Identity-Aware Proxy

{/* keep-version-note */}

Use Google Cloud IAP to require an authorized user or service account before traffic reaches LiteLLM. This guide adds IAP to the HTTPS load balancer in the [GCP architecture](../cloud/gcp.md).

<IngressArchitecture kind="iap-gcp" />

For a single Cloud Run service, Google recommends enabling IAP directly on Cloud Run. That also protects its `run.app` URL and does not require a load balancer. Load-balancer IAP is useful when you need central access management across backends or regions. Enable IAP at one layer, not simultaneously on Cloud Run and its load balancer. [Choose an IAP placement](https://docs.cloud.google.com/iap/docs/enabling-cloud-run).

## Enable IAP at the load balancer

Use an HTTPS frontend with your public domain and certificate. Enable IAP on every backend service that the LiteLLM URL map exposes, including UI, backend, and gateway services. Grant approved users and service accounts **IAP-Secured Web App User** (`roles/iap.httpsResourceAccessor`) on the protected resource. IAP access does not assign LiteLLM users or roles. See [IAP setup](https://docs.cloud.google.com/iap/docs/enabling-compute-howto).

For Cloud Run backends, grant **Cloud Run Invoker** to the IAP service agent, `service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com`, on each protected service. Remove public invoker grants. Configure the IAM policy in the infrastructure code that manages the service. [Cloud Run backend authorization](https://docs.cloud.google.com/iap/docs/enabling-cloud-run).

Require the Cloud Run Invoker IAM check too. Removing `allUsers` does not secure a service whose IAM check is disabled; re-enable it with `gcloud run services update "$CLOUD_RUN_SERVICE" --region "$REGION" --invoker-iam-check`. [Cloud Run IAM enforcement](https://docs.cloud.google.com/run/docs/authenticating/public).

Set LiteLLM's `PROXY_BASE_URL` to the public HTTPS origin. Browser users complete IAP sign-in and then the configured LiteLLM UI sign-in.

## Close paths around the load balancer

Load-balancer IAP does not protect requests sent directly to a Cloud Run `run.app` URL. Restrict ingress to **Internal and Cloud Load Balancers**, retain IAM checks, and remove unwanted alternate domain mappings. Where compatible with your callers, disable the default URL as well. Internal ingress is still allowed by this setting, so network ingress alone is not an identity check. [Cloud Run ingress controls](https://docs.cloud.google.com/run/docs/securing/ingress).

```bash
gcloud run services update "$CLOUD_RUN_SERVICE" \
  --region "$REGION" \
  --ingress internal-and-cloud-load-balancing
```

For GKE or VM backends, restrict direct backend access with the load balancer's required firewall rules. For each backend type, validate IAP's signed `x-goog-iap-jwt-assertion` at a trusted ingress or application layer, including its expected audience. Do not trust unsigned identity headers. LiteLLM does not gain assertion verification merely because IAP is enabled. Keep any health-check exception restricted to the health route and trusted probes. [Signed IAP headers](https://docs.cloud.google.com/iap/docs/signed-headers-howto).

## Call the API with a service account

Give the calling service account IAP access. For the ID-token example below, configure a custom OAuth client and allow its client ID for programmatic access in IAP. Use that client ID as the token audience. The default Google-managed OAuth client does not support this token-exchange setup; service-account signed JWTs are a separate supported option. [Programmatic authentication](https://docs.cloud.google.com/iap/docs/authentication-howto).

For a local check, impersonate an authorized service account. Your signed-in principal needs permission to mint its ID token; request the narrow **Service Account OpenID Connect Identity Token Creator** role on that account. Include the email claim. [Token creation permissions](https://docs.cloud.google.com/docs/authentication/get-id-token), [gcloud token flags](https://docs.cloud.google.com/sdk/gcloud/reference/auth/print-identity-token).

```bash
IAP_TOKEN="$(gcloud auth print-identity-token \
  --impersonate-service-account="$CALLER_SERVICE_ACCOUNT" \
  --audiences="$IAP_CLIENT_ID" \
  --include-email)"

curl --fail-with-body https://llm.example.com/v1/models \
  -H "Proxy-Authorization: Bearer $IAP_TOKEN" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

IAP uses a valid `Proxy-Authorization` credential and leaves `Authorization` for LiteLLM. SDK clients can add that same extra header. Obtain fresh short-lived tokens as needed; a token copied into a long-running client's headers will expire. [Header handling](https://docs.cloud.google.com/iap/docs/authentication-howto).

## Verify the result

An allowed browser user must reach LiteLLM and retain their LiteLLM role. With a valid IAP token and virtual key, `/v1/models` must return JSON. A caller without IAP permission or with an expired token must fail at IAP; a valid IAP token and invalid LiteLLM key must fail at LiteLLM. Test direct `run.app`, VM, and Kubernetes endpoints to confirm they cannot bypass the selected identity checks.

HTTPS terminates at the load balancer. For VM or GKE targets, configure the backend protocol and certificates separately when the next hop requires TLS; IAP does not choose them for you. Test streaming and confirm your backend timeout covers the workload. See the [cloud deployment guide](../cloud/gcp.md) for the underlying network.
