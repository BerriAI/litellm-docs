---
title: Release Notes
sidebar_label: Overview
slug: /
---

# Release Notes

LiteLLM ships new releases regularly with new provider support, performance improvements, and enterprise features. Use the sidebar to browse all releases.

## Latest Release

### [v1.100.0: Access Group Budgets, Together AI Sync & Custom Router Tiers](/release_notes/v1.100.0/v1-100-0)

_September 6, 2026_

Model access groups can carry one shared budget enforced across every deployment in the group, tracked in a per-window spend table, settable from the dashboard, and with opt-in rollover of unused headroom; Together AI moves onto a dedicated config with `api.together.ai` as the default endpoint, `reasoning_effort` mapped per model class, cache-read pricing, and a daily sync that keeps the registry priced against the live serverless catalog; the complexity router's tier set becomes operator-defined end to end, with custom classifier tiers, a preview of the classifier prompt, heuristic-first chaining, a dry run on `/auto_router/test_routing`, and classifier cost counted in savings; the MCP gateway gains RFC 7662 `/introspect` for session tokens, RS256-signed session tokens, bulk import of Anthropic MCP connectors, and enforcement of toolsets attached to teams, organizations and users; Grounding with Bing Search arrives as a search provider alongside 242 new models, including `gemini-3.5-transcribe`, the xAI `grok-4.20` family, 24 Mistral entries, RunwayML `gen4.5` and the Seedance 2 family; and `GET /public/v1/model_hub` exposes a paginated public listing of the models the proxy serves. This stable also carries the Docker base image fix for glibc 2.44 that landed after the rc.1 cut.

---

## Recent Releases

