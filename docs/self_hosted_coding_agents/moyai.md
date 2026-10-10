---
title: Moyai
sidebar_label: Moyai
description: Run open source coding agents in your cloud, choose models through LiteLLM, and track each teammate's costs. See Moyai in action and set up your first task.
hide_title: true
hide_table_of_contents: true
---

import {MoyaiHero, CostComparison, BenefitGrid, GuideCards, SetupCallout} from '@site/src/components/Moyai';
import BugWorkflowDemo from '@site/blog/internal-devin-two-days/BugWorkflowDemo';
import Image from '@theme/IdealImage';
import styles from '@site/src/components/Moyai/styles.module.css';
import Heading from '@theme/Heading';

<MoyaiHero />

Our Devin bill reached $101,872 over 31 days. We wanted to choose the models behind that spend, delegate work while our laptops were closed, and see what each teammate spent.

Moyai is the cloud coding agent we built for that work. Give it a task from Slack or the browser, let it work in your cloud, and review the pull request.

<section className={styles.why} aria-labelledby="why-moyai">
  <Heading as="h2" id="why-moyai">What Moyai solves</Heading>
  <BenefitGrid />
  <GuideCards />
  <p className={styles.setupRequirements}>Start with a Modal account and a LiteLLM gateway. The setup guide verifies a cloud task before you connect a repository.</p>
</section>

## Reduce costs with your choice of agent and model {#cost-comparison}

<CostComparison />

[See supported agents and models](./moyai/setup.md#configure-litellm). Start with one task and measure its cost before expanding the rollout.

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
