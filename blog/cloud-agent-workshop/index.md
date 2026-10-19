---
slug: cloud-agent-workshop
title: "Workshop: Build a self-hosted cloud agent."
date: 2026-10-13T18:00:00-04:00
authors:
  - ishaan
description: "Build a self-hosted cloud agent with the LiteLLM team. A two-week remote workshop, October 19–30, to build a working v0 and deploy an internal beta on your infrastructure."
image: /img/cloud-agent-workshop/social.png
tags: [agents, infrastructure, announcement]
hide_table_of_contents: true
custom_hero: true
---

import {WorkshopShell, WorkshopHero, AudienceTeams, Timeline, Milestone, Result, Closing} from './Workshop';
import {IntakeVisual, BuildVisual, BetaVisual, SupportVisual} from './MilestoneVisuals';
import styles from './styles.module.css';

<WorkshopShell>

<WorkshopHero />

</WorkshopShell>

{/* truncate */}

<WorkshopShell>

<section className={styles.section} id="audience" aria-labelledby="audience-title">

## Who the workshop is for {#audience-title}

Teams investing in a custom, self-hosted cloud agent platform. Build with LiteLLM engineers around your infrastructure and development workflows.

<AudienceTeams />

</section>

<section className={styles.section} id="program" aria-labelledby="program-title">

<p className={styles.eyebrow}>PROGRAM DETAILS</p>

## Timeline & milestones {#program-title}

From your first use case to an internal beta in two weeks. Here’s what we build together at each stage.

<Timeline>

<Milestone number="01" id="intake" stage="BEFORE WE BUILD" date="30 MINUTES" visual={<IntakeVisual />}>

### Scope your first use case.

We review your goals, what you’ve tried, and your providers, sandbox, and cloud setup. Together, we agree on scope, deployment timing, and success criteria.

<Result label="YOU LEAVE WITH">A build plan for your first use case.</Result>

</Milestone>

<Milestone number="02" id="week-one" stage="WEEK 1 · BUILD" date="OCTOBER 19–23" visual={<BuildVisual />}>

### Get a working cloud agent.

We connect your agent harness and sandbox to a web app and Slack. Your team can send it tasks and try the first workflow.

<Result label="WEEK-ONE TARGET">A working v0 you can interact with.</Result>

</Milestone>

<Milestone number="03" id="week-two" stage="WEEK 2 · DEPLOY" date="OCTOBER 26–30" visual={<BetaVisual />}>

### Run an internal beta.

We deploy to your cloud, run internal tasks, and review traces with your team. We improve the agent based on what you see.

<p className={styles.scopeNote}>Depending on scope: shared memory, additional harnesses such as Pi, and feedback and trace review tools.</p>

<Result label="WEEK-TWO TARGET">An internal beta on your infrastructure.</Result>

</Milestone>

<Milestone number="04" id="after" stage="AFTER THE WORKSHOP" date="FOR LITELLM USERS" visual={<SupportVisual />}>

### Keep improving with our team.

If you use LiteLLM, we continue working with you toward the success criteria from your intake call.

<Result label="CONTINUED SUPPORT">Help with your next improvements.</Result>

</Milestone>

</Timeline>

</section>

<Closing />

</WorkshopShell>
