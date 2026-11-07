import React from "react";
import styles from "./architecture.module.css";

const providers = [
  { name: "OpenAI", logo: "/img/providers/openai_small.svg" },
  { name: "Anthropic", logo: "/img/providers/anthropic.svg" },
  { name: "Google", logo: "/img/providers/google.svg" },
  { name: "Mistral", logo: "/img/providers/mistral.svg" },
];

const serverCode = `draft = llm(...)
data = prepare(draft)
reply = llm(data)`;

const sdkCode = `Workflow(
    name="email-reply",
    nodes=[
        ChatCompletion(...),
        Python(fn=prepare),
        ChatCompletion(...),
    ],
)`;

function Providers() {
  return (
    <div className={styles.providers} aria-label="LLM providers">
      {providers.map(({ name, logo }) => (
        <div className={styles.provider} key={name}>
          <img src={logo} alt={name} width="36" height="36" loading="lazy" />
          <span aria-hidden="true">{name}</span>
        </div>
      ))}
    </div>
  );
}

function Connection({ label }) {
  return (
    <div className={styles.connection}>
      <span>{label}</span>
      <svg viewBox="0 0 56 24" fill="none" aria-hidden="true">
        <path d="M2 12h50m-6-5 6 5-6 5" />
      </svg>
    </div>
  );
}

function Gateway({ workflow = false }) {
  return (
    <div className={styles.gateway}>
      <span className={styles.processLabel}>EXISTING GATEWAY PROCESS</span>
      <span className={styles.nodeTitle}>LiteLLM Gateway</span>
      {workflow && (
        <div className={styles.savedWorkflow}>
          <span>Saved workflow definition</span>
          <span>LLM orchestration</span>
        </div>
      )}
      <Providers />
    </div>
  );
}

function MontyWorker() {
  return (
    <>
      <div className={styles.workerConnection}>
        <span>Python execution</span>
        <svg viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <path d="M17 1v40m-5-6 5 6 5-6M39 41V1m-5 6 5-6 5 6" />
        </svg>
      </div>
      <div className={styles.worker}>
        <span className={styles.processLabel}>SEPARATE WORKER PROCESS</span>
        <span className={styles.nodeTitle}>Monty sandbox</span>
        <span className={styles.workerDetail}>Restricted interpreter · resource-limited</span>
      </div>
    </>
  );
}

export function BeforeWorkflow() {
  return (
    <figure className={styles.diagram} aria-label="Before: define and run glue code on a separate workflow server">
        <div className={styles.figureLabel}>Before</div>
        <div className={styles.flow}>
          <div className={styles.server}>
            <span className={styles.processLabel}>WORKFLOW SERVER</span>
            <span className={styles.nodeTitle}>Workflow definition</span>
            <div className={styles.codeExcerpt}><pre><code>{serverCode}</code></pre></div>
            <span className={styles.maintenance}>Deploy &amp; maintain</span>
          </div>
          <Connection label="Calls" />
          <Gateway />
        </div>
        <figcaption>
          Three lines of glue code still mean a workflow server to deploy and maintain.
        </figcaption>
    </figure>
  );
}

export function GatewayWorkflow() {
  return (
    <figure className={styles.diagram} aria-label="With Liteflow: define the workflow in Python and register it on the gateway">
        <div className={styles.figureLabel}>With Liteflow</div>
        <div className={`${styles.flow} ${styles.afterFlow}`}>
          <div className={styles.sdkDefinition}>
            <span className={styles.nodeTitle}>Define in Python</span>
            <div className={styles.codeExcerpt}><pre><code>{sdkCode}</code></pre></div>
          </div>
          <Connection label="Register" />
          <div className={styles.executionSide}>
            <Gateway workflow />
            <MontyWorker />
          </div>
        </div>
        <figcaption>
          Register the definition on your existing gateway; Python executes in a separate Monty worker process.
        </figcaption>
    </figure>
  );
}
