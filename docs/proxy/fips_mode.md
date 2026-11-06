---
description: general_settings.fips_mode is an in-progress setting for new FIPS 140-3 deployments. Today it adds a startup check that refuses to boot unless OpenSSL and the cryptography library enforce FIPS; moving every operation to FIPS-approved algorithms is still on the roadmap.
---

# FIPS mode (in progress)

:::danger[Not finished, and for new deployments only]
FIPS mode is a work in progress. Moving LiteLLM's cryptographic operations to FIPS-approved algorithms is on the roadmap and not done yet, so a proxy running with `fips_mode: true` today does not use approved algorithms for every operation, and some features fail on a FIPS-enforcing OpenSSL (see [Known limitations](#known-limitations)).

FIPS mode is only for new deployments. Turning it on for an existing deployment is not supported, and existing passwords, encrypted secrets and tokens are not migrated.

LiteLLM is not itself a FIPS 140-3 validated module. FIPS mode relies on the validated cryptographic modules it runs on.
:::

## What it does today

Setting `fips_mode: true` under `general_settings` adds a startup check:

```yaml
general_settings:
  fips_mode: true
```

At startup the proxy refuses to boot, with a `FipsModeError` that names the reason, unless Python's OpenSSL runs with its FIPS provider active and `default_properties = fips=yes`, and the `cryptography` library's OpenSSL also has a working FIPS provider. The `cryptography` wheels on PyPI bundle their own OpenSSL without a FIPS provider, so build `cryptography` from source against the system OpenSSL, for example with `pip install --no-binary cryptography cryptography` or uv's `--no-binary-package cryptography`. The value must be a boolean. Any other value, or an `os.environ/` reference to a variable that is not set, also stops the proxy. With the setting off or absent, nothing changes.

Added in [PR #48600](https://github.com/BerriAI/litellm/pull/48600).

## Known limitations

These describe the current state and will change as the roadmap work lands.

With `fips_mode: true` on a FIPS-enforcing OpenSSL, operations that still use non-approved algorithms fail instead of falling back. That includes setting or checking Admin UI passwords (scrypt), MCP gateway session tokens and OAuth bridge tokens (keys derived with scrypt), and, on Python builds that block built-in hashes in FIPS mode such as Chainguard's, creating MCP servers through the API (BLAKE2b).

The startup check also refuses OpenSSL configurations that keep MD5 available for non-security use. That includes Chainguard's FIPS images with their default `CHAINGUARD_LEGACY_ALLOWED=1`.

LiteLLM does not publish a FIPS image yet.

## Roadmap

The remaining work moves each security-relevant operation to an approved service of the validated module when `fips_mode` is on, and keeps today's behavior when it is off. In flight are PBKDF2-HMAC-SHA256 for Admin UI passwords ([PR #49874](https://github.com/BerriAI/litellm/pull/49874)) and an SP 800-108 KBKDF in the FIPS provider for MCP session and bridge keys ([PR #50032](https://github.com/BerriAI/litellm/pull/50032)).

Planned after those:
- approved encryption for stored secrets;
- restrictions on JWT signing and TLS cipher algorithms;
- a FIPS image built on Chainguard's FIPS base, with dependencies that carry their own cryptography (`cryptography`, `psycopg` and `grpcio`) rebuilt against the system OpenSSL or removed.

This page will be updated as each part lands.
