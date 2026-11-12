---
title: Token Redaction in Spend Logs
description: Mask known token-shaped secrets in stored spend log content without changing provider requests or client responses.
---

# Token Redaction in Spend Logs

LiteLLM replaces known token-shaped secrets in stored spend log content with `REDACTED_BY_LITELM`. The `general_settings.redact_tokens_in_spend_logs` flag is **on by default**. Leaving it unset or setting it to `true` enables redaction. Set it explicitly to `false` to opt out.

This setting applies only to content retained with `store_prompts_in_spend_logs: true`. It does not enable prompt storage itself. A key or team that [opts out of prompt storage](./ui_logs.md#turn-off-prompt-storage-for-a-key-or-team) still stores no request or response content.

## Configuration

Enable prompt storage in your `config.yaml` and restart the proxy. Token redaction applies by default, so no additional flag is needed.

```yaml
general_settings:
  store_prompts_in_spend_logs: true
```

To opt out and keep token-shaped strings in the stored content, set the flag to `false`.

```yaml
general_settings:
  store_prompts_in_spend_logs: true
  redact_tokens_in_spend_logs: false
```

Keep your existing model and database configuration. See [request and response storage](./ui_logs.md#tracking---request--response-content-in-logs-page) for how to enable spend log content.

## Stored content covered

Redaction covers string values in the stored request body in `proxy_server_request` and in the stored `response`, including nested messages, tool results, tool-call arguments and logprobs. It also covers compaction summary text retained in the stored payload. For realtime calls, it covers the serialized messages stored in the separate `messages` column.

The setting filters the stored copy, not the live payload. The request sent to the provider and the response returned to the client are unchanged. It does not rewrite rows already in the database.

## Token shapes

The table lists every pattern in `_TOKEN_SHAPES`, plus the PEM private-key block pattern, from [the implementation in PR #48968](https://github.com/BerriAI/litellm/pull/48968). Matching is case-sensitive. Lengths refer to the characters after the stated prefix unless the row says otherwise.

| Provider or format | Matched shape |
| --- | --- |
| Google OAuth | `ya29.` followed by at least 20 letters, digits or characters from `_.~+/-`. |
| AWS access key ID | `AKIA` or `ASIA` followed by exactly 16 uppercase letters or digits, then a word boundary. This matches the ID, not an unprefixed AWS secret access key. |
| OpenAI-style, Anthropic and LiteLLM keys | `sk-` followed by letters, digits, hyphens or underscores. The suffix minimum is `MINIMUM_CUSTOM_KEY_LENGTH - 3`, which is 13 by default, for a minimum total length of 16. The environment variable `MINIMUM_CUSTOM_KEY_LENGTH` changes this threshold. |
| Stripe | `sk_live_`, `sk_test_`, `rk_live_` or `rk_test_` followed by at least 24 letters or digits. |
| Google API key | `AIza` followed by exactly 35 letters, digits, hyphens or underscores. |
| Databricks | `dapi` followed by exactly 32 lowercase hexadecimal characters, then a word boundary. |
| GitHub classic and OAuth tokens | `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_` followed by at least 36 letters or digits. |
| GitHub fine-grained personal access token | `github_pat_` followed by exactly 82 letters, digits or underscores. |
| GitLab personal access token | `glpat-` followed by at least 20 letters, digits, hyphens or underscores. |
| Linear | `lin_api_` followed by exactly 40 letters or digits, then a word boundary. |
| Slack | `xoxa-`, `xoxb-`, `xoxp-`, `xoxo-`, `xoxs-` or `xoxr-` followed by at least 10 letters, digits or hyphens. |
| Hugging Face | `hf_` followed by at least 34 letters or digits. |
| npm | `npm_` followed by exactly 36 letters or digits, then a word boundary. |
| PyPI | `pypi-AgEIcHlwaS5vcmc` followed by at least 50 letters, digits, hyphens or underscores. |
| SendGrid | `SG.` followed by 22 letters, digits, hyphens or underscores, a dot, then 43 characters from the same set and a word boundary. |
| JWT | Three dot-separated segments. The first two each start with `eyJ` followed by at least 10 letters, digits, hyphens or underscores. The third contains at least one character from that set. |
| PEM private key | A complete block from `-----BEGIN…PRIVATE KEY-----` through `-----END…PRIVATE KEY-----`, including multiline content. The text between `BEGIN` or `END` and `PRIVATE KEY` can contain uppercase letters, spaces and hyphens, as in RSA or EC key headers. The pattern does not require matching header and footer labels or a fixed block length. |

Patterns with an exact suffix length but no trailing word boundary can match the corresponding prefix of a longer string. These are shape checks, not credential validation.

## How it works

During asynchronous spend-log processing after the response is sent, LiteLLM runs a regex pass over every string retained by the spend-log content sanitizer. Matching substrings become `REDACTED_BY_LITELM` before long strings are truncated for database storage. Realtime messages run through the same redactor after JSON serialization. Retained compaction summaries are redacted before their separate length limit is applied.

Token patterns start where the preceding character is not a word character, or immediately after a JSON escape `\n`, `\r` or `\t`. Word characters include letters, digits and underscores. This start rule catches tokens at the beginning of text and after punctuation, whitespace or serialized line breaks, without matching a token prefix embedded inside another word. The PEM block pattern does not need this start rule.

This pass does not match keywords such as `password`, `Basic` or `Bearer`. Ordinary text without a known token shape stays untouched by this pass. Existing spend-log credential-field masking and payload truncation still apply independently.

## Stored tool result example

With `redact_tokens_in_spend_logs: false`, a tool result can retain a synthetic GitHub token in its stored content.

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_1",
  "content": "GITHUB_TOKEN=ghp_a1B2c3D4e5a1B2c3D4e5a1B2c3D4e5F6g7H8\ndone"
}
```

With the default behavior, or with the flag explicitly set to `true`, the stored copy contains the replacement and keeps the surrounding text.

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_1",
  "content": "GITHUB_TOKEN=REDACTED_BY_LITELM\ndone"
}
```

## Limitations

This flag applies only to spend logs. It does not redact OpenTelemetry, Langfuse or other logging callbacks. Configure those integrations separately.

Only the known shapes above are detected. This is not PII detection and does not find arbitrary passwords, unprefixed secrets or every possible provider credential. Ordinary text that happens to match a token shape can also be masked. Use this setting as an extra safeguard rather than a guarantee that stored content contains no secrets.

The live provider request and client response remain unchanged. To mask content before it reaches a provider, use a separate request guardrail rather than this spend-log setting.
