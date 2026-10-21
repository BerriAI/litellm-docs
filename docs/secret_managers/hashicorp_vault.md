import Image from '@theme/IdealImage';

# Hashicorp Vault

<EnterpriseFeature />

| Feature | Support | Description |
|---------|----------|-------------|
| Reading Secrets | ✅ | Read secrets e.g `OPENAI_API_KEY` |
| Writing Secrets | ✅ | Store secrets e.g `Virtual Keys` |
| Authentication Methods to Hashicorp Vault | ✅ | AppRole, TLS Certificate, Token |

Read secrets from [Hashicorp Vault](https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2)

**Step 1.** Add Hashicorp Vault details in your environment

LiteLLM supports three methods of authentication:

1. AppRole authentication (recommended) - `HCP_VAULT_APPROLE_ROLE_ID` and `HCP_VAULT_APPROLE_SECRET_ID`
2. TLS cert authentication - `HCP_VAULT_CLIENT_CERT` and `HCP_VAULT_CLIENT_KEY`
3. Token authentication - `HCP_VAULT_TOKEN`

```bash
HCP_VAULT_ADDR="https://test-cluster-public-vault-0f98180c.e98296b2.z1.hashicorp.cloud:8200"
HCP_VAULT_NAMESPACE="admin" # OPTIONAL. Vault Enterprise namespace for both login and secret operations
HCP_VAULT_LOGIN_NAMESPACE="admin" # OPTIONAL. Namespace for AppRole / TLS cert login only. Defaults to HCP_VAULT_NAMESPACE
HCP_VAULT_SECRET_NAMESPACE="admin/teams/team-a" # OPTIONAL. Namespace for secret reads and writes only. Defaults to HCP_VAULT_NAMESPACE

# Authentication via AppRole (recommended)
HCP_VAULT_APPROLE_ROLE_ID="your-role-id"
HCP_VAULT_APPROLE_SECRET_ID="your-secret-id"
HCP_VAULT_APPROLE_MOUNT_PATH="approle" # OPTIONAL. defaults to "approle"

# OR - Authentication via TLS cert
HCP_VAULT_CLIENT_CERT="path/to/client.pem"
HCP_VAULT_CLIENT_KEY="path/to/client.key"

# OR - Authentication via token
HCP_VAULT_TOKEN="hvs.CAESIG52gL6ljBSdmq*****"


# OPTIONAL
HCP_VAULT_REFRESH_INTERVAL="86400" # defaults to 86400, frequency of cache refresh for Hashicorp Vault
HCP_VAULT_MOUNT_NAME="secret" # OPTIONAL. defaults to "secret", set this if your KV engine is mounted elsewhere
HCP_VAULT_PATH_PREFIX="litellm" # OPTIONAL. defaults to None, set this if your secrets live under a custom prefix like secret/data/litellm/OPENAI_API_KEY
```

**Step 2.** Add to proxy config.yaml

```yaml
general_settings:
  key_management_system: "hashicorp_vault"

  # [OPTIONAL SETTINGS]
  key_management_settings: 
    store_virtual_keys: true # OPTIONAL. Defaults to False, when True will store virtual keys in secret manager
    prefix_for_stored_virtual_keys: "litellm/" # OPTIONAL. If set, this prefix will be used for stored virtual keys in the secret manager
    access_mode: "read_and_write" # Literal["read_only", "write_only", "read_and_write"]
```

**Step 3.** Start + test proxy

```
$ litellm --config /path/to/config.yaml
```

[Quick Test Proxy](../proxy/user_keys)


## Authentication Methods

LiteLLM supports three authentication methods for Hashicorp Vault, with the following priority:

1. **AppRole** - Recommended for production applications
2. **TLS Certificate** - For certificate-based authentication
3. **Token** - Direct token authentication

### 1. AppRole Authentication

To set up AppRole authentication:

1. Enable AppRole auth in Vault:
```bash
vault auth enable approle
```

2. Create a policy and role for LiteLLM:
```bash
# Create a policy file (litellm-policy.hcl)
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Apply the policy
vault policy write litellm-policy litellm-policy.hcl

# Create an AppRole
vault write auth/approle/role/litellm \
    token_policies="litellm-policy" \
    token_ttl=32d \
    token_max_ttl=32d
```

3. Get your Role ID and Secret ID:
```bash
# Get Role ID
vault read auth/approle/role/litellm/role-id

# Generate Secret ID
vault write -f auth/approle/role/litellm/secret-id
```

4. Set the environment variables:
```bash
export HCP_VAULT_APPROLE_ROLE_ID="your-role-id"
export HCP_VAULT_APPROLE_SECRET_ID="your-secret-id"
```

### 2. TLS Certificate Authentication

TLS Certificate authentication uses client certificates for mutual TLS authentication with Vault.

**Environment Variables:**
```bash
export HCP_VAULT_CLIENT_CERT="path/to/client.pem"
export HCP_VAULT_CLIENT_KEY="path/to/client.key"
export HCP_VAULT_CERT_ROLE="your-cert-role"  # Optional
```

**How it works:**
- LiteLLM uses the client certificate and key for mutual TLS authentication
- Vault validates the certificate and issues a temporary token
- The token is cached for the duration of its lease

