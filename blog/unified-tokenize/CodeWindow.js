import React from "react";
import CodeBlock from "@theme/CodeBlock";
import styles from "./codeWindow.module.css";

/** @param {{language: string, title?: string, children: string}} props */
export default function CodeWindow({ language, title, children }) {
  return (
    <div className={styles.canvas} data-code-window>
      <div
        className={styles.window}
        role="group"
        aria-label={title || `${language} example`}
      >
        <div className={styles.titleBar}>
          <span className={styles.windowDots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.filename}>{title || language}</span>
        </div>
        <div className={styles.windowCode}>
          <CodeBlock language={language} showLineNumbers={false}>
            {children}
          </CodeBlock>
        </div>
      </div>
    </div>
  );
}
