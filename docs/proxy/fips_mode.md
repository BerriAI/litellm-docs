---
description: Learn how to enable FIPS mode in LiteLLM, what it currently supports, and what's still being worked on.
---

# FIPS Mode (Work in Progress)

<SinceVersion v="1.109.0" />

:::danger[FIPS support is not yet complete]
FIPS mode is still under development. While LiteLLM can check whether it is running in a FIPS-enabled environment, not all cryptographic operations have been updated to use FIPS-approved algorithms. Some features may fail when FIPS mode is enabled.

**FIPS mode is intended for new deployments only.** Enabling it on an existing deployment is not supported. Existing passwords, encrypted secrets, and tokens will not be migrated.

LiteLLM itself is not FIPS 140-3 certified. Instead, it relies on FIPS 140-3 validated cryptographic modules provided by the underlying environment.
:::

## Enabling FIPS Mode

To enable FIPS mode, add the following to your LiteLLM configuration:

```yaml
general_settings:
  fips_mode: true
```

When enabled, LiteLLM checks the cryptographic environment during startup. The proxy will refuse to start if:

- Python's OpenSSL is not running with the FIPS provider enabled and `default_properties = fips=yes`.
- The `cryptography` library is not using a working FIPS provider.
- `fips_mode` is not set to a valid boolean, or references an environment variable that is missing.

If any of these checks fail, LiteLLM raises a `FipsModeError` explaining the issue.

**Note:** The standard `cryptography` package from PyPI includes its own OpenSSL, which does not include a FIPS provider. You will need to build it from source against your system's OpenSSL:

```bash
pip install --no-binary cryptography cryptography
```

If you're using uv, you can use `--no-binary-package cryptography` instead.

When `fips_mode` is `false` or not configured, LiteLLM behaves as it normally would.

This startup check was introduced in [PR #48600](https://github.com/BerriAI/litellm/pull/48600).

## Known Limitations

FIPS support is still being implemented, so some functionality is not yet compatible with FIPS-enabled environments.

Currently, the following operations may fail:

- **Admin UI passwords:** Password hashing and verification still use `scrypt`, which is not available through the OpenSSL FIPS provider.
- **MCP authentication:** MCP gateway session tokens and OAuth bridge tokens derive their keys using `scrypt`.
- **MCP server creation:** Some Python builds, including Chainguard's FIPS-enabled Python, block the BLAKE2b hashing used when creating MCP servers through the API.

There is also a known issue with the startup check. It currently expects MD5 to be unavailable, but some FIPS environments allow MD5 for non-security purposes. As a result, the check rejects Chainguard FIPS images using their default `CHAINGUARD_LEGACY_ALLOWED=1` setting, even when the FIPS provider is enabled.

**A dedicated LiteLLM FIPS Docker image is not available yet.**

## What's Next

We're working toward supporting FIPS-approved cryptographic operations while keeping the existing behavior unchanged for deployments that don't enable FIPS mode.

The following changes are currently in progress:

- **Admin UI password hashing:** Replace `scrypt` with PBKDF2-HMAC-SHA256 in FIPS mode. See [PR #49874](https://github.com/BerriAI/litellm/pull/49874).
- **MCP key derivation:** Use the FIPS provider's SP 800-108 KBKDF for MCP session and OAuth bridge keys. See [PR #50032](https://github.com/BerriAI/litellm/pull/50032).

Additional work includes:

- Updating stored-secret encryption to use approved cryptographic services.
- Restricting JWT signing algorithms and TLS ciphers to those supported in FIPS mode.
- Building a dedicated LiteLLM FIPS Docker image using Chainguard's FIPS base image.
- Rebuilding or removing dependencies that bundle their own cryptographic libraries, including `cryptography`, `psycopg`, and `grpcio`.

We'll update this page as FIPS support progresses.
