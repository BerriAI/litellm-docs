---
title: Shared Responsibility Model
description: What LiteLLM is responsible for and what you are responsible for when you self-host the gateway, and how to tell which side an issue falls on.
---

# Shared Responsibility Model

When you self-host LiteLLM, you run the software and we build it. That split decides who debugs what. Here, we describe which problems are our responsibility and which ones are yours, so that a report reaches the right team.

In a nutshell, we own the behavior of the product as documented on this site, and you own the environment it runs in + any code you add to it.

| Area                                                                                                                      | Owner   |
| ------------------------------------------------------------------------------------------------------------------------- | ------- |
| Correctness of documented features and endpoints                                                                          | LiteLLM |
| Memory leaks, hangs, and stability problems in the documented feature set                                                 | LiteLLM |
| Provider translation, cost tracking, and routing behavior as documented                                                   | LiteLLM |
| Security patches and the official Docker image and Helm chart                                                             | LiteLLM |
| Uptime of your instance and the infrastructure under it                                                                   | You     |
| Custom callbacks, custom guardrails, custom auth, and other code you inject                                               | You     |
| Infra issues due to deploying in a way that differs from our recommended path (your own Dockerfile, chart, or base image) | You     |
| Bugs introduced by your own patches on a fork not present in upstream                                                     | You     |
| Your provider accounts, quotas, and provider-side outages                                                                 | You     |

## What we are responsible for

We are responsible for the product working. Every feature documented on this site should behave as documented. If it does not, that is a bug for us and you should [open an issue](https://github.com/BerriAI/litellm/issues) or raise it in your enterprise support channel.

That responsibility covers stability, not only correctness. Memory growth, file descriptor or connection leaks, deadlocks, hangs, and throughput regressions within the documented feature set are our responsibility to diagnose and fix. This covers the interfaces you interact with: the public HTTP surface is governed by the [API Stability Policy](./api_stability_policy.md), version numbering and what a patch or minor bump means is documented in [Release Cycle](./proxy/release_cycle.md), and beta features moving behind Enterprise by the [Migration Policy](./migration_policy.md). We maintain the official Docker image, Helm chart, and Terraform modules described in [Production Deployment](./proxy/deploy.md), and we ship security patches for the [supported version window](./enterprise.md#version-support).

If you are on an end-of-life line, we recommend upgrading as a first step to ensure you have the latest bug fixes and security patches applied.

## What you are responsible for

You are responsible for keeping your instance up, apart from stability defects in the application itself. That means capacity and sizing, restarts and rollouts, health checking and autoscaling, and the health of Postgres, Redis, your network, and your orchestrator. [Production Best Practices](./proxy/prod.md), [Database Sizing](./proxy/db_sizing.md), and [Redis Sizing](./proxy/redis_sizing.md) cover the settings and sizing we recommend. The [health endpoints](./proxy/health.md) are there for your probes.

You are also responsible for any custom code you introduce to the gateway. [Custom callbacks](./observability/custom_callback.md), [custom guardrails](./proxy/guardrails/custom_guardrail.md), [custom auth](./proxy/custom_auth.md), [custom SSO](./proxy/custom_sso.md), [hooks](./proxy/call_hooks.md), and [plugins](./proxy/plugins.md) execute in the proxy process, so a blocking call, an unbounded cache, or a leaked client in that code can show up as proxy latency, memory growth, or a hang even when the proxy is behaving correctly. The logic of your handler, and its performance and memory behavior, is under your ownership. The same applies to anything you wrap around the gateway, including sidecars, proxies in front of it, and added middleware that mutates requests.

Running a fork is the same way. A bug that also reproduces on unmodified upstream at the same version is firmly within our responsibility to debug and fix. A bug your patches introduced is under your ownership, and so is keeping those patches working as you rebase onto newer releases. If you have patched around something because upstream lacked it, create an issue or send the patch as a pull request, and if it is a general improvement, we are happy to add it upstream.

Also, if your deployment strategy is not following our recommended path, that path is yours to maintain. Plenty of teams build their own image, write their own chart, change the base image or Python version, pin their own dependency set, or run their own process manager and worker counts. That is supported use of the software. It also means a broken build, a missing system library, a mismatched dependency, an OOMKill from a container memory limit, a misconfigured worker count, etc. is something you own. See:

- [Production Deployment](./proxy/deploy.md)
- [Docker Quick Start](./proxy/docker_quick_start.md)
- [Server Tuning](./proxy/server_tuning.md)

## Filing an issue with us

Please include:

1. The LiteLLM version
2. How you deployed it
3. A redacted config
4. The exact request
5. The full error or traceback with [detailed debug logging](./proxy/debugging.md) enabled
6. For stability reports, we recommend including the memory or latency curve over time, the request rate, and the worker and container limits
7. For memory and latency issues, we recommend including [Pyroscope profiling](./proxy/pyroscope_profiling.md) results

Open bugs and feature requests as [GitHub issues](https://github.com/BerriAI/litellm/issues). Enterprise customers can also use their dedicated support channel. See [Professional Support](./enterprise.md#professional-support) for hours and SLA options.
