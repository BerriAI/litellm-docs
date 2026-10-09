---
title: Moyai
sidebar_label: Moyai
description: Give Moyai a coding task in Slack or your browser. Run it in your cloud, choose the harness and model through LiteLLM, and review the pull request.
hide_title: true
hide_table_of_contents: true
---

import {MoyaiHero, GuideCards, CostProof, ModelChoice, CloudWork, StartCard} from '@site/src/components/Moyai';
import BugWorkflowDemo from '@site/blog/internal-devin-two-days/BugWorkflowDemo';
import styles from '@site/src/components/Moyai/styles.module.css';
import Heading from '@theme/Heading';

<MoyaiHero />
<GuideCards />

<div className={styles.whyHeading}>
  <Heading as="h2" id="why-moyai">Why Moyai</Heading>
  <p>Spend less on coding agents. Choose how they work.</p>
</div>

<CostProof />
<ModelChoice />

<CloudWork>
<BugWorkflowDemo />
</CloudWork>

## Put Moyai to work

Start with a bounded change in a repository you know. Include the expected behavior and the checks you want the agent to run.

| Task | Example request | Review the result |
|---|---|---|
| Fix a bug | “Reproduce this issue, add a regression test, fix it, and open a PR.” | Reproduction, test output, and diff |
| Update a dependency | “Upgrade this package, address breaking changes, and run the affected tests.” | Lockfile, compatibility changes, and test results |
| Investigate a failure | “Read this failing CI job and identify the cause. Show the evidence before changing code.” | Logs, explanation, and proposed fix |

Connect only the apps and repositories the task needs. Enabled app tools can write under their connection policy without a per-use approval prompt. You control access in **Connections**, and GitHub PR approval and merging remain human steps.

<StartCard />

Moyai suits a trusted team willing to run its own service. You own updates, credentials, backups, and compute costs. Model requests still go to the provider you select; self-hosting does not keep those requests inside your cloud account.

Read the [architecture guide](./moyai/architecture.md) for the system diagram, checkpoint storage, and recovery behavior.

<details>
<summary>Looking for the previous gateway instructions?</summary>

<span id="how-moyai-uses-litellm" />
<span id="step-1-add-the-models" />
<span id="step-2-create-a-virtual-key-for-moyai" />
<span id="step-3-set-the-gateway-in-moyai" />
<span id="step-4-do-a-test-of-the-connection" />
<span id="track-spend" />
<span id="troubleshooting" />
<span id="more-information" />

The [gateway configuration](./moyai/setup.md#configure-litellm), [connection check](./moyai/setup.md#check-the-model-connection), [spend tracking](./moyai/setup.md#track-spend), and [troubleshooting](./moyai/setup.md#troubleshooting) now live in the setup guide.

</details>
