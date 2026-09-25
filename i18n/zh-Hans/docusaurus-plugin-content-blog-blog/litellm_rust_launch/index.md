---
slug: litellm-rust-launch
title: "将 LiteLLM 迁移到 Rust - 构建最快、最轻量的 AI 网关"
date: 2026-06-22T09:00:00
authors:
  - ishaan
description: "LiteLLM 正在将其 AI 网关迁移到 Rust：吞吐量提升 15 倍，内存减少 11 倍，每次请求开销低于 1 毫秒。没有 v2，无需迁移，您的配置保持不变。"
keywords: [fastest ai gateway, fastest llm gateway, llm gateway, rust llm gateway, llm gateway benchmark, high throughput llm gateway, lightweight ai gateway, ai gateway latency, ai gateway memory, litellm performance, litellm rust, llm proxy overhead]
image: ./rust_migration_social_card.png
tags: [rust, rust-migration, ai-gateway, performance, benchmarks, reliability, engineering]
hide_table_of_contents: true
---

import { RustHeader, RustMigrationStages, RouteCadence, Stage1Architecture, RustServerSteps } from './diagrams';
import Head from '@docusaurus/Head';

<RustHeader />

*最后更新：2026 年 6 月*

在过去的一年里，我们从用户和社区那里听到了同样的声音：他们想要运行最快、最轻量的 AI 网关。我们听到了您的需求。我们正在通过将 LiteLLM 迁移到 Rust 来解决这个问题，并承诺提供一个开销低于 `1ms`、内存占用低于 `100MB` 的二进制文件供您部署。到本次迁移结束时，您将获得一个纯 Rust 服务器，能够处理您 100% 的 AI 流量，其中所有热路径操作，包括认证 (auth) 和速率限制 (rate limiting)，都将在 Rust 中运行。

:::tip[想帮助我们构建它吗？]

