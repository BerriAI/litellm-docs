---
title: Shared Responsibility Model
description: What LiteLLM is responsible for and what you are responsible for when you self-host the gateway, and how to tell which side an issue falls on.
---

# Shared Responsibility Model

When you self-host LiteLLM, you run the software and we build it. That split decides who debugs what. This page states which problems we take on and which ones sit with you, so that a report reaches the team that can actually fix it.

The short version: we own the behavior of the product as documented on this site, and you own the environment it runs in plus any code you add to it.

| Area | Owner |
|---|---|
| Correctness of documented features and endpoints | LiteLLM |
| Memory leaks, hangs, and stability problems in the documented feature set | LiteLLM |
| Provider translation, cost tracking, and routing behavior as documented | LiteLLM |
| Security patches and the official Docker image and Helm chart | LiteLLM |
| Uptime of your instance and the infrastructure under it | You |
| Custom callbacks, custom guardrails, custom auth, and other code you inject | You |
| Deployments that diverge from our recommended path (your own Dockerfile, chart, or base image) | You |
| Postgres, Redis, Kubernetes, load balancers, networking, and autoscaling | You |
| Your provider accounts, quotas, and provider-side outages | You |

## What we are responsible for

We are responsible for the product working. Every feature documented on this site should behave as documented on a supported version; if it does not, that is a bug for us and you should [open an issue](https://github.com/BerriAI/litellm/issues) or raise it in your enterprise support channel.

That responsibility covers stability, not only correctness. Memory growth, file descriptor or connection leaks, deadlocks, hangs, and throughput regressions inside the documented feature set are ours to diagnose and fix. It also covers the interfaces you build against: the public HTTP surface is governed by the [API Stability Policy](./api_stability_policy.md), version numbering and what a patch or minor bump means by the [Release Cycle](./proxy/release_cycle.md), and beta features moving behind Enterprise by the [Migration Policy](./migration_policy.md). We maintain the official Docker image, Helm chart, and Terraform modules described in [Production Deployment](./proxy/deploy.md), and we ship security patches for the [supported version window](./enterprise.md#version-support).

We support the version lines listed in that window. On an end-of-life line the first step we will ask for is an upgrade, because a fix can only ship on a line that still receives releases.

## What you are responsible for

You are responsible for keeping your instance up, apart from stability defects in the application itself. That means capacity and sizing, restarts and rollouts, health checking and autoscaling, and the health of Postgres, Redis, your network, and your orchestrator. [Production Best Practices](./proxy/prod.md), [Database Sizing](./proxy/db_sizing.md), and [Redis Sizing](./proxy/redis_sizing.md) cover the settings and sizing we recommend; the [health endpoints](./proxy/health.md) are there for your probes.

You are also responsible for any code you run inside the gateway. [Custom callbacks](./observability/custom_callback.md), [custom guardrails](./proxy/guardrails/custom_guardrail.md), [custom auth](./proxy/custom_auth.md), [custom SSO](./proxy/custom_sso.md), [hooks](./proxy/call_hooks.md), and [plugins](./proxy/plugins.md) execute in the proxy process, so a blocking call, an unbounded cache, or a leaked client in that code shows up as proxy latency, memory growth, or a hang even though the proxy is behaving correctly. We will help you understand the hook contract and the payloads you receive; the logic inside your handler, and its performance and memory behavior, is yours. The same applies to anything you wrap around the gateway, including sidecars, proxies in front of it, and request-mutating middleware.

If you deploy outside our recommended path, that path is yours to maintain. Plenty of teams build their own image, write their own chart, change the base image or Python version, pin their own dependency set, or run their own process manager and worker counts. That is supported use of the software, and it also means a broken build, a missing system library, a mismatched dependency, an OOMKill from a container memory limit, or a misconfigured worker count is something you own. Our reference for what a known-good deployment looks like is [Production Deployment](./proxy/deploy.md), plus [Docker Quick Start](./proxy/docker_quick_start.md) and [Server Tuning](./proxy/server_tuning.md).

Your configuration and your provider accounts are yours as well: the model list and credentials, budgets and rate limits, routing and fallback choices, and provider-side quota, throttling, and outages. We will help you read the errors and pick the right settings, and we will fix the gateway if it mishandles a provider response.

## Deciding which side an issue is on

Before filing, reproduce the problem on a stock deployment. The test is the official image at a supported version, with your config stripped to the models involved, and every piece of custom code removed:

1. Run the official `ghcr.io/berriai/litellm` image at a supported tag, not a derived image.
2. Remove `callbacks`, `success_callback`, `failure_callback`, `guardrails`, `custom_auth`, and any plugin or hook entries from the config.
3. Reproduce with the smallest request that triggers the behavior. For suspected leaks or hangs, hold steady traffic and watch RSS over time rather than judging from a single spike.

If the problem persists there, it is ours; send us the reproduction. If it disappears, the cause is in your image, your infrastructure, or your custom code, and re-adding one piece at a time will find it. For memory and latency work in your own layer, [Pyroscope profiling](./proxy/pyroscope_profiling.md) and the [debug log levels](./proxy/debugging.md) show where time and allocations go.

## Filing an issue with us

A report we can act on has the LiteLLM version and how you deployed it, a redacted config, the exact request and the full error or traceback with [detailed debug logging](./proxy/debugging.md) enabled, and the result of the stock-deployment test above. For stability reports, include the memory or latency curve over time, the request rate, and the worker and container limits. Missing the version and the stock reproduction is what most often turns a one-day fix into a week of back and forth.

Open bugs and feature requests as [GitHub issues](https://github.com/BerriAI/litellm/issues). Enterprise customers can also use their dedicated support channel; see [Professional Support](./enterprise.md#professional-support) for hours and SLA options, and [Contact Us](./contact.md) for everything else.

## Related

- [Production Deployment](./proxy/deploy.md): the deployment paths we support and maintain.
- [Production Best Practices](./proxy/prod.md): configuration, sizing, Redis, and database checklist.
- [API Stability Policy](./api_stability_policy.md): which parts of the HTTP API are a contract.
- [Release Cycle](./proxy/release_cycle.md): versioning and what each bump means.
- [Enterprise](./enterprise.md): support channels, SLAs, and the supported version window.
