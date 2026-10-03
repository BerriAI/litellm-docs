---
slug: laya-nimble-classifiers
title: "Adding Self-hosted Auto Router Classifiers: Laya & Nimble"
date: 2026-10-02T12:00:00
authors:
  - tin
description: "Use Laya or Bespoke Nimble to classify Auto Router requests on your own infrastructure. Control where classification runs, which model you serve, and how you provision it."
image: ./cover.png
tags: [auto-router, product, ai-gateway]
hide_table_of_contents: false
---

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcSet={require('./cover.png').default} />
  <img src={require('./cover.gif').default} width="1200" height="630" alt="Laya and Nimble self-hosted classifiers: LiteLLM Auto Router sends classification to either model inside your infrastructure, then routes the request to the selected completion model." />
</picture>

LiteLLM Auto Router now supports **Laya** and **Bespoke Nimble** as self-hosted classifiers. Run either model on your infrastructure to choose which completion model handles each request. Your application keeps calling the same router endpoint.

{/* truncate */}

## Why self-host a classifier?

Customers have asked to keep classification local, avoid another hosted classifier vendor, and use clusters they already operate. Self-hosting gives you control over:

- **Prompt data.** Process classification context on servers you control, with your own access and logging policies.
- **Vendor dependencies.** Run the classifier without opening an account with a separate hosted classifier service.
- **Deployment location.** Choose the network and region where classification runs, including your existing private cluster.
- **Capacity and latency tuning.** Allocate compute for your traffic, keep the model warm, and place it near the gateway.
- **Model versions.** Choose the supported checkpoint you serve and decide when to roll out upgrades.
- **Compute costs.** Use your infrastructure budget and compare its cost against hosted inference on your workload.

You operate and pay for the classifier service. Measure latency, routing quality, and total cost on your own traffic with the [evaluation guide](/docs/auto_router/evaluate).

## How it works

1. Your application sends a request to the LiteLLM Auto Router.
2. Your self-hosted classifier chooses a complexity tier, such as `SIMPLE` or `COMPLEX`.
3. LiteLLM calls a completion model assigned to that tier to generate the answer.

The completion model still receives the request. You choose separately whether that model runs locally or through a hosted provider.

## Get started

Choose a classifier, deploy its server, and connect it to LiteLLM:

- **[Laya setup](/docs/auto_router/decision_classifiers#laya-self-hosted-http-server):** install and start Laya's HTTP server, choose a checkpoint, and configure authentication.
- **[Nimble setup](/docs/auto_router/decision_classifiers#nimble-self-hosted-system-one-server):** run Bespoke Nimble with Ollama or use a compatible System One deployment.

In **Models + Endpoints → Auto Router**, select **OSS Classifier**, choose your provider, and assign completion models to tiers. Use **Test Routing** to inspect the choice before sending completions.

The **[deployment and configuration guide](/docs/auto_router/decision_classifiers)** covers server checks, network access, credentials, dashboard setup, YAML configuration, and fallback behavior. Jev remains available as the hosted classifier option.
