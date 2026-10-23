import React from "react";
import CodeWindow from "./CodeWindow";
import { clientRequest, providerExamples } from "./exampleData";
import styles from "./heroDemo.module.css";

/** @param {Record<string, string | number | null | Array<string | number>>} value */
function formatJson(value) {
  const entries = Object.entries(value);
  const properties = entries.map(([key, item], index) => {
    const formatted = Array.isArray(item)
      ? `[${item.map((token) => JSON.stringify(token)).join(", ")}]`
      : JSON.stringify(item);
    return `  "${key}": ${formatted}${index < entries.length - 1 ? "," : ""}`;
  });
  return `{\n${properties.join("\n")}\n}`;
}

/** @param {{provider: 'vllm' | 'watsonx', onProviderChange: (provider: 'vllm' | 'watsonx') => void}} props */
export default function HeroDemo({ provider, onProviderChange }) {
  const selected = providerExamples[provider];

  return (
    <figure className={styles.demo} aria-label="Unified tokenize API example">
      <div className={styles.providers}>
        <span>Switch provider</span>
        <div
          className={styles.selector}
          role="group"
          aria-label="Supported tokenization providers"
        >
          <button
            type="button"
            aria-pressed={provider === "vllm"}
            onClick={() => onProviderChange("vllm")}
          >
            vLLM
          </button>
          <button
            type="button"
            aria-pressed={provider === "watsonx"}
            onClick={() => onProviderChange("watsonx")}
          >
            Watsonx
          </button>
        </div>
      </div>

      <div className={styles.stage}>
        <section className={styles.editor} aria-label="Client request">
          <div className={styles.panelHeading}>
            <span>Same client request</span>
            <code>POST /tokenize</code>
          </div>
          <CodeWindow language="json" title="request.json">
            {formatJson(clientRequest)}
          </CodeWindow>
        </section>
        <section
          className={styles.editor}
          aria-label={`${selected.name} example response`}
        >
          <div className={styles.panelHeading}>
            <span>{selected.name} response</span>
            <span>Illustrative output</span>
          </div>
          <CodeWindow key={provider} language="json" title="response.json">
            {formatJson(selected.response)}
          </CodeWindow>
        </section>
      </div>

      <div className={styles.mapping}>
        <span>Gateway target</span>
        <code>{clientRequest.model}</code>
        <svg viewBox="0 0 28 16" aria-hidden="true" focusable="false">
          <path d="M1 8h24m-5-5 5 5-5 5" />
        </svg>
        <code>{selected.target}</code>
      </div>

      <figcaption className={styles.caption}>
        Your client keeps the same request. Your model determines the token
        values.
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {selected.name} selected. The client request stays the same.
        </span>
      </figcaption>
    </figure>
  );
}
