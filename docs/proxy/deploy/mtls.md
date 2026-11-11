---
title: Client Authentication with mTLS
sidebar_label: Client Authentication with mTLS
toc_max_heading_level: 2
description: Require client certificates at your ingress and LiteLLM virtual keys for API access, with setup examples for cloud load balancers and proxies.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Client Authentication with mTLS

{/* keep-version-note */}

Use mutual TLS (mTLS) when a client application must present a trusted client certificate before it can call LiteLLM. Your load balancer or reverse proxy validates the certificate. LiteLLM then checks the request's virtual key for model access, budgets, and permissions.

This guide requires **both a client certificate and a LiteLLM virtual key**. A certificate subject does not automatically become a LiteLLM user or team. Use a dedicated machine API hostname, such as `llm-api.example.com`, with separate browser access for the Admin UI.

<IngressArchitecture kind="mtls" />

## Before you start

Start with a running LiteLLM deployment, [virtual key authentication](../virtual_keys.md), and a model alias available to that key. The examples use `client-chat` and preserve the `/v1/` request path and `Authorization` header.

| Material | Where it belongs | Purpose |
| --- | --- | --- |
| Client certificate, intermediate chain, and private key | Client application | Prove possession of a certificate issued by your trusted client CA |
| Trusted client CA certificates | Ingress trust store | Decide which client certificates the ingress accepts |
| Server certificate and private key for `llm-api.example.com` | Ingress HTTPS listener | Let clients verify the public endpoint |
| Backend server certificate and its trusted CA | LiteLLM origin and validating ingress | Protect the ingress-to-origin connection |
| LiteLLM virtual key | Client application's secret store | Authorize requests within LiteLLM |

Keep LiteLLM's origin private and allow connections only from the ingress using security groups, firewall rules, or Kubernetes network policy. Close alternate public listeners, node ports, and default service URLs that could bypass the certificate check. Apply the policy to every route on this API hostname; expose only the API routes clients need.

## Configure your ingress

These examples add mTLS to existing infrastructure. Configure backend HTTPS independently of frontend mTLS. LiteLLM's [`--ssl_certfile_path` and `--ssl_keyfile_path` options](../cli.md#ssltls-configuration) supply its server certificate and key; those flags alone do not configure the client-certificate validation shown here.

<Tabs queryString="ingress">
<TabItem value="aws" label="AWS" default>

### Application Load Balancer

Use an ALB HTTPS listener with a server certificate, a private target group, and AWS CLI access to manage its trust store. Upload your PEM client CA bundle to S3, then create the trust store:

```bash
TRUST_STORE_ARN=$(aws elbv2 create-trust-store \
  --name litellm-clients \
  --ca-certificates-bundle-s3-bucket "$CA_BUCKET" \
  --ca-certificates-bundle-s3-key certificates/client-ca-bundle.pem \
  --query 'TrustStores[0].TrustStoreArn' --output text)
```

After the trust store is active, attach it to your HTTPS listener:

```bash
aws elbv2 modify-listener \
  --listener-arn "$LISTENER_ARN" \
  --mutual-authentication "Mode=verify,TrustStoreArn=$TRUST_STORE_ARN,IgnoreClientCertificateExpiry=false"
```

