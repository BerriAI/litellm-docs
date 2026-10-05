# LiteLLM Self-Hosted Security & Encryption FAQ

## Data in Transit Encryption

### Does the product encrypt data in transit?

**Yes**, LiteLLM encrypts data in transit using TLS/SSL.

### Available in both OSS and Enterprise?

**Yes**, TLS encryption is available in both Open Source and Enterprise versions.

### In transit between the calling client and the product?

**Yes**, HTTPS/TLS is supported through SSL certificate configuration.

**Configuration:**
```bash
# CLI
litellm --ssl_keyfile_path /path/to/key.pem --ssl_certfile_path /path/to/cert.pem

# Environment Variables
export SSL_KEYFILE_PATH="/path/to/key.pem"
export SSL_CERTFILE_PATH="/path/to/cert.pem"
```

**Documentation Reference:** `docs/my-website/docs/guides/security_settings.md`

### In transit between the product and the LLM providers?

**Yes**, all connections to LLM providers use TLS encryption by default.

**Implementation Details:**
- Uses Python's `ssl.create_default_context()` 
- Uses HTTPX and aiohttp libraries with SSL/TLS enabled
- Uses certifi CA bundle by default for SSL verification

**Code Reference:** `litellm/llms/custom_httpx/http_handler.py` (lines 43-105)

### Are TCP sessions to the LLM providers shared?

**Yes**, TCP connections are pooled and reused.

**Details:**
- Connection pooling is enabled by default
- Default: 1000 max concurrent connections with keepalive
- Sessions are maintained across requests to the same provider
- Reduces overhead of TLS handshakes

**Code Reference:** `litellm/llms/custom_httpx/http_handler.py` (lines 704-712)

### Or does the product negotiate a new TLS session with the same LLM provider for every sequential call?

**No**, TLS sessions are reused through connection pooling. New TLS handshakes are not performed for every request.

### How is it encrypted?

**TLS 1.2 and TLS 1.3**

Uses Python's default SSL context which supports both TLS 1.2 and TLS 1.3. The specific version negotiated depends on:
- Python version
- System SSL library (typically OpenSSL)
- Server capabilities

**Implementation:** `ssl.create_default_context()` in Python

### How are these added to the product's configuration?

#### x.509 Certificate

**Method 1: CLI Arguments**
```bash
litellm --ssl_certfile_path /path/to/certificate.pem
```

**Method 2: Environment Variable**
```bash
export SSL_CERTFILE_PATH="/path/to/certificate.pem"
```

#### Private Key

**Method 1: CLI Arguments**
```bash
litellm --ssl_keyfile_path /path/to/private_key.pem
```

**Method 2: Environment Variable**
```bash
export SSL_KEYFILE_PATH="/path/to/private_key.pem"
```

#### Certificate Bundle/Chain

**For client-to-proxy connections:**
Use standard SSL certificate setup with intermediate certificates bundled in the certfile.

**For proxy-to-LLM provider connections:**

**Method 1: Config YAML**
```yaml
litellm_settings:
  ssl_verify: "/path/to/ca_bundle.pem"
```

**Method 2: Environment Variable**
```bash
export SSL_CERT_FILE="/path/to/ca_bundle.pem"
```

**Method 3: Client Certificate Authentication**
```yaml
litellm_settings:
  ssl_certificate: "/path/to/client_certificate.pem"
```

or

```bash
export SSL_CERTIFICATE="/path/to/client_certificate.pem"
```

### Documentation Coverage

**Primary Documentation:**
- `docs/my-website/docs/guides/security_settings.md` - SSL/TLS configuration guide

**Additional References:**
- `litellm/proxy/proxy_cli.py` (lines 455-467) - CLI options
- `docs/my-website/docs/completion/http_handler_config.md` - Custom HTTP handler configuration

---

## Data at Rest Encryption

### Does the product encrypt data at rest?

**Partially**. LiteLLM encrypts the credentials and secrets it stores in its own tables. Everything else it writes to Postgres, Redis, S3 or disk is plaintext. The two lists below are the exact scope.

### What data is stored in encrypted form?

Every value below is encrypted with the salt key before it reaches the database, so a raw `SELECT` on the table shows ciphertext. Where a column holds a JSON document, **every string value inside it is encrypted, however deeply it is nested** (a dict inside a dict, a string inside a list). Numbers, booleans and nulls are stored as they are. A document nested deeper than `DEFAULT_MAX_RECURSE_DEPTH` levels (100 by default) is refused on write instead of being stored with plaintext leaves below the cap.

