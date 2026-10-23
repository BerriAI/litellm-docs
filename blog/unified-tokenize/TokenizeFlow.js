import React from "react";
import styles from "./flow.module.css";

const clientRequest = JSON.stringify(
  { model: "tokenizer", prompt: "Hello world" },
  null,
  2,
);

const providers = {
  vllm: {
    name: "vLLM",
    modelPrefix: "hosted_vllm/",
    endpoint: "/tokenize",
    request: {
      model: "<configured model>",
      prompt: "Hello world",
      add_special_tokens: true,
      return_token_strs: true,
    },
    responseNote: "vLLM supplies token IDs. Token text is optional.",
  },
  watsonx: {
    name: "Watsonx",
    modelPrefix: "watsonx/",
    endpoint: "/ml/v1/text/tokenization?version=2024-03-13",
    request: {
      model_id: "<configured model>",
      input: "Hello world",
      project_id: "<project ID>",
      parameters: { return_tokens: true },
    },
    responseNote: "Watsonx supplies token text. token_ids is null.",
  },
};

function Connector() {
  return (
    <svg
      className={styles.connector}
      viewBox="0 0 40 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 10h31" strokeDasharray="1 5" />
      <path d="m28 5 5 5-5 5" />
    </svg>
  );
}

function GatewayGraphic() {
  return (
    <svg
      className={styles.gatewayGraphic}
      viewBox="0 0 180 112"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path
          d="m90 13 64 33-64 33-64-33 64-33Zm-64 46 64 33 64-33M26 72l64 33 64-33M26 46v26m64 7v26m64-59v26"
          strokeDasharray="0.1 5"
        />
        <path d="m66 45 24-12 24 12-24 12-24-12Z" />
        <path d="M90 57v13" />
      </g>
      <circle cx="90" cy="45" r="3" fill="currentColor" />
    </svg>
  );
}

/** @param {{provider: 'vllm' | 'watsonx', onProviderChange: (provider: 'vllm' | 'watsonx') => void}} props */
export default function TokenizeFlow({ provider, onProviderChange }) {
  const selected = providers[provider];

  return (
    <figure className={styles.flow}>
      <div className={styles.toolbar}>
        <span className={styles.eyebrow}>REQUEST FLOW / EXAMPLE</span>
        <div
          className={styles.switch}
          role="group"
          aria-label="Tokenization provider"
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

      <div className={styles.stages}>
        <div className={`${styles.node} ${styles.client}`}>
          <span className={styles.eyebrow}>01 / YOUR CLIENT</span>
          <div className={styles.endpoint}>
            <span>POST</span>
            <code>/tokenize</code>
          </div>
          <pre className={styles.request}>
            <code>{clientRequest}</code>
          </pre>
          <span className={styles.fixedLabel}>SAME REQUEST</span>
        </div>

        <Connector />

        <div className={`${styles.node} ${styles.gateway}`}>
          <span className={styles.eyebrow}>02 / LITELLM</span>
          <GatewayGraphic />
          <strong className={styles.gatewayTitle}>LiteLLM Gateway</strong>
          <p className={styles.gatewayDescription}>
            Resolve the model alias.
            <br />
            Translate the request.
            <br />
            Normalize the response.
          </p>
          <div className={styles.config}>
            <span className={styles.configLabel}>CONFIGURED TARGET</span>
            <code>tokenizer</code>
            <span className={styles.configArrow} aria-hidden="true">
              ↓
            </span>
            <code>
              {selected.modelPrefix}
              <span>&lt;model&gt;</span>
            </code>
          </div>
        </div>

        <Connector />

        <div className={`${styles.node} ${styles.provider}`}>
          <span className={styles.eyebrow}>
            03 / {selected.name.toUpperCase()}
          </span>
          <div className={styles.endpoint}>
            <span>POST</span>
            <code>{selected.endpoint}</code>
          </div>
          <pre className={styles.request}>
            <code>{JSON.stringify(selected.request, null, 2)}</code>
          </pre>
          <span className={styles.providerLabel}>PROVIDER REQUEST</span>
        </div>
      </div>

      <div className={styles.response}>
        <div className={styles.responseHeading}>
          <span className={styles.returnArrow} aria-hidden="true">
            ↳
          </span>
          <span className={styles.eyebrow}>COMMON RESPONSE FIELDS</span>
        </div>
        <dl className={styles.fields}>
          <div>
            <dt>model</dt>
            <dd>string</dd>
          </div>
          <div>
            <dt>count</dt>
            <dd>integer</dd>
          </div>
          <div>
            <dt>token_ids</dt>
            <dd>integer[] | null</dd>
          </div>
          <div>
            <dt>tokens</dt>
            <dd>string[] | null</dd>
          </div>
        </dl>
        <p className={styles.responseNote}>{selected.responseNote}</p>
      </div>

      <figcaption
        className={styles.caption}
        aria-live="polite"
        aria-atomic="true"
      >
        In this example, the model alias routes to {selected.name}. Your client
        sends the same request.
      </figcaption>
    </figure>
  );
}
