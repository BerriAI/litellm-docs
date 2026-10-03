---
slug: laya-nimble-classifiers
title: "Laya and Nimble on LiteLLM Auto Router"
date: 2026-10-02T12:00:00
authors:
  - tin
description: "Use Laya or Bespoke Nimble to classify requests on your own infrastructure, then let LiteLLM Auto Router call the model configured for that tier."
image: ./cover.png
tags: [auto-router, product, ai-gateway]
hide_table_of_contents: false
---

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcSet={require('./cover.png').default} />
  <img src={require('./cover.gif').default} width="1200" height="630" alt="Choose Laya or Bespoke Nimble to classify a request, then let LiteLLM Auto Router send it to the model configured for the selected tier. Illustrated routing examples." />
</picture>

We've added **Laya and Bespoke Nimble as classifiers for LiteLLM Auto Router**. Run either on your own infrastructure, choose it in the dashboard, and route requests to the models you configure for each complexity tier. Both join Jev in the **OSS Classifier** selector.

Your application keeps calling one router model name through `/v1/chat/completions`.

{/* truncate */}

## Choose a model for each request

An agent might summarize a short email in one turn and debug a failure across several services in the next. You can send both to the same model, or define routing rules that reserve a larger model for the work that needs it.

Auto Router lets you map complexity tiers to your gateway's model deployments. With Laya or Nimble, you can also run the classifier that selects those tiers on your own infrastructure.

## Run the classifier where you run the gateway

[Laya](https://github.com/NandhaKishorM/laya) and [Bespoke Nimble](https://github.com/bespokelabsai/nimble) are decision models. For Auto Router, they choose from the supplied tiers. The completion model you assign to the selected tier generates the answer.

LiteLLM sends the request context and tier criteria to your classifier's `/v1/systemone` endpoint, reads its choice, and calls the corresponding model. You control the classifier endpoint, timeout, and fallback behavior. Self-hosting keeps the classification call on infrastructure you control; the selected completion model still receives the request.

For example, you can map `SIMPLE` and `MEDIUM` to a smaller model, and `COMPLEX` and `REASONING` to a larger one. Evaluate those choices on your own prompts before changing production traffic: routing quality and total cost depend on your classifier, model pool, and workload.

## Configure it in the dashboard

Set `LAYA_API_BASE` or `BESPOKE_API_BASE` on the gateway to your classifier server's base URL. In **Models + Endpoints → Auto Router**, create or edit a router, select **OSS Classifier**, then choose **Laya** or **Bespoke Nimble**.

Choose the classifier model, assign your completion models to tiers, and use **Test Routing** to inspect the selected tier and model before saving. Built-in OSS classification is available without a LiteLLM license.

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