#### Encrypted:
1. **Model deployments** - `LiteLLM_ProxyModelTable.litellm_params`: `api_key`, `api_base`, `aws_secret_access_key`, `vertex_credentials`, every string value under `extra_headers` and `aws_session_tags`, and every other string in the document, except that inside `complexity_router_config` only `jev_classifier_config.api_key` and `jev_classifier_config.api_base` are encrypted
2. **Guardrails** - `LiteLLM_GuardrailsTable.litellm_params`: the vendor `api_key`, `api_base`, and every other string in the document, including the `guardrail` and `mode` fields
3. **Provider credentials** - `LiteLLM_CredentialsTable.credential_values`: every value
4. **Config secrets** - the `environment_variables` and `router_settings` rows of `LiteLLM_Config`: every string value, so a `redis_password` or a `redis_url` in `router_settings` is ciphertext the same way an environment variable is
5. **MCP server credentials** - `LiteLLM_MCPServerTable.credentials`: `auth_value`, `client_id`, `client_secret`, `client_private_key`, the AWS key pair and session token; per-user BYOK credentials and per-user env vars are encrypted the same way
6. **Billing integration keys** - the `cloudzero_settings` row of `LiteLLM_Config` and the Vantage API key and integration token
7. **Virtual keys** - only when a secret manager is configured (optional feature, see below)

#### NOT Encrypted:
1. **Other config rows** - `general_settings` and `litellm_settings` in `LiteLLM_Config`, and the callback settings stored from the UI (callback values that are marked as secrets are the one exception: they are stored encrypted with a `litellm_enc::` prefix)
2. **Non-secret model fields** - `model_name`, `model_info`, the deployment's rate limits and budgets, which live outside `litellm_params`, and the classifier fields of `complexity_router_config` such as `classifier_type` and `instructions`, which stay plaintext because the proxy reads them in SQL
3. **Guardrail metadata** - `guardrail_name` and `guardrail_info`
4. **Spend logs** - request/response data in `LiteLLM_SpendLogs`
5. **Error logs** - `LiteLLM_ErrorLogs`
6. **Audit logs** - change history in `LiteLLM_AuditLog` (the before and after values of a model write are copied from the stored row, so the secrets inside them are ciphertext, but the row itself is not encrypted)
7. **User/Team/Organization Data** - metadata and configuration
8. **Cached prompts and completions** - cache data is stored in plaintext

### Rows written before encryption covered them

Older LiteLLM versions stored guardrail params, the nested values of a model's `litellm_params` (an `extra_headers` dict, for example) and `router_settings` in plaintext. A row written by such a version stays plaintext until it is written again: editing the model, guardrail or router settings from the UI or the management API, a `POST /config/update`, or a master key rotation (`POST /key/regenerate` with `new_master_key`) re-encrypts the whole row. The proxy reads both shapes, so nothing has to be migrated before upgrading. The boot-time `LITELLM_MIGRATE_FROM_MASTER_KEY` migration only re-keys values that are already encrypted, so it leaves such a row in plaintext. `lite encryption migrate --check` is a read-only scan that reports a `plaintext` count per table, which is how you find the rows that still need a write (see the [management CLI](./management_cli#encryption-migration)).

### Rolling upgrades and rollbacks

A worker running a version older than this encryption does not decrypt guardrail params, the nested values of a model's `litellm_params` or `router_settings`, so a row saved by an upgraded worker reads as ciphertext on it: that guardrail's vendor call fails and the router settings are applied as written. During a rolling upgrade this only affects rows saved while an old worker is still running, and they read correctly once the rollout finishes. After a rollback to such a version, save the affected rows again from the UI or the management API so they are stored in the shape that version reads. No flag keeps the old plaintext format, the same rule every other encrypted column above follows.

### Cached prompts and completions?

**No**, cached prompts and completions are **NOT encrypted**.

Cache backends (Redis, S3, local disk) store data as plaintext JSON.

**Code References:**
- `litellm/caching/redis_cache.py`
- `litellm/caching/s3_cache.py`
- `litellm/caching/caching.py`

### Configuration data?

**Partially encrypted**, as listed above: the `environment_variables` and `router_settings` rows of `LiteLLM_Config` and the `litellm_params` of every model and guardrail are encrypted; `general_settings`, `litellm_settings`, model names, `model_info`, rate limits and budgets are not.

**Code Reference:** `litellm/proxy/common_utils/encrypt_decrypt_utils.py` (`encrypt_json_strings` and `encrypt_config_section`)

### Log data?

**No**, log data is **NOT encrypted**.

Log data stored in database tables is in plaintext:
- `LiteLLM_SpendLogs` - Contains request/response data, tokens, spend
- `LiteLLM_ErrorLogs` - Error information
- `LiteLLM_AuditLog` - Audit trail of changes

**Note:** You can disable logging to avoid storing sensitive data:

```yaml
general_settings:
  disable_spend_logs: True   # Disable writing spend logs to DB
  disable_error_logs: True   # Disable writing error logs to DB
```

**Documentation:** `docs/my-website/docs/proxy/db_info.md` (lines 52-60)

### Where is it stored?

#### In the DB?

**Yes**, encrypted data is stored in PostgreSQL database.

**Key Tables with Encrypted Data:**
- `LiteLLM_ProxyModelTable` - Model configurations with encrypted `litellm_params`
- `LiteLLM_GuardrailsTable` - Guardrail configurations with encrypted `litellm_params`
- `LiteLLM_CredentialsTable` - Credential values
- `LiteLLM_Config` - `environment_variables` and `router_settings`
- `LiteLLM_MCPServerTable` - MCP server credentials