我们正在开放早期测试版，并希望直接与重视快速、轻量级网关的团队合作。如果您是其中一员，[请在此处注册](https://docs.google.com/forms/d/e/1FAIpQLSecWdOjkzjEson2UiZpDftOoZPs8RQbtlAM40KSvDXZqEgYaA/viewform?usp=dialog)，我们将让您在自己的技术栈中测试 Rust 网关，并与我们的团队直接沟通。

:::

重要原因：在实际负载下，CPU 和内存会随着并发量增加而攀升，Pod 会在最糟糕的时候被 OOM-killed。目前 LiteLLM Python 代理在负载下的内存峰值约为 `359MB`，这个成本会在您运行的每个 Pod、区域和重试中成倍增加。

我们已经在基准测试中看到了回报。Rust 网关的吞吐量约为 `15x`（每秒 `453` 到 `6,782` 个请求），内存占用减少约 `11x`（`359MB` 到 `32MB`），并且将每次请求的开销从 Python 路径上的约 `7.5ms` 降低到约 `0.05ms`，远低于我们承诺的 `1ms`。

## 您将获得什么 {#what-you-get}

您部署一个独立的 Rust 二进制文件。它大约占用 `65MB` 内存，网关开销保持在 `1ms` 以下，并且您的设置没有任何改变：相同的 `config.yaml`，相同的数据库，相同的客户端 API，相同的提供商。您将继续使用 LiteLLM 对 100 多个 LLM 提供商的覆盖，通过一个兼容 OpenAI 的 API，支持 `/chat/completions`、`/messages`、`/responses` 以及 LiteLLM 目前支持的所有其他 LLM 端点，现在它将是您可以自托管的最快、最轻量的 LLM 网关。

这不是 v2 版本，也不是重写。没有新的主要版本需要迁移，您也无需进行任何更改。热路径下的运行时变得更快、更轻量，而您的配置保持原样。

我们以谨慎的方式发布此版本。每个路由只有在通过我们完整的对等性和端到端测试套件后才会迁移到 Rust，并且在下一个路由开始之前，它必须在生产环境中运行。稳定性是首要任务，我们致力于在每次发布中实现零回归。

{/* truncate */}

## LiteLLM 网关有多快？吞吐量、开销和内存基准测试 {#how-fast-is-the-litellm-gateway-a-throughput-overhead-and-memory-benchmark}

**每次请求开销。** 我们构建了一个小型测试工具：一个模拟上游，一个轻量级 Rust 转发网关 (axum)，当前通过 LiteLLM 运行的相同转发路径（通过 uvicorn 的 `litellm.acompletion`），以及一个以微秒计时每个请求的负载客户端。在 `10` 个并发客户端针对同一模拟运行时，Rust 网关每次请求增加约 `0.05ms` 的开销；LiteLLM Python 路径增加约 `7.5ms`。这大约降低了 `150x`，远低于我们承诺的 `1ms`。

**持续负载。** 在 `50` 个并发客户端下，针对当前 LiteLLM Python 代理的相同 `/v1/responses` 工作负载，Rust 路径以约 `11x` 更少的内存提供了约 `15x` 的吞吐量。

![Rust vs Python gateway benchmark: overhead, throughput, and memory](./rust_vs_python_proxy_benchmark.png)

| | 每次请求开销 | 负载下的吞吐量 | 负载下的峰值内存 |
|---|---|---|---|
| **Rust 网关** | `~0.05ms` | `6,782` req/s | `31.7MB` |
| **LiteLLM (Python)** | `~7.5ms` | `453` req/s | `358.9MB` |

开销测试工具（模拟、网关、负载客户端）已与此文章一起提交到 [`benchmark/`](https://github.com/BerriAI/litellm-docs/tree/main/blog/litellm_rust_launch/benchmark) 下，汇总数据在 [`rust_proxy_benchmark_results.csv`](./rust_proxy_benchmark_results.csv) 中，因此您可以重现低于 `1ms` 的结果。这衡量的是网关转发路径（请求转换、转发、响应处理），而不是完整的生产工作负载。

## 保持不变的内容 {#what-stays-the-same}

您所依赖的一切都不会改变。从外部看，这次迁移是不可见的：

- 您的 Python SDK 保持完全相同的接口；相同的调用现在在底层通过 Rust 绑定运行。
- 您的 `config.yaml` 保持不变。
- 您的数据库和 schema 保持不变。
- 您的客户端 API 和请求/响应结构保持不变。
- 您的提供商、路由和密钥保持不变。

您将获得更低的内存占用和更低的开销，而无需做任何事情。

---

## 迁移如何运作 {#how-the-migration-works}

如果您只关心结果，上面已经说明了。本文的其余部分是为希望了解我们如何在不破坏任何东西的情况下将网关迁移到 Rust 的工程师准备的。

核心思想是清晰的分离。我们构建了一个只进行数据转换的 Rust 核心：它将您的请求转换为提供商请求，将提供商响应转换回来，转换流式输出块，计算 token，并规范化错误。它从不打开套接字、读取密钥或写入您的数据库。所有这些都由宿主进程完成。这种分离使我们能够在不重写服务器的情况下将 Rust 投入生产，因为 Python 继续执行 I/O，而 Rust 接管了转换工作。

<RustMigrationStages />

### 每次一个路由，在生产环境中验证 {#one-route-at-a-time-proven-in-production}

我们从不一次性切换整个端点。对于每个路由，我们首先验证一个提供商，然后将其推广到该路由上的所有提供商，之后才开始下一个路由。风险最小的路由优先。

<RouteCadence />

在第一阶段 (Stage 1)，服务器的形态不会改变。Python 仍然处理流量并执行 I/O，但通过一个由标志控制的绑定，将转换工作交给 Rust 核心，每个提供商独立进行。在任何提供商启用之前，对等性检查会强制执行相同的输出，如果标志关闭，则现有 Python 路径将保持不变地运行。

<Stage1Architecture />

路由按风险顺序移动：

- **首先是 OCR。** 从 Mistral OCR 开始，这是最小的表面积：无流式输出，微小模式，少量参数。一旦它在生产环境中与 Python 输出字节对字节匹配，就推广到所有 OCR 提供商，然后将路由移入 Rust 核心。在任何更大的端点迁移之前，集成风险在此处消除。
- **接下来是 `/v1/messages`。** 这增加了流式输出：SSE 解析、块发射、使用量核算、token 成本。先是一个提供商，然后是所有，再将路由移入 Rust。
- **之后是 `/chat/completions`。** 这是最大的表面积，仅在流式输出被证明可行后才进行：工具、函数调用、多模态以及完整的可选参数矩阵。
- **主要提供商。** Azure，然后是 Bedrock，然后是 Vertex，按流量大小排序。与认证耦合的提供商从主机获取签名头（先是 boto3 / google-auth，之后是原生 Rust）。长尾提供商继续在 Python 上运行。

### 迁移到 Rust 服务器 {#onto-a-rust-server}

一旦路由在 Rust 上运行，路由器也随之迁移：路由、回退 (fallback)、重试和冷却，状态存储在 Redis 中。然后服务器本身分两步迁移。

<RustServerSteps />

- **FastAPI 作为薄层外壳。** FastAPI 仍然终止 HTTP 并运行认证、速率限制和回调，但整个转发路径是对 Rust 的单次调用。
- **纯 Rust 服务器。** 原生服务器 (axum / hyper) 运行转发路径，热路径上没有 Python。您的自定义 Python 插件（认证、护栏 (guardrail)、回调、SSO）继续在可选的 sidecar 中工作，因此不会有任何破坏性变更。我们通过影子流量和按比例切换来推出它。

最终状态是纯 Rust 数据平面。客户的 Python 插件继续在 sidecar 中运行，因此它不是破坏性变更。完全移除 Python 将需要将插件移植到 Rust 或 WASM 接口，这是一个我们正在推迟的破坏性变更。

### 为何采用此顺序 {#why-this-order}

- OCR 路由在最小的表面积上消除了集成风险。
- `/v1/messages` 在最大的参数集之前消除了流式输出风险。
- `/chat/completions` 仅在流式输出被证明可行后才进行。
- 到服务器迁移时，核心、提供商和路由器已经通过 SDK 在生产环境中运行，因此服务器工作主要是管道连接。

每一步都在下一阶段开始之前交付给真实用户，并以一致性检查作为关卡。

## 时间线 {#timeline}

我们一次迁移一个函数，从小到大，并且只有在每一步都通过我们的测试套件后才进行。

| 目标 | 迁移到 Rust 的内容 |
|---|---|
| Aug 15, 2026 | `litellm.ocr()` 针对 Mistral，然后是所有 `litellm.ocr()`，然后是 `/ocr` 路由 |
| Sep 1, 2026 | `/messages` 采用相同模式，然后是 `/chat/completions` |
| Sep 15, 2026 | 路由器：负载均衡、回退、重试、冷却 |
| Dec 1, 2026 | 完整服务器：FastAPI 薄层外壳，然后是纯 Rust (axum) |

## 常见问题 {#frequently-asked-questions}

<Head>
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "Is LiteLLM the fastest LLM gateway?", "acceptedAnswer": {"@type": "Answer", "text": "That is the goal of this work. With the Rust hot path, LiteLLM targets sub-1ms gateway overhead and a sub-100MB binary, matching compiled-language gateways while keeping coverage of 100+ providers behind one OpenAI-compatible API. In our benchmark the Rust gateway adds about 0.05ms of overhead per request, versus about 7.5ms for the LiteLLM Python path today, and serves 6,782 requests per second under load at 31.7MB peak memory. Gateway overhead is usually a small fraction of total model latency and matters most for high-throughput, low-latency workloads like classification and embeddings at scale."}},
        {"@type": "Question", "name": "Is LiteLLM slow?", "acceptedAnswer": {"@type": "Answer", "text": "Gateway latency and throughput depend on how the proxy is deployed: worker count, concurrency, and whether logging callbacks run on the hot path. Tuned, the Python proxy serves production traffic across hundreds of providers. Moving the hot path to Rust pushes the floor lower: in a reproducible benchmark the Rust LiteLLM gateway adds about 0.05ms of overhead per request, versus about 7.5ms for the Python path, and serves 6,782 requests per second at 31.7MB peak memory."}},
        {"@type": "Question", "name": "Is LiteLLM limited by the Python GIL?", "acceptedAnswer": {"@type": "Answer", "text": "The GIL only affects CPU-bound work on the request path, and the gateway is mostly I/O. LiteLLM scales today by running multiple workers. The Rust migration moves request transforms, streaming, and routing into the Rust core and router, outside the GIL, with no first-party Python on the forwarding path in the end state."}},
        {"@type": "Question", "name": "How much memory does the LiteLLM gateway use?", "acceptedAnswer": {"@type": "Answer", "text": "The Python proxy peaked at 358.9MB of memory under load. The Rust end state targets roughly 65MB. Lower, bounded memory is the main reason for this work: it reduces the high-CPU and OOM failures seen under concurrent load."}},
        {"@type": "Question", "name": "Are the LiteLLM Rust benchmarks reproducible?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. The overhead harness (a mock upstream, a thin Rust gateway, and a load client that times each request in microseconds) is published with this post under benchmark/, along with the summarized CSV. The only variable between runs is Python versus Rust."}},
        {"@type": "Question", "name": "Will the LiteLLM Rust gateway be a breaking change?", "acceptedAnswer": {"@type": "Answer", "text": "No. It is not a v2 and not a rewrite. Config, database schema, and the client API contract stay the same. The runtime under the hot path changes gradually, route by route, behind passing parity and end-to-end tests."}}
      ]
    })}
  </script>
