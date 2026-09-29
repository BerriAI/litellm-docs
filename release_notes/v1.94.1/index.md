---
title: "v1.94.1 - Team Key Budget Enforcement Reverted"
slug: "v1-94-1"
date: 2026-07-30T21:45:00
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
docker.litellm.ai/berriai/litellm:1.94.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.94.1
```

</TabItem>
</Tabs>

`v1.94.1` is a patch release on top of [`v1.94.0`](/release_notes/v1.94.0/v1-94-0). It reverts the change that made a user's personal `max_budget` apply to their team keys.

If you are on `v1.94.0`, upgrading to `v1.94.1` is recommended. Under `v1.94.0`, once a user's personal spend crossed their own `max_budget`, every request made with a team-scoped key belonging to that user was refused with `429 ExceededBudget`, even when the team had budget left. That check runs on management routes as well as LLM routes, and the Admin UI session token is itself team-scoped, so an affected user was also locked out of the dashboard: key lists, team lists, and most other panels returned `429` and the page rendered empty.

A team-scoped key is once again governed by the team and team-member budgets alone. A user's personal `max_budget` continues to apply to their personal keys, unchanged.

The `general_settings.skip_user_budget_on_team_key` flag that `v1.94.0` introduced as an opt-out is removed in this release. It existed only to switch the reverted behavior off, so it goes away with the behavior rather than remaining as a setting that does nothing. If you set it, remove it from your config; the hierarchy it restored is now the default.

### What's Changed

- revert(proxy): stop enforcing user budget on team keys - [PR #35271](https://github.com/BerriAI/litellm/pull/35271)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.94.0...v1.94.1
