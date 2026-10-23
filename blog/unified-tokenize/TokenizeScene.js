import React from "react";
import { clientRequest, providerExamples } from "./exampleData";
import styles from "./scene.module.css";

const example = providerExamples.vllm.response;

export default function TokenizeScene() {
  return (
    <figure
      className={styles.scene}
      aria-label="A prompt and its tokenization response"
    >
      <div className={styles.input}>
        <span className={styles.eyebrow}>YOU SEND</span>
        <div className={styles.prompt}>{clientRequest.prompt}</div>
        <div className={styles.inputFields}>
          <span>prompt</span>
          <span>model: "{clientRequest.model}"</span>
        </div>
        <div className={styles.endpoint}>
          <span>POST</span> /tokenize
        </div>
      </div>

      <svg
        className={styles.arrow}
        viewBox="0 0 80 32"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2 16h72m-12-12 12 12-12 12" />
      </svg>

      <div
        className={styles.output}
        aria-label="Illustrative tokenization response"
      >
        <div className={styles.outputTop}>
          <span className={styles.eyebrow}>YOU GET</span>
          <span className={styles.format}>response.json</span>
        </div>
        <div className={styles.result}>
          <div className={styles.tokenResult}>
            <span className={styles.field}>tokens</span>
            <div className={styles.tokens}>
              {example.tokens.map((token, index) => (
                <div className={styles.token} key={token}>
                  <span className={styles.piece}>{JSON.stringify(token)}</span>
                  <span className={styles.tokenId}>
                    <span>token_ids[{index}]</span>
                    <strong>{example.token_ids[index]}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.count}>
            <span className={styles.field}>count</span>
            <strong>{example.count}</strong>
            <span>tokens</span>
          </div>
        </div>
        <div className={styles.model}>
          <span>model</span>
          <span>"{example.model}"</span>
        </div>
      </div>
      <figcaption className={styles.caption}>
        Illustrative vLLM response. Your model determines the tokens and IDs.
        Watsonx uses the same fields with <code>token_ids: null</code>.
      </figcaption>
    </figure>
  );
}
