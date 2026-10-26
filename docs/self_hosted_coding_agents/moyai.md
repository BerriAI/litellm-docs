---
title: Moyai
sidebar_label: Moyai
description: Run open source coding agents in your cloud, choose models through LiteLLM, and track each teammate's costs. See Moyai in action and set up your first task.
hide_title: true
hide_table_of_contents: true
---

import {MoyaiHero, BenefitGrid, GuideCards, SetupCallout} from '@site/src/components/Moyai';
import BugWorkflowDemo from '@site/blog/internal-devin-two-days/BugWorkflowDemo';
import Image from '@theme/IdealImage';
import styles from '@site/src/components/Moyai/styles.module.css';
import Heading from '@theme/Heading';

<MoyaiHero />

Moyai is an open source coding agent you run in your cloud. Delegate a bug fix or repository change from Slack or the browser, then review the pull request. Connect your LiteLLM gateway to choose models and track what each task costs.

<section className={styles.why} aria-labelledby="why-moyai">
  <Heading as="h2" id="why-moyai">Why Moyai</Heading>
  <BenefitGrid />
  <GuideCards />
  <p className={styles.setupRequirements}>Start with a Modal account and a LiteLLM gateway. The setup guide verifies a cloud task before you connect a repository.</p>
</section>

## Give Moyai a task from your browser {#start-in-the-browser}

Describe the change, choose an agent and model, and add repository context. Keep your team's sessions in one workspace alongside its skills and app connections.

<figure className={styles.spendFigure}>
  <Image
    img={require('../../img/moyai_task_composer.jpg')}
    alt="Moyai's browser workspace with a bug-fix prompt, agent and model selectors, connected apps, and recent sessions."
    style={{width: '100%', display: 'block'}}
  />
  <figcaption>The Moyai interface with an example prompt and sample workspace data. This screenshot shows task setup; it does not show a completed agent run.</figcaption>
</figure>

## Watch a task go from request to PR {#watch-a-task}

See a team ask Moyai to investigate a bug, run regression tests, and return a pull request to Slack. You can follow the work in the browser and send a correction in the same conversation.

<BugWorkflowDemo />

## See what each teammate spends {#see-agent-spend}

Use Moyai's spend dashboard to find the users, sessions, and models behind your model bill. Moyai records LiteLLM's reported charge for each tracked request, so you can trace a total back to the same cost data.

<figure className={styles.spendFigure}>
  <Image
    img={require('../../img/moyai_spend_users.jpg')}
    alt="Moyai's LLM spend by user table showing each teammate's recorded cost, session count, model requests, and share of team spend."
    style={{width: '100%', display: 'block'}}
  />
  <figcaption>Moyai's spend dashboard with sample data. Names and figures illustrate the interface; they are not LiteLLM's production usage or evidence for the savings estimate above.</figcaption>
</figure>

[Check a request against LiteLLM](./moyai/setup.md#track-spend). The [cost accounting guide](./moyai/architecture.md#cost-accounting) explains coverage and missing receipts. Cloud hosting and storage costs remain separate from these model charges.

## Start with a bug your team already knows {#put-moyai-to-work}

After the setup checks pass, connect one repository and give Moyai a small, reproducible issue:

> Reproduce this bug, add a regression test, fix it, and open a pull request. Include the failing test before the fix and the passing result afterward.

Review the diff and test output, then check the session's model cost in Moyai. Use that first result to decide which tasks to delegate next.

## Before you set it up {#prerequisites}

<div className={styles.questions}>
<details>
<summary>What do I need to get started?</summary>

A Modal account, a cloud-reachable LiteLLM gateway, and a virtual key for your chosen model. The [setup guide](./moyai/setup.md) walks through installation and a cloud task. Opening GitHub PRs also requires an organization-owned GitHub App; verify the first task before connecting a repository.

</details>
<details>
<summary>What will I pay for?</summary>

Model usage plus hosting, agent sandboxes, and storage. Your workload and model choices determine the bill. The $700/day figure is our team's estimate, not a starting price or a promise about your costs. Measure your own tasks before expanding the rollout.

</details>
<details>
<summary>What does my team maintain?</summary>

You manage the service, including deployments, updates, credentials, and backups. Moyai fits a trusted engineering team willing to operate its own cloud agent. The [architecture guide](./moyai/architecture.md) explains deployment choices, checkpoints, and recovery before you commit to running it.

</details>
<details>
<summary>Can I choose what the agent can access?</summary>

Select the apps and repositories in **Connections**. Enabled app tools can write under their connection policy without a per-use approval prompt. You review and merge GitHub PRs. Model requests go through your LiteLLM gateway to the provider you select, so account for that provider when deciding what code to share.

</details>
</div>

<SetupCallout />

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
