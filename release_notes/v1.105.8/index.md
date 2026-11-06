---
title: "LiteLLM v1.105.8 adds Anthropic workload identity federation"
description: "Anthropic deployments can mint short-lived tokens through workload identity federation instead of storing an API key, configured in config.yaml, env vars, a named credential or the dashboard."
slug: "v1-105-8"
date: 2026-11-06T13:30:52
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
docker.litellm.ai/berriai/litellm:1.105.8
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.8
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.105.8`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.105.8) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Workload identity federation settings are now proxy-admin only, for OpenAI as well as Anthropic.** A team admin who could edit a team-scoped OpenAI deployment that uses federation now gets a 403 for that deployment, and a request body that carries a federation parameter such as `anthropic_federation_rule_id` is refused with a 401 instead of being forwarded. Set these values on the deployment or credential as a proxy admin. See [PR #44448](https://github.com/BerriAI/litellm/pull/44448).

:::

`v1.105.8` is a patch release on top of [`v1.105.7`](/release_notes/v1.105.7/v1-105-7). It brings Anthropic workload identity federation, first shipped in `v1.106.0`, to `stable/1.105.x`, so an Anthropic deployment can exchange an OIDC assertion for a short-lived access token instead of storing an API key. It also moves ddtrace, msgpack, oauthlib, pyasn1 and pypdf to their nearest patched releases. There are no new database migrations.

### What's Changed

- Anthropic: workload identity federation with short-lived tokens minted from an OIDC assertion (token file, env token, LiteLLM-signed issuer or Keycloak), set up through config, env vars or a named credential, plus `GET /credentials/{name}/jwks` - [PR #44448](https://github.com/BerriAI/litellm/pull/44448)
- Configure Anthropic workload identity federation from Add Credential, Edit Credential and Add Model, with federated credentials marked in the credentials table; Edit Credential now saves only the values the admin changed - [PR #44889](https://github.com/BerriAI/litellm/pull/44889)
- Fail a token-file or inline-token federation credential that is missing its rule or organization id with a 401 naming the missing id - [PR #45178](https://github.com/BerriAI/litellm/pull/45178)
- Configure OpenAI workload identity federation from LLM Credentials and Add Model, swapping API Key for Identity Provider ID, Service Account ID and Identity Token File - [PR #45528](https://github.com/BerriAI/litellm/pull/45528)
- Show the public JWKS for a LiteLLM-signed Anthropic credential in Edit Credential, ready to register on the federation rule - [PR #45527](https://github.com/BerriAI/litellm/pull/45527)
- Move ddtrace to 4.15.6, msgpack to 1.2.3, oauthlib to 4.0.1, pyasn1 to 0.6.5 and pypdf to 6.21.4

The changes and the version bump are backported in [PR #50447](https://github.com/BerriAI/litellm/pull/50447).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.7...v1.105.8