**Schema Reference:** `schema.prisma`

#### In the filesystem?

**No**, encrypted data is not stored in the filesystem by default.

**Note:** If using disk cache (`disk_cache_dir`), cached data is stored unencrypted.

#### Somewhere else?

**Optional:** When using secret managers (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault), encrypted data can be stored externally.

**Configuration:**
```yaml
general_settings:
  key_management_system: "aws_secret_manager"  # or "azure_key_vault", "hashicorp_vault"
```

**Documentation:** `docs/my-website/docs/secret.md`

### How is it encrypted?

**Default algorithm:** NaCl SecretBox (XSalsa20-Poly1305 AEAD)

**Optional algorithm:** AES-256-GCM, enabled with `general_settings.encryption_algorithm: aes-256-gcm`. New writes then carry a `v2:gcm:` prefix; reads detect the format, so existing XSalsa20 values keep working and `lite encryption migrate` re-encrypts them (see the [management CLI](./management_cli#encryption-migration)).

**Key Derivation:**
1. Takes `LITELLM_SALT_KEY` (or `LITELLM_MASTER_KEY` if salt key not set)
2. Hashes with SHA-256 to derive 256-bit encryption key
3. Uses NaCl SecretBox (or AES-256-GCM when opted in) for authenticated encryption

**Code Reference:** `litellm/proxy/common_utils/encrypt_decrypt_utils.py`

**Implementation (default algorithm):**
```python
import hashlib
import nacl.secret

# Derive 256-bit key from salt
hash_object = hashlib.sha256(signing_key.encode())
hash_bytes = hash_object.digest()

# Create SecretBox and encrypt
box = nacl.secret.SecretBox(hash_bytes)
encrypted = box.encrypt(value_bytes)
```

### Setting the Encryption Key

**Required Environment Variable:**
```bash
export LITELLM_SALT_KEY="your-strong-random-key-here"
```

**Important Notes:**
- ⚠️ **Must be set before adding any models**
- ⚠️ **Never change this key** - encrypted data becomes unrecoverable
- ⚠️ Use a strong random key (recommended: https://1password.com/password-generator/)
- If not set, falls back to `LITELLM_MASTER_KEY`
- If neither is set, nothing is encrypted and every value above is stored in plaintext

**Documentation:** `docs/my-website/docs/proxy/prod.md` (section 8, lines 184-196)

### Documentation Coverage

**Primary Documentation:**
- `docs/my-website/docs/proxy/prod.md` (section 8) - LITELLM_SALT_KEY setup
- `docs/my-website/docs/secret.md` - Secret management systems
- `docs/my-website/docs/proxy/db_info.md` - Database information

**Additional References:**
- `security.md` - General security measures
- `docs/my-website/docs/data_security.md` - Data privacy overview
- `schema.prisma` - Database schema with encrypted fields

---

## Summary of Security Features

### ✅ Provided Out of the Box

1. **TLS/SSL encryption** for client-to-proxy connections
2. **TLS encryption** for proxy-to-LLM provider connections (with connection pooling)
3. **Encrypted storage** of LLM API keys, guardrail params, router settings and credentials
4. **Support for TLS 1.2 and TLS 1.3**
5. **Connection pooling** to reduce TLS handshake overhead

### ⚠️ Important Limitations

1. **Cached data is NOT encrypted** (Redis, S3, disk cache)
2. **Log data is NOT encrypted** (spend logs, audit logs)
3. **Request/response payloads in logs are NOT encrypted**
4. **Uses NaCl SecretBox by default** (equivalent security to AES-256; AES-256-GCM is opt-in)
5. **TLS version not explicitly configured** - uses Python/system defaults

### 🔧 Configuration Requirements

**For Production Deployments:**

1. **Set LITELLM_SALT_KEY** before adding any models
2. **Configure SSL certificates** for HTTPS client connections
3. **Consider disabling logs** if they contain sensitive data
4. **Use secret managers** for enhanced security (optional)
5. **Configure CA bundles** if using custom certificates

---

## Quick Start Security Checklist

```bash
# 1. Generate a strong salt key
export LITELLM_SALT_KEY="$(openssl rand -base64 32)"

# 2. Set up SSL certificates (for HTTPS)
export SSL_KEYFILE_PATH="/path/to/private_key.pem"
export SSL_CERTFILE_PATH="/path/to/certificate.pem"

# 3. Configure database
export DATABASE_URL="postgresql://user:password@host:port/dbname"

# 4. (Optional) Disable logs if they contain sensitive data
# Add to config.yaml:
# general_settings:
#   disable_spend_logs: True
#   disable_error_logs: True

# 5. Start LiteLLM Proxy
litellm --config config.yaml
```

---

## Additional Resources

- **LiteLLM Documentation:** https://docs.litellm.ai/
- **Security Settings Guide:** https://docs.litellm.ai/docs/guides/security_settings
- **Production Deployment:** https://docs.litellm.ai/docs/proxy/prod
- **Secret Management:** https://docs.litellm.ai/docs/secret

For security inquiries: support@berri.ai