</Head>

### LiteLLM 是最快的 LLM 网关吗？ {#is-litellm-the-fastest-llm-gateway}

这是这项工作的目标。通过 Rust 热路径，LiteLLM 的目标是低于 `1ms` 的网关开销和低于 `100MB` 的二进制文件，与编译语言网关相匹配，同时在单个 OpenAI 兼容 API 后保持对 100 多个提供商的覆盖。在我们的基准测试中，Rust 网关每次请求增加约 `0.05ms` 的开销，而目前 LiteLLM Python 路径的开销约为 `7.5ms`，并在负载下每秒处理 `6,782` 个请求，峰值内存为 `31.7MB`。网关开销通常只占总模型延迟的一小部分，因此它对于大规模分类和嵌入等高吞吐量、低延迟工作负载最为重要。

### LiteLLM 慢吗？ {#is-litellm-slow}

网关延迟和吞吐量取决于您如何部署代理：工作进程数量、并发设置以及日志记录回调是否在热路径上运行。经过调优后，Python 代理目前为数百个提供商提供生产流量服务。将热路径迁移到 Rust 进一步降低了下限：在我们可复现的基准测试中，Rust 网关每次请求增加约 `0.05ms` 的开销，而 LiteLLM Python 路径的开销约为 `7.5ms`，并在峰值内存 `31.7MB` 下每秒处理 `6,782` 个请求。

