---
title: Client Authentication with mTLS
sidebar_label: Client Authentication with mTLS
toc_max_heading_level: 2
description: Verify client certificates at your ingress, forward workload identity to LiteLLM, and apply virtual-key permissions to API requests.
---

import { IngressArchitecture } from '@site/src/components/IngressArchitecture';

# Client Authentication with mTLS

{/* keep-version-note */}

Use mutual TLS (mTLS) for services, agents, and client applications that have certificates from your PKI. The ingress verifies each certificate and forwards its identity to LiteLLM for usage tracking and customer policies.

These examples use a client certificate and a [LiteLLM virtual key](../virtual_keys.md). The certificate identifies the workload. The key controls its user, team, models, and budget. For clients that send only a certificate, [map each workload to its own key at the ingress](#certificate-only-clients).

Use a dedicated API hostname in private DNS, such as `llm-api.example.com`. Clients connect through your corporate network, VPN, or private interconnect. Allow only the ingress to reach LiteLLM. Keep Admin UI access separate.

<details id="configure-litellm-identity">
<summary>Shared LiteLLM configuration</summary>

Add this mapping to your existing `config.yaml`. Keep your models, master key, and database configuration:

```yaml
general_settings:
  user_header_mappings:
    - header_name: x-mtls-client-id
      litellm_user_role: customer
```

This mapping assigns the [customer ID](../customers.md) for usage attribution and customer policies. It does not authenticate the request or select a LiteLLM user or team. LiteLLM still validates the virtual key.

Each ingress overwrites `X-MTLS-Client-ID` and removes `X-LiteLLM-Customer-ID` and `X-LiteLLM-End-User-ID`. Those standard headers take precedence over this mapping. AWS, NGINX, HAProxy, and Kong map approved certificates to workload aliases. Azure and GCP forward IDs from certificates that pass CA validation.

Close alternate listeners, node ports, and default service URLs that bypass the ingress. Apply the policy to every route on the API hostname. These examples expose `/v1/` and preserve `Authorization`.

Configure backend HTTPS separately from frontend mTLS. LiteLLM's [`--ssl_certfile_path` and `--ssl_keyfile_path` options](../cli.md#ssltls-configuration) supply its server certificate and key. These flags do not configure client-certificate validation.

</details>

## AWS Application Load Balancer

Use an **internal ALB** with an HTTPS listener and a private NGINX target group. ALB validates the client certificate. NGINX maps the verified certificate fields to a workload alias before it forwards to LiteLLM.

<IngressArchitecture kind="mtls-aws" />

### Configuration

Upload your PEM client CA bundle to S3, then create the trust store:

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

### Identity forwarding

Place this configuration inside NGINX's `http` block. Replace the issuer and serial with an approved certificate's [ALB header values](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html#mutual-authentication-http-headers). Replace the example subnet with the ALB subnets. The security group must also allow only the ALB security group.

```nginx
map "$http_x_amzn_mtls_clientcert_issuer|$http_x_amzn_mtls_clientcert_serial_number" $mtls_client_id {
    default "";
    "CN=WorkloadCA,O=Example|01" billing-worker;
}

server {
    listen 443 ssl;
    server_name mtls-mapper.internal;
    ssl_certificate /etc/nginx/tls/server-chain.pem;
    ssl_certificate_key /etc/nginx/tls/server-key.pem;
    allow 10.20.0.0/24;
    deny all;

    location /v1/ {
        if ($mtls_client_id = "") { return 403; }
        proxy_pass https://litellm.internal:4000;
        proxy_ssl_server_name on;
        proxy_ssl_name litellm.internal;
        proxy_ssl_trusted_certificate /etc/nginx/tls/origin-ca.pem;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 3;
        proxy_set_header Host litellm.internal;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-MTLS-Client-ID $mtls_client_id;
        proxy_set_header X-LiteLLM-Customer-ID "";
        proxy_set_header X-LiteLLM-End-User-ID "";
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_next_upstream off;
    }

    location = /ingress-health { return 200; }
    location / { return 404; }
}
```

Keep NGINX's source IP check on the direct connection. Do not configure `real_ip_header` on this mapper. Empty, duplicate, or unlisted issuer/serial pairs fail the map. With the common LiteLLM configuration above, an allowed request records `billing-worker` as its customer ID.

Set the target group's health-check path to `/ingress-health`. Keep the ALB listener rule limited to `/v1/*`. This probe checks NGINX. Monitor LiteLLM readiness separately.

Forward `/v1/*` to an HTTPS target group. Restrict target access to the ALB security group. **ALB encrypts HTTPS backend traffic but does not validate the backend certificate.** If your policy requires origin identity checks, choose an ingress that validates origin certificates. See [ALB target group protocols](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html).

## Azure Application Gateway

Use Application Gateway **Standard_v2 or WAF_v2** with a private frontend IP, an HTTPS listener, and a private LiteLLM backend.

<IngressArchitecture kind="mtls-azure" />

### Configuration

Configure [strict mTLS](https://learn.microsoft.com/en-us/azure/application-gateway/mutual-authentication-overview):

1. Open **SSL settings**, add an SSL profile, and select **Client Authentication**.
2. Upload each trusted client CA chain in one PEM or CER file. Include its root and intermediates.
3. Open the API's HTTPS listener, enable **SSL Profile**, and select this profile. The profile enforces client-certificate validation.
4. Route `/v1/*` to your private backend. In **Backend settings**, select HTTPS. Use a hostname that matches its certificate. Upload the private root CA if needed. Keep certificate chain, expiry, and SNI validation enabled.

See the [portal setup](https://learn.microsoft.com/en-us/azure/application-gateway/mutual-authentication-portal) and [backend TLS settings](https://learn.microsoft.com/en-us/azure/application-gateway/configuration-http-settings). Restrict origin access to the Application Gateway subnet. Configure its health probe separately for the private backend.

### Identity forwarding

Create a rewrite set that forwards the verified issuer and serial as one customer ID. Empty values remove competing headers:

```bash
az network application-gateway rewrite-rule set create \
  --resource-group "$RESOURCE_GROUP" --gateway-name "$APP_GATEWAY" \
  --name litellm-mtls

az network application-gateway rewrite-rule create \
  --resource-group "$RESOURCE_GROUP" --gateway-name "$APP_GATEWAY" \
  --rule-set-name litellm-mtls --name verified-client --sequence 100 \
  --request-headers \
    'X-MTLS-Client-ID={var_client_certificate_issuer}|{var_client_certificate_serial}' \
    'X-LiteLLM-Customer-ID=' \
    'X-LiteLLM-End-User-ID='

az network application-gateway rule update \
  --resource-group "$RESOURCE_GROUP" --gateway-name "$APP_GATEWAY" \
  --name "$API_ROUTING_RULE" --rewrite-rule-set litellm-mtls
```

This attachment command targets a basic routing rule. For path-based rules, attach the rewrite set to the API's URL path-map rule. Merge these actions into any existing rewrite set. With the common LiteLLM configuration, `issuer|serial` becomes the customer ID. Certificate renewal changes that ID. Use a private mapper, as in the AWS example, if you need a stable alias. See [rewrite commands](https://learn.microsoft.com/en-us/cli/azure/network/application-gateway/rewrite-rule?view=azure-cli-latest) and [certificate variables](https://learn.microsoft.com/en-us/azure/application-gateway/rewrite-http-headers-url).

## Google Cloud Application Load Balancer

Use an existing **regional internal Application Load Balancer** with a private HTTPS frontend. Enable the Compute Engine, Certificate Manager, Network Security, and Network Services APIs. Get the [required IAM permissions](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-mtls-ccm#permissions).

<IngressArchitecture kind="mtls-gcp" />

### Configuration

In **Certificate Manager → Trust Configs**, create `litellm-clients` in the load balancer's region. Upload the root CA as a trust anchor and any intermediate CAs. Use the CA trust store without certificate allowlist exceptions.

Save this as `server-tls-policy.yaml`. Replace `PROJECT_ID` and `REGION`:

```yaml
name: litellm-mtls
mtlsPolicy:
  clientValidationMode: REJECT_INVALID
  clientValidationTrustConfig: projects/PROJECT_ID/locations/REGION/trustConfigs/litellm-clients
```

```bash
gcloud network-security server-tls-policies import litellm-mtls \
  --source=server-tls-policy.yaml --location="$REGION"

gcloud compute target-https-proxies export "$HTTPS_PROXY" \
  --destination=target-proxy.yaml --region="$REGION"
```

Keep the exported proxy's certificate and URL-map settings. Add this root field to `target-proxy.yaml`:

```yaml
serverTlsPolicy: //networksecurity.googleapis.com/projects/PROJECT_ID/locations/REGION/serverTlsPolicies/litellm-mtls
```

Import the proxy, then export its existing URL map:

```bash
gcloud compute target-https-proxies import "$HTTPS_PROXY" \
  --source=target-proxy.yaml --region="$REGION"

gcloud compute url-maps export "$URL_MAP" \
  --destination=url-map.yaml --region="$REGION"
```

### Identity forwarding

Add this root `headerAction` to `url-map.yaml`. Merge it with existing header actions and keep the exported routing rules:

```yaml
headerAction:
  requestHeadersToAdd:
    - headerName: X-MTLS-Client-ID
      headerValue: "{client_cert_sha256_fingerprint}"
      replace: true
  requestHeadersToRemove:
    - X-LiteLLM-Customer-ID
    - X-LiteLLM-End-User-ID
```

```bash
gcloud compute url-maps import "$URL_MAP" \
  --source=url-map.yaml --region="$REGION"
```

`REJECT_INVALID` rejects missing or invalid client certificates. The URL map replaces the incoming identity header with the verified certificate's Base64-encoded SHA-256 fingerprint. The common LiteLLM configuration uses that fingerprint as the customer ID. Renewal changes the ID. Internal load balancers use URL-map header actions rather than backend-service custom headers. See [frontend mTLS setup](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-mtls-ccm) and [internal load balancer header actions](https://docs.cloud.google.com/load-balancing/docs/l7-internal/custom-headers).

Frontend mTLS does not configure backend authentication. For supported backends, configure [backend authenticated TLS](https://docs.cloud.google.com/load-balancing/docs/backend-authenticated-tls-backend-mtls). Use a separate backend trust config and authentication config. Selecting HTTPS alone does not validate origin certificates. Restrict backend access with firewall rules. For Cloud Run, [set ingress to internal](https://docs.cloud.google.com/run/docs/securing/ingress), disable the default service URL, and remove direct domain mappings.

## NGINX

Use NGINX to verify client certificates and map each approved certificate to a workload ID.

<IngressArchitecture kind="mtls-nginx" />

### Configuration

Place both blocks inside your NGINX `http` configuration. Replace the example issuer and serial with values from an approved client certificate. The map assigns it the stable workload ID `billing-worker`. The origin must serve HTTPS with a certificate for `litellm.internal`.

```nginx
map "$ssl_client_i_dn|$ssl_client_serial" $mtls_client_id {
    default "";
    "CN=WorkloadCA,O=Example|01" billing-worker;
}

server {
    listen 443 ssl;
    server_name llm-api.example.com;
    ssl_certificate /etc/nginx/tls/server-chain.pem;
    ssl_certificate_key /etc/nginx/tls/server-key.pem;
    ssl_client_certificate /etc/nginx/tls/client-ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 3;

    location /v1/ {
        if ($mtls_client_id = "") { return 403; }
        proxy_pass https://litellm.internal:4000;
        proxy_ssl_server_name on;
        proxy_ssl_name litellm.internal;
        proxy_ssl_trusted_certificate /etc/nginx/tls/origin-ca.pem;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 3;
        proxy_set_header Host litellm.internal;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-MTLS-Client-ID $mtls_client_id;
        proxy_set_header X-LiteLLM-Customer-ID "";
        proxy_set_header X-LiteLLM-End-User-ID "";
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

### Identity forwarding

Adjust verification depth to your CA chain. Validate with `nginx -t`, then reload. NGINX requires a valid client certificate and a matching issuer/serial entry. Empty `proxy_set_header` values remove incoming headers. See the [certificate variables](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#variables), [map directive](https://nginx.org/en/docs/http/ngx_http_map_module.html#map), and [header rules](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header). Allow origin access only from NGINX.

<details id="certificate-only-clients">
<summary>Use certificates without client-supplied keys</summary>

To authenticate clients with only a certificate, keep one virtual key per workload at the ingress. Map the verified workload ID to that key. LiteLLM then applies the existing key's user, team, model permissions, and budgets. Do not use the master key or a shared key for all clients.

For NGINX, add this map in the `http` block alongside the certificate map:

```nginx
map $mtls_client_id $mtls_litellm_key {
    default "";
    include /run/secrets/litellm-workload-keys.map;
}
```

Mount the secret file with restricted access. Its format is `billing-worker sk-WORKLOAD_VIRTUAL_KEY;`. Keep it out of source control and logs.

In the existing `/v1/` location, replace the `Authorization` directive with these directives. Keep the certificate check, identity header rules, and backend TLS settings:

```nginx
if ($mtls_litellm_key = "") { return 403; }
proxy_set_header Authorization "";
proxy_set_header litellm_user_api_key "";
proxy_set_header X-MTLS-LiteLLM-Key "Bearer $mtls_litellm_key";
```

Add the [custom key header](../virtual_keys.md#pass-litellm-key-in-custom-header) to the same LiteLLM configuration:

```yaml
general_settings:
  litellm_key_header_name: x-mtls-litellm-key
  user_header_mappings:
    - header_name: x-mtls-client-id
      litellm_user_role: customer
```

NGINX overwrites this header on every forwarded request. LiteLLM uses it for normal virtual-key authentication. Clients cannot choose another key through this route. Reload NGINX after a key-map change. Keep the origin private and verify that a revoked mapped key fails.

</details>

## HAProxy

Use an HAProxy build with OpenSSL support. The community edition supports these directives. `server.pem` contains the server certificate chain and private key. The private origin serves HTTPS.

<IngressArchitecture kind="mtls-haproxy" />

### Configuration

Create `/etc/haproxy/mtls-clients.map`. Each line maps an approved certificate's SHA-256 fingerprint to a workload ID. Use lowercase hex without colons:

```text
CLIENT_CERT_SHA256_HEX billing-worker
```

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
    http-request set-var(txn.mtls_client_id) ssl_c_der,sha2(256),hex,lower,map(/etc/haproxy/mtls-clients.map)
    http-request deny deny_status 403 unless { var(txn.mtls_client_id) -m found }
    http-request set-header X-MTLS-Client-ID %[var(txn.mtls_client_id)]
    http-request del-header X-LiteLLM-Customer-ID
    http-request del-header X-LiteLLM-End-User-ID
    http-request set-header X-Forwarded-Proto https
    default_backend litellm_origin

backend litellm_origin
    http-request set-header Host litellm.internal
    server litellm litellm.internal:4000 ssl verify required ca-file /etc/haproxy/origin-ca.pem sni str(litellm.internal) verifyhost litellm.internal
```

### Identity forwarding

Validate with `haproxy -c -f /etc/haproxy/haproxy.cfg`, then reload. HAProxy requires a valid certificate and a fingerprint in the map. `set-header` replaces any client-supplied workload ID. The backend verifies the origin certificate and forwards `Authorization`. Allow origin access only from HAProxy. See [client certificate authentication](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/security/authentication/client-certificate-authentication/) and the [configuration reference](https://docs.haproxy.org/3.2/configuration.html).

## Kong Gateway

The [`mtls-auth` plugin requires Kong Gateway Enterprise](https://developer.konghq.com/plugins/mtls-auth/). Configure a private HTTPS listener for `llm-api.example.com` and enable the [Post-Function plugin](https://developer.konghq.com/plugins/post-function/) in your Kong deployment. Create separate CA Certificate entities for the client CA and the origin CA.

<IngressArchitecture kind="mtls-kong" />

### Configuration

Add this example to your declarative configuration. Replace both CA IDs, the credential UUID, the certificate SAN, and the CA PEM. Include the CA entities and listener certificate in the full configuration:

```yaml
_format_version: "3.0"
consumers:
  - username: billing-worker
    custom_id: billing-worker
    mtls_auth_credentials:
      - id: 37f2b624-5772-4b9a-9499-96a67b804d25
        subject_name: billing-worker.example.internal
        ca_certificate: |
          -----BEGIN CERTIFICATE-----
          REPLACE_WITH_ISSUING_CA_PEM
          -----END CERTIFICATE-----
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
          skip_consumer_lookup: false
          consumer_by: []
      - name: post-function
        config:
          access:
            - |
              local consumer = kong.client.get_consumer()
              if not consumer or not consumer.custom_id or consumer.custom_id == "" then
                return kong.response.exit(403, { message = "Missing workload identity" })
              end
              kong.service.request.set_header("X-MTLS-Client-ID", consumer.custom_id)
              kong.service.request.clear_header("X-LiteLLM-Customer-ID")
              kong.service.request.clear_header("X-LiteLLM-End-User-ID")
```

### Identity forwarding

`consumer_by: []` disables automatic Consumer matching. The explicit credential binds the certificate SAN to `billing-worker` and its issuing CA. Kong uses the CN only when the certificate has no SAN. Leave `anonymous` and `default_consumer` unset. See [manual certificate mappings](https://developer.konghq.com/plugins/mtls-auth/#manual-mappings-between-certificate-and-consumer-objects).

Post-Function runs after mTLS authentication. It reads the authenticated [Consumer object](https://developer.konghq.com/gateway/pdk/reference/kong.client/#kongclientget_consumer) and [overwrites the upstream identity header](https://developer.konghq.com/gateway/pdk/reference/kong.service.request/#kongservicerequestset_headerheader-of). It does not trust incoming `X-Consumer-*` headers. The common LiteLLM configuration records `billing-worker` as the customer ID. The virtual key still selects the LiteLLM user and team.

The Service uses HTTPS and verifies the origin certificate. See [Kong TLS configuration](https://developer.konghq.com/gateway/ssl-certificates/). Allow origin access only from Kong. Preserve `Authorization` and apply the plugin to every route to this Service. Review plugins that enable response buffering before using streaming.

## Verify the architecture

Run these checks from your corporate client network before you give out access. Certificate failures can appear as TLS errors or ingress HTTP errors, depending on the product. Inspect ingress and LiteLLM logs to confirm where the request stops.

| Test | Expected result |
| --- | --- |
| Trusted, valid certificate and allowed LiteLLM key | Completion succeeds |
| No certificate, even with a valid LiteLLM key | Ingress rejects the request |
| Expired certificate or a certificate signed by another CA | Ingress rejects the request |
| Valid certificate with a missing, invalid, or revoked client-supplied key | LiteLLM rejects the request in client-supplied-key mode |
| Valid certificate and key requesting a model outside the key's permissions | LiteLLM rejects the request |
| Certificate identity headers supplied without a client certificate | Ingress rejects the request |
| Valid certificate missing from an alias map or Kong Consumer mapping | Ingress or mapping proxy rejects the request |
| Valid certificate with forged workload or customer headers | LiteLLM records the mapped certificate workload ID |
| Direct origin, alternate hostname, or alternate public listener | Client cannot bypass mTLS |
| Streaming request lasting as long as your expected workload | Chunks arrive as the model generates them and the connection stays open |

If your ingress validates origin certificates, test an untrusted certificate and one with the wrong hostname. The ingress must reject both. ALB does not validate HTTPS target certificates. For certificate-only clients, also test a missing key-map entry and a revoked mapped key.

Set ingress, origin, and client timeouts for your longest request and gaps between streamed chunks. Adjust the 300-second examples to fit your workload. Keep proxy retries disabled so a retry does not replay a completion POST after the origin receives it. Keep health checks on the private backend.

<details>
<summary>Certificate and key lifecycle</summary>

Issue client certificates through your PKI. Include the client-authentication usage that your ingress requires. Use a dedicated CA or issuing intermediate for the allowed clients. Keep private keys with their owners. Upload only CA certificates to ingress trust stores.

Renew certificates before they expire. If you use aliases, map the new certificate to the same workload ID before clients switch. Azure's issuer/serial ID and GCP's fingerprint change with a new certificate. Update customer policies that use those IDs. During CA rotation, trust both old and new CA chains. Verify new client credentials, then remove the old CA and certificate mappings. Rotate ingress and origin server certificates separately.

Configure and test certificate revocation for your ingress. Examples include ALB trust-store CRLs, Application Gateway OCSP, and proxy CRLs. If your ingress does not support revocation, use short-lived certificates and plan how to remove trust. Test a new connection after revocation. Check how existing connections and caches affect enforcement. Revoke a compromised LiteLLM key separately through [key management](../virtual_keys.md).

</details>
