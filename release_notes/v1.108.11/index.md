---
title: "LiteLLM v1.108.11 (LTS) fixes OOM on 429 retries and SSO behind TLS"
description: "The proxy refuses blocked and over-limit keys before it reads the request body, and SSO login works again behind TLS termination."
slug: "v1-108-11"
date: 2026-11-17T22:29:13
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

:::tip

`v1.108.11` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

:::

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.108.11
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.11
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.11`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.11) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.11` is a patch release on top of [`v1.108.10`](/release_notes/v1.108.10/v1-108-10). There are no new database migrations. The `v1.108.11` tag points at [`c50d78d`](https://github.com/BerriAI/litellm/commit/c50d78dfb2387d04c443d2ffec7a665e9c28f4fb).

:::danger Breaking Changes

- **Keys, teams and auth:** Have a proxy admin set `os.environ/` values on team models, since team admins now get 403 - [PR #51874](https://github.com/BerriAI/litellm/pull/51874)
- **Deployment:** Switch exec probes on the UI image from `curl` to `wget`, since that image no longer ships `curl` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)

:::

### What's Changed

- **Azure:** Fixed 400 when sending `reasoning_effort` to DeepSeek V4 Flash and Pro on `azure_ai` - [PR #52070](https://github.com/BerriAI/litellm/pull/52070)
- **AWS Bedrock:** Fixed `guarded_text` parts in system and assistant messages being dropped instead of checked by the guardrail - [PR #51776](https://github.com/BerriAI/litellm/pull/51776)
- **AWS Bedrock:** Fixed aborted Invoke streams on `/v1/messages` that kept generating billed output tokens upstream - [PR #52210](https://github.com/BerriAI/litellm/pull/52210)
- **Vertex AI and Gemini:** Fixed 500 when the chat history has an earlier tool call with null or truncated arguments - [PR #50020](https://github.com/BerriAI/litellm/pull/50020)
- **Vertex AI and Gemini:** Fixed 400 when sending `reasoning_effort: "xhigh"` to `gemini-4-hydrogen` - [PR #52060](https://github.com/BerriAI/litellm/pull/52060)
- **Other providers:** Fixed Cohere embeddings ignoring `COHERE_API_BASE` and always calling api.cohere.ai - [PR #52194](https://github.com/BerriAI/litellm/pull/52194)
- **Other providers:** Fixed OpenRouter streams sending an empty choice after `finish_reason: stop` that broke strict clients - [PR #52200](https://github.com/BerriAI/litellm/pull/52200)
- **Chat completions:** Fixed LiteLLM's own MCP and `fake_stream` params reaching provider request bodies and causing 400s - [PR #52225](https://github.com/BerriAI/litellm/pull/52225)
- **Responses API:** Fixed 500 on `/v1/responses` when `allowed_openai_params` is a string or tuple - [PR #52203](https://github.com/BerriAI/litellm/pull/52203)
- **Messages API:** Fixed streamed thinking blocks ending without `signature_delta`, so clients dropped them on the next tool step - [PR #52117](https://github.com/BerriAI/litellm/pull/52117)
- **Embeddings, images and audio:** Fixed custom image handlers not receiving `n`, `size`, `quality` and the other OpenAI image params - [PR #52051](https://github.com/BerriAI/litellm/pull/52051)
- **Keys, teams and auth:** Changed team model writes so only proxy admins can set `os.environ/` values, team admins now get 403 - [PR #51874](https://github.com/BerriAI/litellm/pull/51874)
- **Admin UI:** Fixed SSO login detouring through `/sso/key/generate/` and redirecting to `http://` behind TLS termination, broken since v1.108.0 - [PR #52213](https://github.com/BerriAI/litellm/pull/52213)
- **Deployment:** Changed the UI image to slim nginx, which drops `curl` but keeps `wget` and `nc` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)
- **SDK:** Fixed valid Messages and OCR requests with dict-subclass inputs failing when `LITELLM_RUST=true` - [PR #51812](https://github.com/BerriAI/litellm/pull/51812)
- **Performance:** Fixed proxy pods running out of memory when clients retry 429s with large request bodies - [PR #51428](https://github.com/BerriAI/litellm/pull/51428)
- **Other:** Added native `generateContent` support for custom providers registered in `custom_provider_map` - [PR #51083](https://github.com/BerriAI/litellm/pull/51083)

The changes are backported in [PR #51982](https://github.com/BerriAI/litellm/pull/51982), [PR #52074](https://github.com/BerriAI/litellm/pull/52074), [PR #52155](https://github.com/BerriAI/litellm/pull/52155), [PR #52201](https://github.com/BerriAI/litellm/pull/52201), [PR #52233](https://github.com/BerriAI/litellm/pull/52233), [PR #52248](https://github.com/BerriAI/litellm/pull/52248), [PR #52306](https://github.com/BerriAI/litellm/pull/52306) and [PR #52312](https://github.com/BerriAI/litellm/pull/52312).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.10...v1.108.11
