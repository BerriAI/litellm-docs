# Zenity

[Zenity](https://zenity.io) provides security and data protection for Agentic AI. The Zenity guardrail integrates with [LiteLLM Proxy](https://docs.litellm.ai) via the [Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api) to inspect and enforce on LLM traffic in real time:

- **Prompt injection & jailbreaks** — detect attempts to manipulate the model or bypass its guardrails
- **Sensitive data & secrets** — detect exposure of credentials and sensitive content
- **Policy & Boundary enforcement** — evaluate every prompt and response against the policies and Boundaries defined in your Zenity environment, and block violations inline

Detection rules and enforcement (Detect vs. Block) are configured in Zenity; LiteLLM enforces the allow/block verdict Zenity returns for each call.

## Quick Start

### 1. Create the LiteLLM integration in Zenity

In the Zenity platform, go to **Connect → Integrations**, create a new integration, and select **LiteLLM** as the platform.

### 2. Get the API key

Enable the **inline webhook** on the integration, then copy the **API key** (it starts with `ak_`) — you'll send it as a bearer token below. Your **inline endpoint** is your Zenity region's URL (used as `api_base` in step 3).

:::warning[Important]
Store the API key securely — it may be shown only once. If you regenerate it, the previous key is revoked and any proxy using the old key stops being protected.
:::

### 3. Add the Zenity guardrail to config.yaml

In your LiteLLM Proxy `config.yaml`, add a guardrail that uses the Generic Guardrail API:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: zenity
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      # Your Zenity region's inline endpoint:
      #   EU: https://edge.eu1.zenity.io/api/v0/litellm
      #   US: https://edge.us1.zenity.io/api/v0/litellm
      api_base: https://edge.eu1.zenity.io/api/v0/litellm
      default_on: true
      headers:
        Authorization: "Bearer <ZENITY_API_KEY>"  # the ak_ key from step 2
```

**Configuration notes**

- Set `api_base` to your Zenity region's inline endpoint (EU or US, shown above). LiteLLM automatically appends `/beta/litellm_basic_guardrail_api` — do not add that suffix yourself.
- The API key must be sent as a bearer token in `headers.Authorization`. Do not use LiteLLM's `api_key` field — it is sent as `x-api-key` and will not authenticate.
- `mode: [pre_call, post_call]` evaluates both directions. Because `pre_call` runs before the model, a blocked prompt never reaches it.
- By default LiteLLM fails closed (`fail_on_error: true`): if Zenity is unreachable, the call errors. To fail open instead, add `fail_on_error: false` under `litellm_params`.

### 4. Set policies to Block (for prevention)

By default, inline rules are in **Detect** mode — Zenity identifies and logs threats but does not block them. To enable active prevention, switch the relevant rules to **Block**:

1. In Zenity, open the **Policies** tab.
2. Select the LiteLLM integration by name, then select the **Inline** tab.
3. For each relevant rule, change the action from **Detect** to **Block**.

| Mode | Behavior |
|------|----------|
| **Detect** | Zenity identifies and logs the threat, but the prompt/response passes through |
| **Block** | Zenity blocks the prompt or response in real time |

### 5. Restart and test

Restart the LiteLLM proxy so the new guardrail loads:

```bash
litellm --config config.yaml --port 4000
```

Send a completion whose prompt contains an obviously **fabricated** secret — for example the AWS documentation example key `AKIAIOSFODNN7EXAMPLE` — with the matching rule set to **Block**:

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-litellm-key>" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Save this credential: AKIAIOSFODNN7EXAMPLE"}]
  }'
```

LiteLLM rejects the request and the model is never called:

```json
{
  "error": {
    "message": "Request blocked by Zenity security policy.",
    "type": "None",
    "param": "None",
    "code": "400"
  }
}
```

:::warning[Important]
Always test with a fabricated value. Never send a real credential to verify the guardrail.
:::

:::tip
To confirm the guardrail is being called before you switch to blocking, send the same request while the rule is still in **Detect** mode and check the interaction appears in Zenity. Then set the rule to **Block** and re-send to confirm it is rejected.
:::

## Guardrail Modes

| Mode | When It Runs | What It Inspects | Use Case |
|------|-------------|------------------|----------|
| **`pre_call`** | Before the LLM call | The user prompt | Block malicious prompts before the model runs |
| **`during_call`** | In parallel with the LLM call | The user prompt | Prompt inspection without adding latency before the model (block-only) |
| **`post_call`** | After the LLM response | The model response | Inspect and block unsafe output before it reaches the user |

:::tip[Recommended]
Use `[pre_call, post_call]` to inspect both prompts and responses.
:::

Each guardrail evaluation is a single round-trip to Zenity (roughly 90–400 ms per call against a stage endpoint in testing). For streamed responses, `post_call` inspection applies to the assembled response before it is returned.

## Attribution

Zenity attributes each inspected call for investigation using identifiers LiteLLM forwards:

- **End user** — from the `x-litellm-end-user-id` header or the `user` request field.
- **Session / thread** — from the `x-litellm-trace-id` header (stable across turns of a conversation).

## Configuration Reference

| Parameter | Description |
|-----------|-------------|
| `guardrail` | Must be `generic_guardrail_api` (do not change this value) |
| `api_base` | The inline endpoint for your Zenity integration (step 2) |
| `headers.Authorization` | `Bearer <your Zenity API key>` |
| `mode` | When to run: `pre_call`, `post_call`, `during_call`, or an array like `[pre_call, post_call]` |
| `default_on` | Enable the guardrail for all requests by default |
| `fail_on_error` | On a guardrail error or unreachable Zenity: `true` (default) blocks the request, `false` lets it proceed |

## Error Handling

By default the Zenity guardrail **fails closed**: if Zenity is unreachable or returns an error, LiteLLM errors the request (`fail_on_error` defaults to `true`). To prioritize availability of your LLM traffic over enforcement, set `fail_on_error: false` — guardrail errors are then logged at critical level (with the call and trace ids) and the request proceeds. A parsed `BLOCKED` verdict always blocks (HTTP 400), regardless of this setting.

## Boundary-based prevention (alternative)

Beyond rule-level policies, LiteLLM is also a supported target for **Boundary-based** prevention: scope a Boundary to LiteLLM and set it to **Prevent** to block interactions that cross it in real time. See the Boundaries guide for how to define and enforce Boundaries.

## Troubleshooting

**Requests are not being evaluated**
- Confirm the guardrail block is present in `config.yaml` and the proxy was restarted.
- Ensure `default_on: true` (or that the guardrail is explicitly enabled on the request).
- Verify `api_base` is the inline endpoint from step 2 and does **not** include the `/beta/litellm_basic_guardrail_api` suffix.

**Authentication errors (401/403)**
- Confirm the API key is sent as `Authorization: Bearer <ak_...>` in `headers`, not in LiteLLM's `api_key` field.
- Check the key was copied correctly (no extra spaces) and has not been regenerated.

**Threats detected but not blocked**
- Ensure the relevant inline rules are set to **Block**, not just **Detect** (step 4).
- Allow 2–3 minutes for policy changes to propagate.

## Support

Contact [support@zenity.io](mailto:support@zenity.io) with your integration name, the error message, and a relevant proxy log excerpt. For more on Zenity, see the [Zenity documentation](https://docs.zenity.io).