### LiteLLM 受限于 Python GIL 吗？ {#is-litellm-limited-by-the-python-gil}

GIL 仅对请求路径上的 CPU 密集型工作有影响，而网关主要是 I/O 密集型。LiteLLM 目前通过运行多个工作进程进行扩展。Rust 迁移消除了热路径上的这个问题：请求转换、流式输出和路由在 Rust 核心和路由器中运行，不受 GIL 影响，最终状态下转发路径上没有第一方 Python 代码。

### LiteLLM 网关使用多少内存？ {#how-much-memory-does-the-litellm-gateway-use}

在我们的负载测试中，Python 代理的峰值内存为 `358.9MB`。Rust 最终状态的目标是大约 `65MB`。更低、有界内存是这项工作的主要原因：它减少了并发负载下出现的高 CPU 和 OOM 故障。

### 这些基准测试可复现吗？ {#are-these-benchmarks-reproducible}

是的。开销测试工具（一个模拟上游、一个轻量级 Rust 网关和一个以微秒为单位计时每个请求的负载客户端）已提交到 [`benchmark/`](https://github.com/BerriAI/litellm-docs/tree/main/blog/litellm_rust_launch/benchmark) 目录下，并附有汇总的 CSV 文件。两个运行时使用相同的上游和负载；唯一的变量是 Python 与 Rust。

### Rust 网关会是破坏性变更吗？ {#will-the-rust-gateway-be-a-breaking-change}

不会。配置、数据库模式和客户端 API 契约保持不变。热路径下的运行时将逐步改变，路由逐路由地进行，并在通过一致性检查和端到端测试后进行。

## 我们正在招聘 Rust 工程师 {#we-are-hiring-rust-engineers}

我们正在与一个小团队一起构建此项目，并正在寻找希望在服务 100 多个提供商的 AI 网关热路径上工作的 Rust 工程师。如果这听起来像您，[请加入我们](https://jobs.ashbyhq.com/litellm/3f326076-7415-46a1-921e-8a1b1d6ee2b6)。

## 参考文献 {#references}

- [Datadog 如何将其静态分析器从 Java 迁移到 Rust](https://www.datadoghq.com/blog/engineering/how-we-migrated-our-static-analyzer-from-java-to-rust/)
- [GitGuardian 如何将其平台核心迁移到 Rust](https://blog.gitguardian.com/how-we-migrated-the-heart-of-our-platform-to-rust/)
- [LiteLLM AI 网关，完整功能概述](https://docs.litellm.ai/docs/simple_proxy)
- [跨 100 多个 LLM 提供商的负载均衡和路由](https://docs.litellm.ai/docs/routing)
