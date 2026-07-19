---
title: Release Notes
sidebar_label: Overview
slug: /
---

# Release Notes

LiteLLM ships new releases regularly with new provider support, performance improvements, and enterprise features. Use the sidebar to browse all releases.

## Latest Release

### [v1.93.0 — GPT-5.6, Client-Forwarded MCP Credentials & Meta Model API](/release_notes/v1.93.0/v1-93-0)

_July 18, 2026_

Day-0 pricing and metadata for OpenAI GPT-5.6 (`sol` / `terra` / `luna`) on OpenAI and Azure plus xAI Grok-4.5, OpenAI Realtime 2.1, and Google Cloud Chirp 3 speech-to-text; a new OpenAI-compatible Meta Model API provider serving `muse-spark-1.1` across Chat Completions, `/v1/messages`, and Responses; client-forwarded MCP credentials via `true_passthrough`, `oauth_delegate`, and a `dcr_bridge` sealed-envelope path with PKCE S256 enforced on both authorize arms; the shadcn / Base UI dashboard migration covering the shared DataTable, charts, and the full-height sidebar shell; and a smarter complexity auto router with keyword tier overrides, semantic keyword matching, and an optional LLM-based classifier.

---

## Recent Releases

| Version                             | Date         | Highlights                                                 |
| ----------------------------------- | ------------ | ---------------------------------------------------------- |
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
