---
title: "LiteLLM v1.104.4 fixes count_tokens, team batch access and guardrail settings"
description: "Anthropic-format token counts for OpenAI and Gemini models match inference, team keys can read their own batches, and the Add Guardrail wizard loads again."
slug: "v1-104-4"
date: 2026-10-20T02:26:46
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
docker.litellm.ai/berriai/litellm:1.104.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.104.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.104.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.104.4` is a patch release on top of [`v1.104.3`](/release_notes/v1.104.3/v1-104-3). It backports the token counting fixes, team-scoped batch access and an Admin UI guardrail settings fix onto `stable/1.104.x`. There are no new database migrations. The `v1.104.4` tag points at [`5346a40`](https://github.com/BerriAI/litellm/commit/5346a40c37a25b6e264c7b3783c5afb7d99ba456)

## Key Highlights

- **Token counting**: Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them, and count responses say where the number came from
- **Team batches**: team keys can read and cancel their own team's batches and download the finished results
- **Guardrail settings**: the Admin UI's Add Guardrail wizard lists its providers again

## LLM API Endpoints

#### Bugs

- **Token counting**
    - Anthropic-format count requests for OpenAI and Gemini models are converted the same way `/v1/messages` inference converts them
    - Count responses carry `litellm_count_source`, which is `provider`, `token_count_model` or `local_estimate`. When a provider count fails and local counting is on, the response is a local estimate labelled `local_estimate`
    - New `model_info` settings `token_count_framing` and `token_count_model` tune the count for one deployment. When a count model answers, the response also carries `litellm_count_model`
    - These fixes come from [PR #47389](https://github.com/BerriAI/litellm/pull/47389), with [PR #47446](https://github.com/BerriAI/litellm/pull/47446) and [PR #47454](https://github.com/BerriAI/litellm/pull/47454) keeping earlier Google `countTokens` request shapes and prompt plus messages inputs working as before

## Management Endpoints / UI

#### Bugs

- Team keys can read and cancel their own team's batches and download the finished results. The same model check applies to file, fine-tuning, vector store, character and video ids - [PR #47067](https://github.com/BerriAI/litellm/pull/47067)
- `GET /guardrails/ui/add_guardrail_settings` returned 500 on every call, so the Add Guardrail wizard in the Admin UI listed no providers. It loads again - [PR #45935](https://github.com/BerriAI/litellm/pull/45935)

The team batch fix is backported in [PR #47344](https://github.com/BerriAI/litellm/pull/47344)

### PR roll-up by ownership area

- LLM API Endpoints: 3
- Auth & Management: 1
- Guardrails: 1

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.3...v1.104.4
