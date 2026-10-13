---
slug: internal-devin-two-days
title: "How we built our own internal Devin in 2 days"
date: 2026-10-03
authors:
  - tin
description: "How we built Moyai Devin with Render, Modal, Hermes, Temporal, and LiteLLM: durable sessions, parallel agents, Slack, and shared organization connections."
tags: [engineering, agents, infrastructure, slack]
image: ./hero.png
hide_table_of_contents: true
custom_hero: true
---

import MoyaiHero from './MoyaiHero';
import {PostByline} from '@theme/BlogPostPage';
import BugWorkflowDemo from './BugWorkflowDemo';

<MoyaiHero />

<PostByline horizontal />

At BerriAI, we built **Moyai Devin**, an internal engineering agent that runs in the cloud. Teammates can give it a task in Slack, follow its progress in a web app, and ask it to prepare a pull request.

{/* truncate */}

We wanted:

- **Cloud workspaces:** run code, tests, and a browser without using someone's laptop.
- **Shared organization connections:** access Slack, Linear, Notion, and GitHub.
- **Ongoing conversations:** continue a task across Slack and the web.
- **Parallel agents:** split independent work across several machines.
- **Model choice and spend tracking:** choose Astra or Opus and attribute usage to each teammate.

## What it looks like

<BugWorkflowDemo />

## 1. Main architecture

We split the system at the lifetime of a chat session. Render owns the conversation, permissions, and saved execution state. Temporal schedules the next step. Modal provides the computer where Hermes runs code and uses a browser.

![Moyai architecture: Slack and the web enter the Render application; Temporal coordinates sessions; Hermes executes in Modal sandboxes; the Render broker calls LiteLLM and connected applications.](./architecture.svg)

[Open the architecture diagram](./architecture.svg). Model requests and connected-app tools return through the Render broker. The sandbox receives a session capability; provider credentials stay on the server.

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

A Slack message follows this path: verify the request, find the session for that Slack thread, commit the message to the inbox, and wake its Temporal workflow. The worker loads the saved execution phase and starts or reconnects to the agent's Modal sandbox. We persist the answer before delivering it back to Slack and the web.

## 2. Main challenges

### Keeping work alive across deployments

Deploying a new version restarts Moyai on Render. The agent can keep working in its Modal sandbox while the app comes back online.

Each service has a role in recovery:

- **Temporal** keeps track of unfinished steps and retries them when a worker reconnects.
- **Render's database** keeps the chat, queued messages, and the details needed to find the running agent.
- **Modal** runs the agent and stores saved copies of its conversation history and files.

After a restart, the new Render worker reads the saved session and reconnects to Temporal. Temporal sends it the unfinished step. Moyai reconnects to the same sandbox and picks up the agent's progress. We record agent launches so a retry won't start a second copy.

![Recovery sequence: Temporal schedules an activity, Render launches a detached supervisor in Modal, Render restarts, and a retried activity reconnects to the same sandbox and reads its journal.](./recovery.svg)

[Open the recovery diagram](./recovery.svg). This path assumes the Modal sandbox survives the Render restart.

The workflow calls a bounded activity with the session ID. This excerpt comes from our `SessionWorkflow`; the surrounding loop waits for message signals and rolls over its history with Continue-As-New.

```python title="app/session_workflow.py · activity configuration"
busy = await workflow.execute_activity(
    "advance_session", run_id,
    start_to_close_timeout=timedelta(minutes=15),
    heartbeat_timeout=timedelta(seconds=30),
    retry_policy=RetryPolicy(
        initial_interval=timedelta(seconds=2),
        maximum_interval=timedelta(seconds=60),
    ),
)
```

The Render worker heartbeats every five seconds while it advances the session. If it stops heartbeating, Temporal can retry the activity on a replacement worker. We pass only the session ID and return small status values; prompts, credentials, and workspace files stay outside workflow history.

That retry boundary needed a second safeguard. Render could ask Modal to launch Hermes, lose the response, and retry the same request. We put the launch check inside a detached supervisor in the sandbox:

```python title="sandbox/durable_process.py · launch guard, excerpt"
with (directory / "lock").open("a") as lock:
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return  # Another supervisor still owns this execution.

    if (directory / "started.json").exists():
        return  # A previous launch may already have run tools.

    atomic(directory / "started.json", {"pid": os.getpid()})
    # Still holding the lock, start Hermes and journal its events.
```

Each execution segment has its own directory. Our `atomic` helper writes a temporary file, flushes it with `fsync`, and renames it into place. The supervisor holds the lock while Hermes runs, appends events to a journal, and saves the final result separately. After a disconnect, the replacement Render worker resumes reading at its saved journal offset.

The marker covers a different failure from the lock. A live supervisor holds the lock; a dead supervisor may leave only `started.json`. If we find a started marker without a live owner or confirmed result, we stop and report an interrupted execution. Starting over could repeat a tool that already changed an external system.

We save the conversation and files between tool rounds so we can restore them on a new sandbox. We also save the final answer before packaging files.

Retries need care: if creating a PR succeeds but its response gets lost, we check our publication records before trying again.

Temporal retries activities; it does not make external side effects exactly-once. A filesystem snapshot also excludes running processes and browser tabs. Losing the Render disk would lose our application records, so Temporal history cannot replace a database backup.

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

The subtle failure is acknowledging a Slack event before its message is durable. Slack might stop retrying even though we never queued the work. We save the receipt and user message in the same SQLite transaction. Here is the ordinary-message path, shortened after signature validation and thread-to-session lookup:

```python title="app/slack_chat.py · shortened message intake"
with self.store.connect() as conn:
    conn.execute("BEGIN IMMEDIATE")
    duplicate = conn.execute(
        """SELECT 1 FROM slack_receipts
           WHERE event_id=?
              OR (team_id=? AND channel=? AND message_ts=?)""",
        (event_id, team, channel, ts),
    ).fetchone()
    if duplicate:
        return None

    message, _ = self.store.enqueue_message_in(
        conn, run_id, prompt,
        "slack:" + digest(team + channel + ts),
        user_id=actor_id,
    )
    conn.execute(
        """INSERT INTO slack_receipts
           (event_id, team_id, channel, message_ts,
            user_id, run_id, message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (event_id, team, channel, ts, user, run_id, message["id"]),
    )
```

We deduplicate both the delivery ID and the physical Slack message, identified by team, channel, and timestamp. The receipt table also enforces those keys with database constraints. Thread replies resolve through a separate `(team_id, channel, thread_ts)` mapping, so a follow-up joins the existing session instead of creating another agent.

The workflow wake is a separate step after this commit. We retain pending wake requests until Temporal accepts them, and startup recovery scans the inbox for queued work. That covers a restart between saving the message and dispatching it.

Sending an answer has an ambiguity of its own: Slack can accept a post before our connection drops. We mark an outbox row as `sending` before the request, then `sent` after a confirmed response. A timeout leaves it `uncertain`; we keep the answer in the web session and avoid an automatic duplicate post. That trades automatic redelivery for a visible delivery failure the user can inspect.

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