### 3. Token Authentication

Direct token authentication uses a static Vault token.

**Environment Variables:**
```bash
export HCP_VAULT_TOKEN="hvs.CAESIG52gL6ljBSdmq*****"
```

## Namespaces

On Vault Enterprise, LiteLLM sends the namespace in two places: as the `X-Vault-Namespace` header on the AppRole or TLS cert login request, and as a path segment in the URL of every secret read, write, rotate and delete. `HCP_VAULT_NAMESPACE` sets both. When the role that LiteLLM logs in with lives in a different namespace than the secrets it manages, set the two independently with `HCP_VAULT_LOGIN_NAMESPACE` and `HCP_VAULT_SECRET_NAMESPACE`. Each one falls back to `HCP_VAULT_NAMESPACE` when unset, so existing deployments keep working unchanged. The same three settings are available in the Admin UI under Settings > Admin Settings > Hashicorp Vault as Namespace, Login Namespace and Secret Namespace

For example, an AppRole that is defined in the top-level `admin` namespace and has access to every team namespace below it, with team virtual keys and provider secrets stored under `admin/teams/team-a`:

```bash
HCP_VAULT_ADDR="https://vault.example.com:8200"
HCP_VAULT_LOGIN_NAMESPACE="admin"
HCP_VAULT_SECRET_NAMESPACE="admin/teams/team-a"
HCP_VAULT_APPROLE_ROLE_ID="your-role-id"
HCP_VAULT_APPROLE_SECRET_ID="your-secret-id"
```

With this configuration the login request is `POST https://vault.example.com:8200/v1/auth/approle/login` with the header `X-Vault-Namespace: admin`, and a read of `OPENAI_API_KEY` goes to `GET https://vault.example.com:8200/v1/admin/teams/team-a/secret/data/OPENAI_API_KEY` with only the `X-Vault-Token` header. Vault addresses the root namespace by omitting the header, so to log in at root while reading team secrets, leave `HCP_VAULT_LOGIN_NAMESPACE` and `HCP_VAULT_NAMESPACE` unset and set only `HCP_VAULT_SECRET_NAMESPACE`. Secret requests never carry a namespace header, so the URL is the single source of truth for which namespace a secret lives in. A per-team `namespace` override (see [Team-specific overrides](#team-specific-overrides)) replaces `HCP_VAULT_SECRET_NAMESPACE` for that team's keys and never affects login

## How it works

**Reading Secrets**

LiteLLM reads secrets from Hashicorp Vault's KV v2 engine using the following URL format:
```
{VAULT_ADDR}/v1/{NAMESPACE}/{MOUNT_NAME}/data/{PATH_PREFIX}/{SECRET_NAME}
```

For example, if you have:
- `HCP_VAULT_ADDR="https://vault.example.com:8200"`
- `HCP_VAULT_NAMESPACE="admin"`
- `HCP_VAULT_MOUNT_NAME="secret"`
- `HCP_VAULT_PATH_PREFIX="litellm"`
- Secret name: `AZURE_API_KEY`


LiteLLM will look up:
```
https://vault.example.com:8200/v1/admin/secret/data/litellm/AZURE_API_KEY
```

### Expected Secret Format

LiteLLM expects all secrets to be stored as a JSON object with a `key` field containing the secret value.

For example, for `AZURE_API_KEY`, the secret should be stored as:

```json
{
  "key": "sk-<virtual-key>"
}
```

<Image img={require('../../img/hcorp.png')} />

**Writing Secrets**

When a Virtual Key is Created / Deleted on LiteLLM, LiteLLM will automatically create / delete the secret in Hashicorp Vault.

- Create Virtual Key on LiteLLM either through the LiteLLM Admin UI or API

<Image img={require('../../img/hcorp_create_virtual_key.png')} />


- Check Hashicorp Vault for secret

LiteLLM stores secret under the `prefix_for_stored_virtual_keys` path (default: `litellm/`)

<Image img={require('../../img/hcorp_virtual_key.png')} />

### Team-specific overrides

When running the LiteLLM proxy you can override the Vault location per team. Use the [Team-Level Secret Manager Settings](./overview.md#team-level-secret-manager-settings) flow in the dashboard and configure the panel shown below:

<Image img={require('../../img/secret_manager_hashicorp_vault_settings.png')} />

Use the following structure for the JSON payload:

```json
{
  "namespace": "teams/team-a",
  "mount": "kv-prod",
  "path_prefix": "virtual-keys",
  "data": "password"
}
```

- `namespace` – overrides the secret namespace (`HCP_VAULT_SECRET_NAMESPACE`, or `HCP_VAULT_NAMESPACE` when that is unset) in the secret URL. Login always uses the login namespace.
- `mount` – which KV engine mount to use (defaults to `secret`).
- `path_prefix` – additional path segments between the mount and the secret name.
- `data` – the field name inside the KV payload (defaults to `key`).

Whenever LiteLLM stores or deletes virtual keys for that team, these overrides are applied so you can keep each team’s credentials in its own namespace, mount, or field layout without changing the global Vault configuration.
