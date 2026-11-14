---
slug: vantage-token-cost-allocation
title: "LiteLLM × Vantage: Token Cost Allocation for Shared Provider Accounts"
date: 2026-10-09T10:00:00
authors: [misbah]
description: "Vantage released a LiteLLM integration for Token Cost Allocation. It uses LiteLLM request data to divide provider-billed AI costs by team, user, application, and customer."
image: /img/litellm_vantage_announcement.png
tags: [partnership, ai-gateway, cost-tracking, vantage]
hide_table_of_contents: false
---

![LiteLLM × Vantage](/img/litellm_vantage_announcement.png)

Vantage released a LiteLLM integration for Token Cost Allocation. It uses LiteLLM request data to divide the costs on a provider bill by team, user, application, and customer. This also applies when many teams use the same provider account or API key.

{/* truncate */}

## What the provider bill does not show

Many organizations use one provider account or one API key for many teams. The provider bill shows the total cost for that account. The bill does not show which team, user, or application used the tokens. LiteLLM has this information for each request.

## How the integration operates

![The request path goes from your application through the LiteLLM proxy to the model providers. The Vantage callback sends token usage and tags to the Vantage collector. Vantage divides each provider cost by token share and shows Cost Reports by team, user, and customer.](/img/vantage_token_allocation_flow.svg)

The Vantage callback operates in the Python environment of the LiteLLM proxy. It sends the token usage and the tags of each request to the Vantage collector. The collector operates as a sidecar of the proxy and uploads this data to Vantage. Vantage then divides each provider cost by the quantity of tokens for each set of tags.

The integration does not collect prompts or completions. If the collector stops, LiteLLM continues to send requests to the model providers.

## LiteLLM spend tracking compared with Vantage

LiteLLM and Vantage show AI costs at different times and for different users.

LiteLLM operates in the request path. It records the cost of each request from its model cost map. When a key, team, or user gets to its budget, LiteLLM rejects the next request. Use LiteLLM to control AI costs while requests occur.

Vantage operates after the requests. It receives the usage data in batches and compares it with the costs that each provider billed. Vantage writes that the integration is for "ongoing cost management rather than real-time request observability." Use Vantage to divide the provider bill for your finance teams.

LiteLLM also has a built-in `vantage` callback. That callback sends the costs that LiteLLM calculates to a Vantage Custom Provider. Do not use the two integrations for the same providers. If you do, Vantage counts these AI costs two times.

## Tags for allocation

Vantage uses the teams, keys, and users that you have in LiteLLM. The callback adds these LiteLLM values as tags automatically: organization ID and alias, team ID and alias, project ID and alias, user ID, end user ID, and key alias.

You can also add tags in `metadata.spend_logs_metadata` or in `metadata.tags`. In `metadata.tags`, use the `key:value` format, for example `app:support-bot`.

```python
response = client.chat.completions.create(
    model="my-model",
    messages=[{"role": "user", "content": "Summarize this ticket."}],
    extra_body={
        "metadata": {
            "spend_logs_metadata": {
                "customer": "acme",
                "application": "support-bot"
            }
        }
    }
)
```

In Vantage, you can then show costs for each `customer` and each `application`.

## Set up the LiteLLM side

Token Cost Allocation is available to Vantage Enterprise customers.

1. In Vantage, get the installation token for a LiteLLM source.
2. In the Python environment of the LiteLLM proxy, install the Vantage callback. Use the same version as the collector image.

   ```bash
   pip install vantage-litellm-callback==<version>
   ```

3. Add the callback to the proxy configuration.

   ```yaml
   litellm_settings:
     callbacks:
       - vantage_callback.callback_instance
   ```

4. Deploy the Vantage collector as a sidecar of the proxy.
5. Restart the LiteLLM proxy.

For the environment variables and the steps in Vantage, refer to the [Vantage LiteLLM enrichment documentation](https://docs.vantage.sh/litellm_enrichment).

## Frequently asked questions

### Does this integration replace LiteLLM spend tracking?

No. LiteLLM continues to record the cost of each request and to apply your budgets. Vantage uses the LiteLLM usage data to divide the provider bill. You can use the two together.

### Why can the LiteLLM cost and the Vantage cost be different?

LiteLLM calculates each cost from its model cost map. Vantage uses the cost that the provider billed. For the procedure to find the cause of a difference, refer to [Debugging a cost discrepancy](/docs/troubleshoot/cost_discrepancy).

### Can Vantage stop a request when a team uses all of its budget?

No. Vantage is not in the request path. LiteLLM budgets stop requests. Vantage budgets and alerts use the usage data after the requests.

### When do the costs show?

LiteLLM records the cost when each request completes. Vantage shows the divided costs after the collector uploads the usage data and the provider sends its cost data.

### How is this integration different from the built-in LiteLLM `vantage` callback?

The built-in `vantage` callback sends the costs that LiteLLM calculates to a Vantage Custom Provider in FOCUS 1.2 format. Token Cost Allocation does not send a cost. It divides the costs from the provider bill. Do not use the two integrations for the same providers, because Vantage then counts these AI costs two times.

The two integrations read an environment variable with the name `VANTAGE_INTEGRATION_TOKEN`. The built-in callback uses the Custom Provider token. Token Cost Allocation uses the installation token. If you move from the built-in callback to Token Cost Allocation, replace the value of `VANTAGE_INTEGRATION_TOKEN` with the installation token.

### Which providers can each integration use?

The built-in `vantage` callback sends costs for each model that LiteLLM records spend for. Token Cost Allocation divides only the costs from providers that you connect to Vantage with a native cost integration.