| Version                             | Date         | Highlights                                                 |
| ----------------------------------- | ------------ | ---------------------------------------------------------- |
| [v1.100.0](/release_notes/v1.100.0/v1-100-0) | Sep 6, 2026  | Access group budgets, Together AI overhaul, custom auto-router tiers |
| [v1.99.0](/release_notes/v1.99.0/v1-99-0)   | Sep 1, 2026  | Dark mode, CLI OAuth login, end-to-end batch billing       |
| [v1.98.0](/release_notes/v1.98.0/v1-98-0)   | Aug 22, 2026 | Provisioned throughput billing, auto-router shadow evals, callable routing groups |
| [v1.97.0](/release_notes/v1.97.0/v1-97-0)   | Aug 15, 2026 | Tool-result guardrails, auto-router deployment affinity, admin viewer parity |
| [v1.96.0](/release_notes/v1.96.0/v1-96-0)   | Aug 9, 2026  | MCP entitlements, Redis config sync, auto-router context, GPT-5.6 price cut |
| [v1.95.0](/release_notes/v1.95.0/v1-95-0)   | Aug 1, 2026  | Claude Opus 5, MCP gateway DCR, Rust `/v1/messages`, SAML 2.0 SSO |
| [v1.94.0](/release_notes/v1.94.0/v1-94-0)   | Jul 28, 2026 | Router plugins & Auto-Router v2, MCP client-held credentials, shared DataTable UI |
| [v1.93.0](/release_notes/v1.93.0/v1-93-0)   | Jul 18, 2026 | GPT-5.6, client-forwarded MCP credentials, Meta Model API provider |
| [v1.92.0](/release_notes/v1.92.0/v1-92-0)   | Jul 11, 2026 | Claude Sonnet 5, production MCP OAuth (On-Behalf-Of) v2, Tencent & GDC providers |
| [v1.91.0](/release_notes/v1.91.0/v1-91-0)   | Jul 4, 2026  | MCP OAuth 2.0 v2 resolver, Rust OCR gateway, realtime performance |
| [v1.90.0](/release_notes/v1.90.0/v1-90-0)   | Jun 26, 2026 | Six new providers, OpenTelemetry v2 metrics parity, streaming-reliability sweep |
| [v1.89.0](/release_notes/v1.89.0/v1-89-0)   | Jun 10, 2026 | Claude Fable 5, A2A agent providers, MCP per-server controls |
| [v1.88.0](/release_notes/v1.88.0/v1-88-0)   | Jun 4, 2026  | Claude Opus 4.8, MCP access-group authorization, typed OpenTelemetry |
| [v1.87.0](/release_notes/v1.87.0/v1-87-0)   | May 23, 2026 | OCI Generative AI provider, Gemini 3.5 Flash day-0, MCP UI for OAuth servers |
| [v1.86.0](/release_notes/v1.86.0/v1-86-0)   | May 16, 2026 | Weighted-Routing Failover, native Anthropic web-search citations, OTel-standard server spans |
| [v1.85.1](/release_notes/v1.85.1/v1-85-1)   | May 20, 2026 | Patch — Gemini 3.5 Flash day-0 + cross-pod spend fix       |
| [v1.84.1](/release_notes/v1.84.1/v1-84-1)   | May 20, 2026 | Patch — Gemini 3.5 Flash day-0 + cross-pod spend fix       |
| [v1.85.0](/release_notes/v1.85.0/v1-85-0)   | May 16, 2026 | Realtime GA, MCP Gateway expansion & hardened multi-tenancy |
| [v1.84.0](/release_notes/v1.84.0/v1-84-0)   | May 14, 2026 | Reliability hardening + multi-pod budget accuracy          |
| [v1.83.14](/release_notes/v1.83.14/v1-83-14) | Apr 27, 2026 | GPT-5.5, Prompt Compression & Memory API                   |
| [v1.83.10](/release_notes/v1.83.10/v1-83-10) | Apr 27, 2026 | Claude Opus 4.7, Prompt Compression & Multi-Window Budgets |
| [v1.82.3](/release_notes/v1.82.3/v1-82-3)   | Mar 16, 2026 | Nebius AI, gpt-5.4, Gemini 3.x, FLUX Kontext, and 116 new models |
| [v1.82.0](/release_notes/v1.82.0/v1-82-0)   | Feb 28, 2026 | Realtime Guardrails, Projects Management, and 10+ Performance Optimizations |
| [v1.81.14](/release_notes/v1.81.14/v1-81-14) | Feb 21, 2026 | New Gateway Level Guardrails & Compliance Playground       |
| [v1.81.12](/release_notes/v1.81.12/v1-81-12) | Feb 14, 2026 | Guardrail Policy Templates & Action Builder                |
| [v1.81.9](/release_notes/v1.81.9/v1-81-9)   | Feb 7, 2026  | Control which MCP Servers are exposed on the Internet      |
| [v1.81.6](/release_notes/v1.81.6/v1-81-6)   | Jan 31, 2026 | Logs v2 with Tool Call Tracing                             |
| [v1.81.3](/release_notes/v1.81.3/v1-81-3)   | Jan 26, 2026 | Performance — 25% CPU Usage Reduction                      |
| [v1.81.0](/release_notes/v1.81.0/v1-81-0)          | Jan 18, 2026 | Claude Code — Web Search Across All Providers              |
| [v1.80.15](/release_notes/v1.80.15/v1-80-15)       | Jan 10, 2026 | Manus API Support                                          |
| [v1.80.8](/release_notes/v1.80.8-stable/v1-80-8)   | Dec 6, 2025  | Introducing A2A Agent Gateway                              |
| [v1.80.5](/release_notes/v1.80.5-stable/v1-80-5)   | Nov 22, 2025 | Gemini 3.0 Support                                         |
| [v1.80.0](/release_notes/v1.80.0-stable/v1-80-0)   | Nov 15, 2025 | Introducing Agent Hub: Register, Publish, and Share Agents |
| [v1.79.3](/release_notes/v1.79.3-stable/v1-79-3)   | Nov 8, 2025  | Built-in Guardrails on AI Gateway                          |
| [v1.79.0](/release_notes/v1.79.0-stable/v1-79-0)   | Oct 26, 2025 | Search APIs                                                |
| [v1.78.5](/release_notes/v1.78.5-stable/v1-78-5)   | Oct 18, 2025 | Native OCR Support                                         |
| [v1.78.0](/release_notes/v1.78.0-stable/v1-78-0)   | Oct 11, 2025 | MCP Gateway: Control Tool Access by Team, Key              |
| [v1.77.7](/release_notes/v1.77.7-stable/v1-77-7)   | Oct 4, 2025  | 2.9x Lower Median Latency                                  |
| [v1.77.5](/release_notes/v1.77.5-stable/v1-77-5)   | Sep 29, 2025 | MCP OAuth 2.0 Support                                      |
| [v1.77.3](/release_notes/v1.77.3-stable/v1-77-3)   | Sep 21, 2025 | Priority Based Rate Limiting                               |

---

## Stay Updated

- **GitHub**: Watch the [BerriAI/litellm](https://github.com/BerriAI/litellm) repository for release notifications
- **Discord**: Join our [community](https://discord.com/invite/wuPM9dRgDw) for announcements
- **Twitter**: Follow [@LiteLLM](https://twitter.com/LiteLLM)

Use the sidebar to browse the full release history.
