---
title: "v1.97.1 - Dependency Refresh"
slug: "v1-97-1"
date: 2026-09-01T00:00:00
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

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.97.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.97.1
```

</TabItem>
</Tabs>

`v1.97.1` is a maintenance patch on top of [`v1.97.0`](/release_notes/v1.97.0/v1-97-0). It carries no product changes. Five third-party dependencies move to current releases, one Docker image's own pin catches up with them, and two expired scanner exemptions are removed.

On the Python side, `RestrictedPython` moves to 8.5, `sqlparse` to 0.6.0 and `pypdf` to 6.15.0, each the smallest step that keeps the release current. The `RestrictedPython` update also raises the `proxy` extra's floor to `>=8.5,<9.0`, matching the range used on the development branch, so a `pip install litellm[proxy]` resolves the same minimum the image does. If you pin `RestrictedPython` below 8.5 alongside `litellm[proxy]`, adjust that pin when you upgrade.

In the Admin UI's lockfile, `nanoid` moves to 3.3.18 and `browserslist` to 4.28.8. Neither is a direct dependency, so nothing in the dashboard's declared dependencies changes; `browserslist` brings its own build-data packages along with it. The dashboard was rebuilt against the new lockfile to confirm it is sound.

The `build_from_pip` Docker image pins `pypdf` outside the main lock and had been left behind at 6.7.5. It now installs 6.15.0, the same release the lock resolves. This image is a build variant and is not the published proxy image.

Two `pypdf` entries in `osv-scanner.toml` carry an `ignoreUntil` date that has already passed, so they no longer suppress anything. They are removed.

### What's Changed

- chore(deps): refresh stale dependency pins and cut 1.97.1 - [PR #39200](https://github.com/BerriAI/litellm/pull/39200)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.97.0...v1.97.1
