import React, { useEffect, useState } from "react";
import styles from "./heroDemo.module.css";

import {
  clientRequest as request,
  providerExamples as providers,
} from "./exampleData";

/** @typedef {string | number | null | Array<string | number>} JsonValue */

/** @param {JsonValue} value */
function formatValue(value) {
  return Array.isArray(value)
    ? `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
    : JSON.stringify(value);
}

/** @param {Record<string, JsonValue>} value */
function formatJson(value) {
  const entries = Object.entries(value);
  const properties = entries.map(([key, item], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    return `  "${key}": ${formatValue(item)}${comma}`;
  });
  return `{\n${properties.join("\n")}\n}`;
}

/** @param {{value: JsonValue}} props */
function JsonToken({ value }) {
  if (Array.isArray(value)) {
    return (
      <>
        [
        {value.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && ", "}
            <JsonToken value={item} />
          </React.Fragment>
        ))}
        ]
      </>
    );
  }

  const tokenClass =
    value === null
      ? styles.nullValue
      : typeof value === "number"
        ? styles.number
        : styles.string;
  return <span className={tokenClass}>{JSON.stringify(value)}</span>;
}

/** @param {{value: Record<string, JsonValue>}} props */
function JsonCode({ value }) {
  const entries = Object.entries(value);
  return (
    <pre className={styles.codeBlock}>
      <code>
        {"{\n"}
        {entries.map(([key, item], index) => (
          <React.Fragment key={key}>
            {"  "}
            <span className={styles.key}>{JSON.stringify(key)}</span>
            {": "}
            <JsonToken value={item} />
            {index < entries.length - 1 ? ",\n" : "\n"}
          </React.Fragment>
        ))}
        {"}"}
      </code>
    </pre>
  );
}

/** @param {{text: string, label: string}} props */
function CopyButton({ text, label }) {
  const [status, setStatus] = useState("Copy");

  useEffect(() => {
    if (status === "Copy") return undefined;
    const timeout = setTimeout(() => setStatus("Copy"), 2200);
    return () => clearTimeout(timeout);
  }, [status]);

  async function copy() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setStatus("Unavailable");
        return;
      }
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Unavailable");
    }
  }

  return (
    <button
      type="button"
      className={styles.copy}
      aria-label={`${status === "Copy" ? "Copy" : status}: ${label}`}
      onClick={copy}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
        <path d="M10.5 5.5v-2A1 1 0 0 0 9.5 2.5h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
      </svg>
      <span aria-live="polite">{status}</span>
    </button>
  );
}

/** @param {{provider: 'vllm' | 'watsonx', onProviderChange: (provider: 'vllm' | 'watsonx') => void}} props */
export default function HeroDemo({ provider, onProviderChange }) {
  const selected = providers[provider];

  return (
    <figure className={styles.demo} aria-label="Unified tokenize API example">
      <div className={styles.toolbar}>
        <div className={styles.providers}>
          <span className={styles.toolbarLabel}>Supported providers</span>
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
        <span className={styles.exampleLabel}>Interactive example</span>
      </div>

      <div className={styles.console}>
        <div className={styles.editors}>
          <section className={styles.editor} aria-label="Client request">
            <div className={styles.filebar}>
              <span className={styles.filetab}>request.json</span>
              <CopyButton text={formatJson(request)} label="request JSON" />
            </div>
            <div className={styles.panelHeading}>
              <strong>Request</strong>
              <span className={styles.fixed}>Fixed client request</span>
            </div>
            <div className={styles.endpoint}>
              <span>POST</span>
              <code>/tokenize</code>
            </div>
            <JsonCode value={request} />
          </section>

          <section
            className={`${styles.editor} ${styles.response}`}
            aria-label={`${selected.name} example response`}
          >
            <div className={styles.filebar}>
              <span className={styles.filetab}>response.json</span>
              <CopyButton
                key={provider}
                text={formatJson(selected.response)}
                label="response JSON"
              />
            </div>
            <div className={styles.panelHeading}>
              <strong>Response</strong>
              <span className={styles.illustrative}>Illustrative response</span>
            </div>
            <div className={styles.responseFormat}>
              <span>{selected.name}</span>
              <span>application/json</span>
            </div>
            <div className={styles.changed} key={provider}>
              <JsonCode value={selected.response} />
            </div>
          </section>
        </div>

        <div className={styles.config}>
          <span className={styles.configTitle}>Gateway configuration</span>
          <div className={styles.configDetails}>
            <div className={styles.mapping}>
              <div className={styles.configValue}>
                <span>model_name</span>
                <code>tokenizer</code>
              </div>
              <svg
                className={styles.arrow}
                viewBox="0 0 36 20"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M2 10h30m-6-6 6 6-6 6" />
              </svg>
              <div className={styles.configValue}>
                <span>litellm_params.model</span>
                <code className={styles.changed} key={provider}>
                  {selected.target}
                </code>
              </div>
            </div>
            <span className={styles.guidance}>
              Switch providers above. Your client request stays the same.
            </span>
          </div>
        </div>
      </div>

      <figcaption className={styles.caption}>
        Example token values; your model determines the result.
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {selected.name} selected. The client request stays the same.
        </span>
      </figcaption>
    </figure>
  );
}
