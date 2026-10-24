---
title: Veqen
description: Send LiteLLM usage to Veqen to track AI costs by customer and feature, reconcile provider charges and review budgets.
---

# Veqen

[Veqen](https://veqen-app.com) is a cost ledger for AI inference. The integration sends completed request metadata to Veqen so you can attribute costs, compare recorded usage with provider charges and inspect budgets.

## Setup

Create an ingest-only key in [Veqen Settings](https://veqen-app.com/app/settings/keys) and set `VEQEN_API_KEY` in your environment. Your model provider credentials remain separate.

For a LiteLLM version that includes the `veqen` integration, add it to your proxy configuration.

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["veqen"]
  turn_off_message_logging: true
```

Restart the proxy, make a request and inspect the recorded call in the [Veqen dashboard](https://veqen-app.com/app). The integration batches success and failure records to `https://veqen-app.com/v1/integrations/litellm`. An identical request ID and completion timestamp is deduplicated within the same Veqen organization.

## Content and attribution

Enable `turn_off_message_logging` before sending requests. It redacts model content from LiteLLM's standard logging payload. Arbitrary request metadata can still be transmitted, so do not put credentials or personal details in metadata. Veqen retains allowlisted cost fields and discards content fields at ingestion.

Veqen accepts attribution from `metadata.requester_metadata.veqen` or `metadata.veqen` in the standard logging payload. Supported tags are `customer`, `feature`, `user`, `project` and `environment`. Use pseudonymous identifiers. Check the exported payload for your LiteLLM version instead of assuming that every custom request metadata field is forwarded.

If you require a sender that copies only cost metadata, use the optional Python `VeqenLogger` instead.

```bash
pip install 'veqen[litellm]>=1.1.0'
```

```python
import litellm
import veqen
from veqen.integrations.litellm_logger import VeqenLogger

veqen.init()
litellm.callbacks = [VeqenLogger()]
```

Register one Veqen recording path per request. Combining the Python logger and the built-in HTTP integration can record the same request twice. The [Veqen LiteLLM guide](https://veqen-app.com/docs/litellm) shows how to use the Python logger in a proxy.

## Cost and budget behavior

Veqen prices known models from its price book or configured custom prices. Unknown models retain the reported cost when available. Proxy cache hits have no new provider charge and are recorded at zero cost. Cache reads and writes depend on the normalized usage details present in the export.

Recorded cost is not proof that it matches an invoice. Connect provider billing data in Veqen to reconcile the totals. This integration observes completed calls and does not stop a request before it runs. Pre-call blocking requires an enforcing integration in the application.
