---
slug: laya-nimble-classifiers
title: "Adding Self-hosted Laya & Nimble Classifiers"
date: 2026-10-02T12:00:00
authors:
  - tin
description: "Run the model that makes your routing decisions on your own infrastructure. LiteLLM Auto Router now supports self-hosted Laya and Bespoke Nimble classifiers."
image: ./cover.png
tags: [auto-router, product, ai-gateway]
hide_table_of_contents: false
---

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcSet={require('./cover.png').default} />
  <img src={require('./cover.gif').default} width="1200" height="630" alt="Laya and Nimble self-hosted classifiers: LiteLLM Auto Router sends classification to either model inside your infrastructure, then routes the request to the selected completion model." />
</picture>

You can now **run Auto Router's classifier on your own infrastructure**. Deploy a decision model alongside your gateway, let it choose a complexity tier for each request, and have LiteLLM call the completion model you assign to that tier.

We've added support for two self-hosted options, **Laya** and **Bespoke Nimble**. You control the classifier server, its capacity, and where it receives request context. Your application keeps calling one router model name through `/v1/chat/completions`.

{/* truncate */}

## Why self-host the classifier?

An agent might summarize a short email in one turn and debug a failure across several services in the next. With Auto Router, you can assign smaller models to simpler requests and larger models to more demanding work. A classifier makes that routing decision from the request context and your tier criteria.

Self-hosting gives you control over that classification call. You can deploy the classifier inside your network, choose the checkpoint you serve, and provision its inference capacity alongside your gateway. Your team operates the server and pays for its compute.

The selected completion model still receives the request to generate the answer. You can use hosted or self-hosted completion models; that choice is separate from where you run the classifier.

## How a request moves through the gateway

Your application sends a request to the Auto Router. LiteLLM sends the classification context and tier criteria to your classifier server, reads its chosen tier, then calls a completion model from that tier. You configure the timeout and the fallback to use if classification fails.

For example, you can map `SIMPLE` and `MEDIUM` to a smaller model, and `COMPLEX` and `REASONING` to a larger one. Use **Test Routing** to see the selected tier and model without making a completion call, then evaluate answer quality, latency, and total cost on your own prompts.

## Choose a self-hosted classifier

[Laya](https://github.com/NandhaKishorM/laya) and [Bespoke Nimble](https://github.com/bespokelabsai/nimble) are decision models that choose from supplied options. LiteLLM uses them to select a tier. Both expose the System One API through a server you deploy; Nimble also runs through Ollama's System One endpoint.

In the dashboard, both appear under **OSS Classifier**, alongside the existing hosted Jev option. The [configuration guide](/docs/auto_router/decision_classifiers) covers the supported checkpoints, server setup, credentials, and the request context sent for classification.

## Configure it in the dashboard

Set `LAYA_API_BASE` or `BESPOKE_API_BASE` on the gateway to your classifier server's base URL. In **Models + Endpoints → Auto Router**, create or edit a router, select **OSS Classifier**, then choose **Laya** or **Bespoke Nimble**.

Choose the classifier model, assign your completion models to tiers, test, and save the router. Built-in OSS classification is available without a LiteLLM license. Deploy and start the classifier server before selecting it in the dashboard.

You can also configure the same router in YAML. Inside `complexity_router_config`, select Laya with:

```yaml
classifier_type: oss_classifier
opensource_classifier_config:
  provider: laya
  model: english
  timeout_ms: 15000
```

For Nimble, use `provider: bespoke` and a model name your server supports: `nimble-latest`, `nimble` on Ollama, or `bespokelabs/Bespoke-Nimble-9B`.

The [configuration guide](/docs/auto_router/decision_classifiers) includes server setup, a complete router configuration, optional authentication, and a request you can send through the gateway.

## Get started

Deploy a gateway build containing the [Laya](https://github.com/BerriAI/litellm/pull/43626), [classifier dashboard](https://github.com/BerriAI/litellm/pull/43768), and [Nimble](https://github.com/BerriAI/litellm/pull/44246) changes. Follow the [Laya setup](/docs/auto_router/decision_classifiers#laya-self-hosted-http-server) or [Nimble setup](/docs/auto_router/decision_classifiers#nimble-self-hosted-system-one-server), then [test routing](/docs/auto_router/decision_classifiers#test-routing-and-send-a-request) with representative prompts.
