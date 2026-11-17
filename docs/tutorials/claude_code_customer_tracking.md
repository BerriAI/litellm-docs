# Claude Code - Granular Cost Tracking

Track Claude Code spend by customer organization and member with [Customer Management](../proxy/customers.md). Add tags to group costs by project or environment.

<SinceVersion v="1.111.0" />

## Set up customer tracking

Start with a gateway on v1.111 or later, PostgreSQL with migrations applied, and an application key that can call your configured Claude model. Use your existing `LITELLM_BASE_URL` and `LITELLM_API_KEY` environment values. Keep the gateway URL at its root, without `/v1`.

Set `ANTHROPIC_CUSTOM_HEADERS` with one header per line:

```bash
export ANTHROPIC_BASE_URL="$LITELLM_BASE_URL"
export ANTHROPIC_API_KEY="$LITELLM_API_KEY"
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-customer-org-alias: Acme
x-litellm-customer-member-id: acme-alice"
claude
```

Replace `Acme` and `acme-alice` with your customer's organization alias and stable member ID. Use a member ID that is unique across the gateway. LiteLLM registers new identities under the default team, subject to [capacity limits](../proxy/customers.md#before-you-start). [Create budgets first](../proxy/customer_management/track-customer-spend.md#2-import-a-customer) if you need customer caps from the first request.

Send a prompt in Claude Code. Then open **Customer Management → Customers → Acme**, select a date range that includes the request, and check the member's spend, requests, and tokens. Allow for background accounting. See [request details](../proxy/customer_management/track-customer-spend.md#7-debug-a-request-in-spend-logs) to inspect the resolved customer and cost in Logs.

## Add project or environment tags

Append `x-litellm-tags` to the same variable. Keep the two customer headers to attribute the request to a customer too:

```bash
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-customer-org-alias: Acme
x-litellm-customer-member-id: acme-alice
x-litellm-tags: project:support,env:prod"
```

You can also send the tags header on its own. See [tag budgets](../proxy/tag_budgets.md) for spending limits on tags.

## Legacy end-user tracking

These examples remain supported for the flat `/customer/*` APIs and the **End User** log field. Use the setup above for Customer Management. The screenshots below show the legacy tracking flow.

### How It Works

Claude Code supports custom headers via `ANTHROPIC_CUSTOM_HEADERS`. LiteLLM automatically tracks requests with specific headers for cost attribution.

### Why Set a Customer Header

Without one, Claude Code still reaches customer tracking on its own. It sends a per-session JSON blob in `metadata.user_id`, which LiteLLM reads as a customer ID, so every session shows up as a separate customer and picks up its own copy of any default customer budget you have configured. Setting `x-litellm-customer-id` overrides that, since headers are checked before any request body field. If you would rather have that traffic carry no customer at all, see [Restricting Which IDs Become Customers](../proxy/legacy_end_users.md#restricting-which-ids-become-customers).

### Tracking Options

Choose how you want to attribute costs:

| Track By | Header | Use Case |
|----------|--------|----------|
| Customer | `x-litellm-customer-id` | Bill customers, per-user budgets |
| Tags | `x-litellm-tags` | Project tracking, cost centers, environments |

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_BASE_URL` | LiteLLM proxy URL | `http://localhost:4000` |
| `ANTHROPIC_API_KEY` | LiteLLM API key | `sk-<your-api-key>` |
| `ANTHROPIC_CUSTOM_HEADERS` | Custom headers (`header-name: value` format) | See examples below |

### Option 1: Track by Customer

Use this to attribute costs to specific customers or end-users.

```bash
export ANTHROPIC_BASE_URL=http://localhost:4000
export ANTHROPIC_API_KEY=sk-<your-api-key>
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-customer-id: claude-ishaan-local"
```

### Option 2: Track by Tags

Use this to attribute costs to projects, cost centers, or environments. Pass comma-separated tags.

```bash
export ANTHROPIC_BASE_URL=http://localhost:4000
export ANTHROPIC_API_KEY=sk-<your-api-key>
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-tags: project:acme,env:prod,team:backend"
```


### Quick Start

#### 1. Set Environment Variables

```bash
export ANTHROPIC_BASE_URL=http://localhost:4000
export ANTHROPIC_API_KEY=sk-<your-api-key>
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-customer-id: claude-ishaan-local"
```

#### 2. Use Claude Code

```bash
claude
```

All requests will now be tracked under the customer ID `claude-ishaan-local`.

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/8f45872e-2d00-4d01-bf3d-4d6ae11d1396/ascreenshot_d2a745b8da4f4a56aaf2cac02871ef53_text_export.jpeg)

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/dd41eae3-2592-4bc9-a8d2-d6d02614cd2d/ascreenshot_43ec9ee48ad946cca49732f007e786fc_text_export.jpeg)

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/0c30309e-7117-4999-a3df-d22a2d5629c1/ascreenshot_d76a48c53b9a4fad8f6727baf4aa6a9c_text_export.jpeg)

#### 3. View Usage in LiteLLM UI

Navigate to the **Logs** tab in the LiteLLM UI.

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/ff774392-69f5-483e-83e2-fb749c94ee90/ascreenshot_d264fc04c9ee47edb047f61b6eb8c4d7_text_export.jpeg)

Click on a request to see details.

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/5f71589b-5fdd-4759-9b6e-e6874be0eb21/ascreenshot_92dd86dadccb4764b1169c29c10dfe65_text_export.jpeg)

Filter by customer ID to see all requests for that customer.

![](https://colony-recorder.s3.amazonaws.com/files/2026-01-16/dd1c8aba-e75b-4714-9eee-c785e9db99af/ascreenshot_36aaec0fe12f4189b64f704a551e6729_text_export.jpeg)

### Supported Headers

| Header | Description |
|--------|-------------|
| `x-litellm-customer-id` | Track by customer/end-user ID |
| `x-litellm-end-user-id` | Alternative customer ID header |
| `x-litellm-tags` | Comma-separated tags for cost attribution |

### Related

- [Claude Code Quickstart](./claude_responses_api.md)
- [Codex CLI - Granular Cost Tracking](./codex_customer_tracking.md)
- [Legacy customer budgets](../proxy/legacy_end_users.md)
- [Tag Budgets](../proxy/tag_budgets.md)
- [Track Usage for Coding Tools](./cost_tracking_coding.md)