`verify` makes ALB validate client certificates. Passthrough mode forwards certificate information without this validation. See [AWS's mTLS setup](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/configuring-mtls-with-elb.html).

Forward `/v1/*` to an HTTPS target group and restrict its security group to the ALB security group. **ALB encrypts HTTPS backend traffic but does not validate the backend certificate.** If your policy requires verified origin identity, choose an ingress that validates origin certificates. See [ALB target group protocols](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html).

</TabItem>
<TabItem value="azure" label="Azure">

### Application Gateway

Use Application Gateway **Standard_v2 or WAF_v2** with an HTTPS listener and a private LiteLLM backend. Configure [strict mTLS](https://learn.microsoft.com/en-us/azure/application-gateway/mutual-authentication-overview):

1. Open **SSL settings**, add an SSL profile, and select **Client Authentication**.
2. Upload the trusted client CA chain, including its root and intermediates, in one PEM or CER file per chain.
3. Open the API's HTTPS listener, enable **SSL Profile**, and select this profile. Associating the profile enforces client-certificate validation.
4. Route `/v1/*` to your private backend. In **Backend settings**, select HTTPS, use a hostname matching its certificate, and upload the private root CA if needed. Keep certificate chain, expiry, and SNI validation enabled.

See the [portal setup](https://learn.microsoft.com/en-us/azure/application-gateway/mutual-authentication-portal) and [backend TLS settings](https://learn.microsoft.com/en-us/azure/application-gateway/configuration-http-settings). Restrict origin access to the Application Gateway subnet. Configure its health probe separately for the private backend.

</TabItem>
<TabItem value="gcp" label="GCP">

### Global external Application Load Balancer

Use an existing global external Application Load Balancer with an HTTPS frontend. Enable the Compute Engine, Certificate Manager, Network Security, and Network Services APIs and obtain the [required IAM permissions](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-mtls-ccm#permissions).

In **Certificate Manager → Trust Configs**, create a global trust config named `litellm-clients`. Upload the root CA as a trust anchor and any intermediate CAs. Use the CA trust store without certificate allowlist exceptions.

Save this as `server-tls-policy.yaml`, replacing `PROJECT_ID`:

```yaml
name: litellm-mtls
mtlsPolicy:
  clientValidationMode: REJECT_INVALID
  clientValidationTrustConfig: projects/PROJECT_ID/locations/global/trustConfigs/litellm-clients
```

```bash
gcloud network-security server-tls-policies import litellm-mtls \
  --source=server-tls-policy.yaml --location=global
```

Edit the load balancer's **Frontend configuration → Show Advanced features → Client Authentication**, select `litellm-mtls`, and save. `REJECT_INVALID` rejects missing or invalid client certificates. See [Google's frontend mTLS setup](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-mtls-ccm).

Frontend mTLS does not configure backend authentication. For supported backends, configure [backend authenticated TLS](https://docs.cloud.google.com/load-balancing/docs/backend-authenticated-tls-backend-mtls) with a separate backend trust config and authentication config; selecting HTTPS alone does not validate origin certificates. Restrict VM backends with firewall rules. For Cloud Run, [restrict ingress](https://docs.cloud.google.com/run/docs/securing/ingress) to internal traffic and Cloud Load Balancing, disable the default service URL, and remove any direct domain mappings.

</TabItem>
<TabItem value="nginx" label="NGINX">

### NGINX reverse proxy

Use NGINX with its HTTP SSL module. Place this server block inside your `http` configuration. The origin `litellm.internal:4000` must serve HTTPS with a certificate for `litellm.internal`.

```nginx
server {
    listen 443 ssl;
    server_name llm-api.example.com;
    ssl_certificate /etc/nginx/tls/server-chain.pem;
    ssl_certificate_key /etc/nginx/tls/server-key.pem;
    ssl_client_certificate /etc/nginx/tls/client-ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 3;

    location /v1/ {
        proxy_pass https://litellm.internal:4000;
        proxy_ssl_server_name on;
        proxy_ssl_name litellm.internal;
        proxy_ssl_trusted_certificate /etc/nginx/tls/origin-ca.pem;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 3;
        proxy_set_header Host litellm.internal;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_next_upstream off;
    }

    location / { return 404; }
}
```

Adjust verification depth to your CA chain. Validate with `nginx -t`, then reload. `ssl_verify_client on` requires client authentication; `proxy_ssl_verify on` separately verifies the origin. See the [SSL module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) and [proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html). Restrict the origin to NGINX's network identity.

</TabItem>
<TabItem value="haproxy" label="HAProxy">

### HAProxy reverse proxy

Use an HAProxy build with OpenSSL support; these directives are available in the community edition. `server.pem` contains the public server certificate chain and private key. The private origin serves HTTPS.

```text
defaults
    mode http
    timeout connect 10s
    timeout client 300s
    timeout server 300s
    retries 0

frontend litellm_api
    bind :443 ssl crt /etc/haproxy/server.pem ca-file /etc/haproxy/client-ca.pem verify required
    http-request deny deny_status 404 unless { path_beg /v1/ }
    http-request set-header X-Forwarded-Proto https
    default_backend litellm_origin

backend litellm_origin
    http-request set-header Host litellm.internal
    server litellm litellm.internal:4000 ssl verify required ca-file /etc/haproxy/origin-ca.pem sni str(litellm.internal) verifyhost litellm.internal
```

Validate with `haproxy -c -f /etc/haproxy/haproxy.cfg`, then reload. The frontend requires a client certificate; the backend verifies its server certificate and hostname. HAProxy forwards `Authorization` to LiteLLM. Restrict the origin to HAProxy. See [client certificate authentication](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/security/authentication/client-certificate-authentication/) and the [configuration reference](https://docs.haproxy.org/3.2/configuration.html).

</TabItem>
<TabItem value="kong" label="Kong">

### Kong Gateway

The [`mtls-auth` plugin requires Kong Gateway Enterprise](https://developer.konghq.com/plugins/mtls-auth/). Configure Kong's HTTPS listener with the server certificate for `llm-api.example.com`, then create separate CA Certificate entities for the client CA and the origin CA.

Add this excerpt to your declarative configuration, replacing both CA IDs with those entities' IDs. Keep their definitions and your listener certificate in the complete configuration:

```yaml
_format_version: "3.0"
services:
  - name: litellm
    url: https://litellm.internal:4000
    tls_verify: true
    ca_certificates:
      - ORIGIN_CA_CERTIFICATE_ID
    read_timeout: 300000
    retries: 0
    routes:
      - name: litellm-api
        hosts: [llm-api.example.com]
        snis: [llm-api.example.com]
        protocols: [https]
        paths: [/v1/]
        strip_path: false
        response_buffering: false
    plugins:
      - name: mtls-auth
        config:
          ca_certificates:
            - CLIENT_CA_CERTIFICATE_ID
          skip_consumer_lookup: true
```

Apply through your existing Kong deployment workflow. `skip_consumer_lookup: true` admits certificates trusted by this CA without requiring a Kong Consumer mapping. Leave `anonymous` unset so certificate failures cannot fall back to anonymous access. LiteLLM still authorizes the virtual key. See the [plugin setup](https://developer.konghq.com/plugins/mtls-auth/examples/enable-mtls/).

The Service uses HTTPS and explicit origin certificate verification. See [Kong TLS configuration](https://developer.konghq.com/gateway/ssl-certificates/). Restrict the origin to Kong, preserve `Authorization`, and ensure every route to this Service uses the plugin. Review plugins that enable response buffering before using streaming.

</TabItem>
</Tabs>

## Call LiteLLM

Give each client its own certificate and private key, plus a [virtual key](../virtual_keys.md) limited to its models and team. Set `LITELLM_API_KEY` from your secret store. `client-chain.pem` contains the client certificate and intermediates; `server-ca.pem` trusts the ingress server certificate. With a public server certificate already trusted by your client, use the normal system trust store instead of this custom CA file.

### curl

```bash
curl --fail-with-body --no-buffer \
  --cert client-chain.pem \
  --key client-key.pem \
  --cacert server-ca.pem \
  https://llm-api.example.com/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "client-chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### OpenAI Python SDK

Install `openai`. Supply an [SSL context with a client certificate](https://www.python-httpx.org/advanced/ssl/#client-side-certificates) through the SDK's HTTP client wrapper:

```python
import os
import ssl

from openai import DefaultHttpxClient, OpenAI

tls = ssl.create_default_context(cafile="server-ca.pem")
tls.load_cert_chain(certfile="client-chain.pem", keyfile="client-key.pem")

with OpenAI(
    base_url="https://llm-api.example.com/v1",
    api_key=os.environ["LITELLM_API_KEY"],
    http_client=DefaultHttpxClient(
        verify=tls,
        timeout=300.0,
        follow_redirects=False,
    ),
) as client:
    stream = client.chat.completions.create(
        model="client-chat",
        messages=[{"role": "user", "content": "Hello"}],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices:
            print(chunk.choices[0].delta.content or "", end="", flush=True)
```

Keep certificate verification enabled in clients. Set ingress, origin, and client timeouts for your longest expected request and gaps between streamed chunks; the 300-second examples are starting values. Avoid proxy retries that replay a completion POST after the origin receives it. Configure health checks on the private backend without opening a public route around mTLS.

## Verify both checks

Run these checks from a client network before you give out access. Certificate failures can appear as TLS errors or ingress HTTP errors, depending on the product. Inspect ingress and LiteLLM logs to confirm where the request stops.

| Test | Expected result |
| --- | --- |
| Trusted, valid certificate and allowed LiteLLM key | Completion succeeds |
| No certificate, even with a valid LiteLLM key | Ingress rejects the request |
| Expired certificate or a certificate signed by another CA | Ingress rejects the request |
| Valid certificate with a missing, invalid, or revoked LiteLLM key | LiteLLM rejects the request |
| Valid certificate and key requesting a model outside the key's permissions | LiteLLM rejects the request |
| Certificate identity headers supplied without a client certificate | Ingress rejects the request |
| Direct origin, alternate hostname, or alternate public listener | No unprotected path to LiteLLM |
| Streaming request lasting as long as your expected workload | Chunks arrive incrementally without a premature disconnect |

For ingress that validates origin certificates, also test an untrusted or wrong-hostname backend certificate: it must fail. ALB's HTTPS target connection does not provide this check. A forwarded certificate header is metadata; do not use it as a LiteLLM identity unless you separately implement and secure that mapping.

## Renew and revoke credentials

Issue client certificates through your PKI with the client-authentication usage required by your ingress. Use a dedicated CA or issuing intermediate for the permitted clients. Keep private keys with their owners; upload only CA certificates to ingress trust stores.

Renew before expiry. For a CA rotation, temporarily trust both old and new CA chains, distribute new client credentials, verify them, then remove the old trust. Rotate ingress and origin server certificates separately.

Configure and test the ingress's supported revocation mechanism, such as ALB trust-store CRLs, Application Gateway OCSP, or the proxy's CRL support. Revocation behavior differs across platforms; where it is unavailable, use short-lived certificates and plan how to remove trust. Test with a new connection after revocation and account for existing connections and caches. Revoke a compromised LiteLLM key through [key management](../virtual_keys.md) as a separate action.
