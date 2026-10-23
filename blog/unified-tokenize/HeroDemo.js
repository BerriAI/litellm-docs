import React from "react";
import CodeWindow from "./CodeWindow";
import ProviderLabel from "./ProviderLabel";
import { clientRequest, formatJson, providerExamples } from "./exampleData";
import styles from "./heroDemo.module.css";

/** @param {{provider: 'vllm' | 'watsonx', onProviderChange: (provider: 'vllm' | 'watsonx') => void}} props */
export default function HeroDemo({ provider, onProviderChange }) {
  const selected = providerExamples[provider];
  const request = { ...clientRequest, model: selected.modelName };

  return (
    <figure className={styles.demo} aria-label="Unified tokenize API example">
      <div className={styles.providers}>
        <span>Choose a model</span>
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
            <ProviderLabel provider="vllm" />
            <span className={styles.modelName}>
              {providerExamples.vllm.modelName}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={provider === "watsonx"}
            onClick={() => onProviderChange("watsonx")}
          >
            <ProviderLabel provider="watsonx" />
            <span className={styles.modelName}>
              {providerExamples.watsonx.modelName}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.stage}>
        <section className={styles.editor} aria-label="Client request">
          <div className={styles.panelHeading}>
            <span>Pass the model you want to tokenize for</span>
            <code>POST /tokenize</code>
          </div>
          <CodeWindow language="json" title="request.json">
            {formatJson(request)}
          </CodeWindow>
          <p className={styles.modelHint}>
            <code>model</code> matches <code>model_name</code> in your{" "}
            <a href="#setup">gateway config</a>. This request calls{" "}
            <strong>{selected.name}</strong>.
          </p>
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

      <figcaption className={styles.caption}>
        Change <code>model</code> to choose another configured model. Keep the
        same endpoint and JSON fields across providers.
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {selected.modelName} on {selected.name} selected. The request model is{" "}
          {selected.modelName}.
        </span>
      </figcaption>
    </figure>
  );
}
