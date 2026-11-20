# ai-gateway-audit

[ai-gateway-audit](https://github.com/Mihirajmera/ai-gateway-audit) is an open-source configuration auditor for LiteLLM proxy deployments. It reads the `config.yaml`, `docker-compose.yml` and `.env` files that run the proxy and checks them against 11 controls, including provider keys written in plain text, a master key stored in the config, missing spend limits, admin UI and API docs exposure, and container images pinned by tag instead of digest. Secret values are redacted as they're read.

```bash
pip install ai-gateway-audit
ai-gateway-audit scan deploy/litellm --out audit
```

Each run writes a reviewer report, a findings CSV, SHA-256-hashed evidence files and OSCAL assessment results mapped to NIST 800-53. In CI, `--fail-on medium` exits with an error when an open finding is at or above that severity. Accepted risks can be recorded as exceptions with an owner and an expiry date.

- [GitHub](https://github.com/Mihirajmera/ai-gateway-audit)
- [Sample report](https://github.com/Mihirajmera/ai-gateway-audit/blob/main/sample-output/gateway-audit.md)
