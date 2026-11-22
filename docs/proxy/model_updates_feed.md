---
title: Subscribe to Model and Price Updates
description: Follow new models, price changes and deprecations from models.litellm.ai in Slack or any RSS reader, filtered to the providers and models you run.
---

# Subscribe to Model and Price Updates

{/* keep-version-note */}

[models.litellm.ai](https://models.litellm.ai/) publishes RSS feeds built from the [model cost map](./model_cost_map), so you can follow new models, price changes and deprecations in Slack or any RSS reader instead of checking the site. All feeds are public and need no account or key.

| Feed | URL | What it posts |
|---|---|---|
| Changelog | `https://models.litellm.ai/changelog.xml` | Every price, new model, new provider, capability and deprecation change to the cost map, with a link to the commit |
| New models | `https://models.litellm.ai/new-models.xml` | The latest 50 models added to the cost map, with their prices |
| Deprecations | `https://models.litellm.ai/deprecated-models.xml` | Provider model deprecations on their effective date |
| Upcoming deprecations | `https://models.litellm.ai/deprecated-models.xml?days=30` | Deprecations taking effect from today through the next 30 days (UTC); any whole number from 0 to 180 works |

## Build a feed for the models you run

The quickest way to get a filtered feed is the builder on the changelog page.

1. Open [models.litellm.ai/changelog](https://models.litellm.ai/changelog) and expand **Build a feed for the models you run**.
2. Under **Post**, pick how often the feed posts (every change, one post per catalog commit, or every 30 minutes, hour, 4 hours or day), then tick the change types you care about, such as prices and deprecations. Leave them all unticked to get the highlights.
3. Tick a provider to follow everything on it, or click the provider's name and tick only the models you use. Use the **Government clouds** checkboxes to follow only Bedrock GovCloud or Azure Government listings.
4. Click **Copy URL** for an RSS reader, or **Copy Slack command** for Slack.

The chips under the provider list show what you follow and how many posts the feed would have sent in the last 30 days, so you can check the volume before you subscribe.

## Subscribe a Slack channel

Slack reads feeds through its RSS app ([Slack's guide](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)). Add the app to your workspace once, then run the command from the builder in the channel that should get the posts:

```text
/feed subscribe https://models.litellm.ai/changelog.xml?digest=1h
```

Use a `digest` feed for Slack. Without it the changelog posts one message per change, and a single catalog update can touch hundreds of models. `?digest=1h` posts one message per hour with every change in that hour, and `?digest=commit` posts one message per cost map commit. Run `/feed list` in the channel to see its subscriptions and `/feed remove <id>` to stop one.

## Subscribe in an RSS reader

Paste any feed URL from the table above, or the URL from the builder, into your reader's add feed or subscribe dialog. Feedly, Inoreader, NetNewsWire, Thunderbird and other readers that support RSS 2.0 all work. Item IDs stay the same across site rebuilds, so a reader does not show the same change twice.

## Filter the changelog feed by hand

The builder writes these query parameters, and you can also add them to `changelog.xml` yourself.

| Parameter | Example | Effect |
|---|---|---|
| `kind` | `?kind=price,deprecation` | Only these change types, instead of the default highlights: `price`, `model`, `provider`, `capability`, `deprecation`, `metadata` |
| `all` | `?all=anthropic,bedrock` | Every change on these providers, by their LiteLLM provider id |
| `models` | `?models=openai:gpt-5.1,claude-opus-4-5` | Only these models; `provider:model` limits a model to one provider, a bare model name follows it on every provider |
| `cloud` | `?cloud=bedrock-gov,azure-gov` | Only GovCloud listings on Bedrock and Azure |
| `digest` | `?digest=1h` | One item per window (`30m`, `1h`, `4h`, `1d`) or per commit (`commit`) instead of one per change |

`all` and `models` add up, so `?all=anthropic&models=openai:gpt-5.1` follows everything on Anthropic plus GPT-5.1 on OpenAI. `kind` and `cloud` narrow that result, so `?all=bedrock&kind=price&digest=1d` is a daily summary of Bedrock price changes. Open `https://models.litellm.ai/changelog` with the same parameters to see the builder prefilled with that feed.
