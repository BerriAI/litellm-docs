import React from "react";
import VllmLogo from "../cache_aware_routing/animation/assets/vllm.svg";
import { providerExamples } from "./exampleData";
import styles from "./providerLabel.module.css";

/** @param {{provider: 'vllm' | 'watsonx'}} props */
export function ProviderLogo({ provider }) {
  return (
    <span className={styles.logo} aria-hidden="true">
      {provider === "vllm" ? (
        <VllmLogo focusable="false" />
      ) : (
        <img src="/img/integrations/ibm.png" alt="" width="32" height="32" />
      )}
    </span>
  );
}

/** @param {{provider: 'vllm' | 'watsonx'}} props */
export default function ProviderLabel({ provider }) {
  return (
    <span className={styles.label}>
      <ProviderLogo provider={provider} />
      <span>{providerExamples[provider].name}</span>
    </span>
  );
}
