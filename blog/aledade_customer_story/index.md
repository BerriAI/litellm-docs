---
slug: aledade-customer-story
title: "How Aledade Runs Clinical AI Agents and 100+ Teams on LiteLLM"
date: 2026-10-08T10:00:00
authors: [misbah]
description: "Aledade made LiteLLM its LLM proxy before its teams used LLMs. More than 100 teams, 1,771 users, and clinical AI agents now operate through it."
tags: [customer-story, healthcare, ai-gateway]
hide_table_of_contents: false
---

import styles from './styles.module.css';

<p className={styles.deck}>More than 100 teams, 1,771 users, and clinical AI agents at Aledade operate through one LiteLLM gateway.</p>

Aledade is a value-based care platform for primary care organizations. It connects these organizations to thousands of data sources. It makes clinical information for each patient from that data.

{/* truncate */}

<hr className={styles.introRule} />

<div className={styles.stats}>
<div className={styles.card}>
<div className={styles.num}>100+</div>
<div className={styles.label}>teams on the gateway</div>
</div>
<div className={styles.card}>
<div className={styles.num}>1,771</div>
<div className={styles.label}>users</div>
</div>
<div className={styles.card}>
<div className={styles.num}>~5.4M</div>
<div className={styles.label}>requests completed in one week</div>
</div>
<div className={styles.card}>
<div className={styles.num}>&lt; 1 week</div>
<div className={styles.label}>usual time to add a new model</div>
</div>
</div>

## Before the first prototype

Before LiteLLM, Aledade sent LLM requests through an API that it made with FastAPI. Aledade selected LiteLLM as its LLM proxy before its teams used LLMs for prototypes or for production.

## What operates through LiteLLM

For internal work, Claude Code and Claude Desktop operate through LiteLLM. For external work, some AI agents do clinical tasks.

The low-latency overlay for the Electronic Health Record (EHR) also operates through LiteLLM. Aledade Assist is the name of this overlay. Aledade Assist stays minimized in the EHR of the practice. When an Aledade patient is on the screen, Aledade Assist shows clinical information in real time. This information includes patient summaries, suspected diagnoses, care gap alerts, and clinical decision support.

Source: [Aledade Assist and Clinical Insights](https://aledade.com/value-based-care-resources/case-studies/aledade-assist-and-clinical-insights).
