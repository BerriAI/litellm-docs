---
title: "1.106.0rc3 - Prometheus project_alias label fix, Decision Model stream buffering"
slug: "v1-106-0-rc-3"
date: 2026-10-14T21:52:40
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.106.0-rc.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.0rc3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.0-rc.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.0-rc.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

The published GitHub tag is `v1.106.0-rc.3`. These notes compare it with `v1.106.0-rc.2`, the previous release candidate on `rc/1.106.0`. It is a small rc patch: two fixes were backported onto the rc branch and everything else is unchanged from `v1.106.0-rc.2`, whose [release notes](/release_notes/v1.106.0rc2/v1-106-0-rc-2) cover the previous patch. The [`v1.106.0-rc.1` release notes](/release_notes/v1.106.0rc1/v1-106-0-rc-1) cover the full 1.106 line against `v1.105.0`

## Key Highlights

- **Prometheus metrics for project keys**: proxies that set `custom_prometheus_metadata_labels: ["project_alias"]` record latency, request and deployment metrics for project keys again, and the project per-model rate limit gauges show up with a single `project_alias` label
- **Decision Model stream buffering**: `streaming_buffer_until_moderated: true` on a Decision Model guardrail now holds a streamed answer until the decision model passes it, so a blocked answer no longer starts streaming before the policy error

## AI Integrations

### Logging

#### [Prometheus](../../docs/proxy/prometheus#custom-metadata-labels)

- A `custom_prometheus_metadata_labels` entry whose name matches a label a metric already has is no longer added to that metric a second time. With `custom_prometheus_metadata_labels: ["project_alias"]`, the project per-model rate limit gauges added in `v1.106.0-rc.1` raised on every request from a project key with per-model limits, and the rest of the success event was skipped, so latency, `litellm_proxy_total_requests_metric_total` and deployment success metrics never counted those requests. They are counted again, and `litellm_project_model_rate_limit_allowed_metric` and `litellm_project_model_rate_limit_used_metric` carry one `project_alias` label. See [PR #46491](https://github.com/BerriAI/litellm/pull/46491), backport of [PR #46267](https://github.com/BerriAI/litellm/pull/46267)

### Guardrails

#### [Decision Model](../../docs/proxy/guardrails/decision_model#streaming-responses)

- `streaming_buffer_until_moderated: true` on a Decision Model guardrail now reaches the guardrail instead of being dropped at load. A streamed `post_call` answer is held until moderation finishes, so a blocked answer returns the policy error with no assistant content. Leaving the setting unset keeps the existing sampled streaming, and a value that is not a boolean now fails the guardrail at load. See [PR #46383](https://github.com/BerriAI/litellm/pull/46383), backport of [PR #46086](https://github.com/BerriAI/litellm/pull/46086)

### PR roll-up by ownership area

- Logging: 1
- Guardrails: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.0-rc.2...v1.106.0-rc.3
