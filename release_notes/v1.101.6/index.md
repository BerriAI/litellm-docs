---
title: "v1.101.6 - Codex Tools on the Responses to Chat Bridge"
slug: "v1-101-6"
date: 2026-10-08T07:46:30
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
docker.litellm.ai/berriai/litellm:1.101.6
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.6
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.6`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.6) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.101.6` is a patch release on top of [`v1.101.5`](/release_notes/v1.101.5/v1-101-5). It fixes Codex CLI tool calls on models served through the Responses to Chat Completions bridge. There are no new database migrations or breaking changes. The `v1.101.6` tag points at [`a501c70`](https://github.com/BerriAI/litellm/commit/a501c7002f576c516037971417a4df94b229c773)

## Codex tools on the Responses to Chat bridge

Codex CLI sends its tools inside an `additional_tools` input item instead of top-level `tools`. The [Responses API](../../docs/response_api) to Chat Completions bridge dropped that item, so bridged models such as Bedrock Converse never saw a tool and Codex could not run shell commands

- `additional_tools` input items are now hoisted into `tools` for every bridged provider, and [Bedrock Mantle](../../docs/providers/bedrock_mantle) reuses the same helper
- `custom` tools nested inside a `namespace`, such as Codex's `exec` shell tool, now convert to chat tools
- The model's call comes back to Codex as a `custom_tool_call`, the same way for streaming and non-streaming responses
- Guardrail edits after a custom tool's grammar block land on the tool instead of being applied twice

See the [Codex CLI setup guide](../../docs/proxy/client_setup/codex_cli)

### What's Changed

- Hoist Codex `additional_tools` input items into the chat bridge tools - [PR #40989](https://github.com/BerriAI/litellm/pull/40989), backported in [PR #45212](https://github.com/BerriAI/litellm/pull/45212)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.5...v1.101.6
