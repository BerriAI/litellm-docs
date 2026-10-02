---
slug: internal-devin-two-days
title: "How we built our own internal Devin in 2 days"
date: 2026-10-01
authors:
  - tin
description: "How we built Moyai Devin with Render, Modal, Hermes, Temporal, and LiteLLM: durable sessions, parallel agents, Slack, and shared organization connections."
tags: [engineering, agents, infrastructure, slack]
image: ./hero.png
hide_table_of_contents: false
---

![Moyai Devin's web interface with a chat, five worker sessions in the sidebar, and tool activity.](./hero.png)

*The Moyai Devin interface, shown with an example session.*

At BerriAI, we built **Moyai Devin**, an internal engineering agent that runs in the cloud. Teammates can give it a task in Slack, follow its progress in a web app, and ask it to prepare a pull request.

{/* truncate */}

We wanted:

- **Cloud workspaces:** run code, tests, and a browser without using someone's laptop.
- **Shared organization connections:** access Slack, Linear, Notion, and GitHub.
- **Ongoing conversations:** continue a task across Slack and the web.
- **Parallel agents:** split independent work across several machines.
- **Model choice and spend tracking:** choose Astra or Opus and attribute usage to each teammate.

## 1. Main architecture

We used five services:

| Service | What we use it for |
|---|---|
| [Render](https://render.com) | Web app, Google SSO, application database, integration broker, and Temporal worker |
| [Modal](https://modal.com) | Cloud sandboxes with a terminal, filesystem, and Chromium |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | The agent loop: call the model, execute tools, and continue from their results |
| [Temporal Cloud](https://temporal.io) | Session orchestration, waiting, and recovery across interruptions |
| [LiteLLM](https://github.com/BerriAI/litellm) | Access to multiple models through one gateway, with request costs for accounting |

**Render hosts the application; Modal hosts the agent's computer.** That separation lets us provision execution environments as work arrives.

Each executing agent gets a sandbox. After a response, we save its workspace and keep the sandbox warm for five minutes. Follow-ups can reuse it; later messages restore a new machine from the checkpoint.

We run one shared Temporal worker on Render to coordinate sessions. We don't need a worker container for each agent.

For storage, we started with SQLite on Render's persistent disk. That keeps deployment simple, but multiple Render instances would require a shared database and artifact store.

## 2. Main challenges

### Keeping work alive across deployments

A deployment can interrupt the web process while an agent is working. We needed to recover the session without losing its answer or repeating completed actions.

We combined Temporal workflows with application records and Modal checkpoints:

- Save incoming messages before acknowledging them.
- Record execution phases and sandbox identifiers so a replacement worker can reconnect.
- Checkpoint conversation history and files at safe tool boundaries.
- Save the final answer before packaging workspace artifacts.

Temporal coordinates recovery. We still have to save the files, identify the running machine, and decide which operations are safe to retry.

External writes need particular care. If a PR creation request succeeds but its response gets lost, retrying without checking could create a duplicate. We use stable operation identifiers and publication records to reconcile those cases.

### Orchestrating parallel agents

We wanted to support requests such as: "Run 100 test cases across five agents."

Our coordinator:

1. Splits the work into five assignments.
2. Gives each worker an isolated copy of the workspace.
3. Saves its own state and releases its sandbox while waiting.
4. Resumes after the workers finish and collects their results.

We verified that flow with five workers handling 20 deterministic cases each. Users can open individual workers from the sidebar to inspect progress or continue their conversations.

Sandbox capacity follows demand. Executing agents and sessions within the idle window consume machines; a coordinator waiting for children does not.

We configured a ceiling of 100 sandboxes. Our five-worker test validates the orchestration, but a 100-agent load test remains separate work. Modal quotas and the server's model-request limit also constrain concurrency.

### Making Slack behave like a conversation

Slack took more work than receiving a mention and posting an answer.

We needed to:

- Read the discussion behind a request.
- Continue the same session through thread replies and DMs.
- Mirror web messages into the linked Slack thread.
- Handle duplicate events without starting duplicate work.
- Show working status and deliver answers to the correct conversation.

We used [AgentChat](https://github.com/BerriAI/agentchat) for normalized messages, conversation handling, replies, and working-status support.

Moyai adds persisted inbound and outbound message records, Slack signature verification, and web-session mirroring. AgentChat reduced the messaging code we had to build; we retained responsibility for durable delivery and permissions.

### Sharing access without handing credentials to agents

Teammates sign in through Google Workspace and use organization connections. Provider credentials stay on the trusted server, behind tools that check the current session's permissions.

For GitHub, Moyai can prepare and publish a normal PR after administrator approval. We expose no tools for approving or merging PRs.

We also added personal and organization skills, plus secure credential requests with explicit sharing choices. Users can reuse instructions and supported API keys without pasting secrets into conversations.

## 3. What's next, and what I'd recommend

Our next priorities are:

- **Billing recovery.** LiteLLM can bill a request whose final response never reaches Moyai. We track returned costs today; we're evaluating durable receipts to recover the missing ones.
- **Higher-concurrency testing.** Exercise larger worker groups, failure recovery, and resource limits before increasing usage.
- **Total cost visibility.** Combine model spend with Render, Modal, and Temporal charges.

If you're building something similar, start with one complete session: accept a message, execute the task, save the answer and workspace, then resume from a follow-up.

Test a deployment interruption, duplicate Slack event, and failed workspace save before adding more concurrency. Those tests expose the gaps that a successful single prompt won't catch.
