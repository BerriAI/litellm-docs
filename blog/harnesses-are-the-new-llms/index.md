---

slug:  harnesses-are-the-new-llms

title:  "Harnesses Are the New LLMs"

date:  2026-06-10T09:00:00

authors:

-  krrish

description:  "The same deployment pattern that emerged with LLMs — routing, fallbacks, observability, central billing — is now emerging with harnesses. Here's why the AI Gateway layer is moving up the stack."

tags: [ideas, harnesses, ai-gateway, agents, thesis]

hide_table_of_contents: true

---

import { StackComparison } from './diagrams';

*Last Updated: June 2026*

When we see harnesses today, we see the same stack being built, as the ones we saw for LLM's. This blog walks through some emerging patterns, and open problems that we see in the space. 

## What's new? 

Building agents today is no longer about just wrapping an LLM API call in a tool loop and pushing it to production. Claude Code and OpenClaw changed user expectations for how powerful AI could be, and how we'd want to interact with it ("I don't want to go to code, I just want to tell it what to do, and have it do the thing."). This has given rise to several coding harnesses which wrap the LLM API call with a tool loop, and handle scenarios like sub-agent spawning, memory, compaction, etc. increasing the robustness of agents and making them more useful for tasks. 

## What does this change?

The agents we're focusing on, our autonomous, long-running coding agents - the kind you can ask to file a PR to fix an issue. To run this agent, you pick a model + harness and deploy it somewhere. The harness also needs a sandbox, to check out the code, make changes and file a fix. Making harnesses reliable in production is hard. It involves sandbox orchestration, and optimizing the harness to handle concurrent requests (what happens if the container goes down mid-way through a request? how to hand off sessions? etc.). 

We're already seeing solutions ("Agent Runtimes") crop up that help simplify this - AgentCore, Gemini Agent Platform, Claude Managed Agents. Over time, similar to LLM's, we expect there to be a wide range of providers offering 'harness-as-a-service' API's (either proprietary - e.g. Claude Managed Agents, or wrapping open-source - e.g. [Bedrock Agent Core wrapping OpenCode](https://aws.amazon.com/blogs/machine-learning/its-safe-to-close-your-laptop-now-hosting-coding-agents-on-amazon-bedrock-agentcore/).

## The Stack of the Future

<StackComparison />

## Open Questions

This stack has 2 open questions:

- What does the VLLM of this world look like? 
- When will users want to go across multiple Agent Runtimes?

For #1, We think there's room for someone to build a high-throughput inference server, which works across the open-source coding harnesses, and optimizes them to achieve high scale (1k+ RPS). We've already published templates, for OpenCode, DeepAgents, and Hermes, for what that server needs to look like (ideally mapped to the Claude Managed Agents API spec). 

For #2, we see this control plane above the runtimes being very similar to how LiteLLM works today, and are building this as an experimental project with [LAP](https://github.com/LiteLLM-Labs/litellm-agent-platform). This is a Rust-based AI Gateway + Agent Control Plane, that allows users to build, register and invoke agents across multiple Agent Runtimes. 

We're already starting to see some users resonate with this problem - trying to use LAP as a control plane for agents being built in their company in different runtimes (e.g. Exposing an agent built on Elastic's Runtime, for analyzing Kibana logs to everyone via LAP). 

If you're company is facing similar problems, we'd love your feedback on LiteLLM Agent Platform - https://github.com/LiteLLM-Labs/litellm-agent-platform. 

## Frequently Asked Questions 

1. Is LiteLLM building a 2nd product? 

No. Our goal is to roll these learnings into the core LiteLLM offering over time. Building it separately, allows us to move quickly without impacting existing users. 

2. Is LAP ready for production? 

No. This is a pre-v0 project. The API's might change unexpectedly, as we work with users on this. If you want to contribute to this project, file an [issue](https://github.com/LiteLLM-Labs/litellm-agent-platform/issues) OR join our discord [here](https://discord.gg/Nkxw3rm3EE). 