import React from "react";
import { PostByline } from "@theme/BlogPostPage";
import WorkflowAnimation from "./WorkflowAnimation";
import styles from "./launch.module.css";

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12" /></svg>;
}

export default function LiteflowPage({ children }) {
  return (
    <div className={styles.root} data-full-width>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.heroNav} aria-label="Liteflow article">
            <a href="/docs/simple_proxy" className={styles.brand}>
              <img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="126" height="27" />
              <span>/ AI GATEWAY</span>
            </a>
            <a href="/blog">Back to the blog <Arrow /></a>
          </nav>
          <div className={styles.heroCopy}>
            <p className={styles.heroMeta}>LITEFLOW / AI GATEWAY WORKFLOWS / DEVELOPER PREVIEW</p>
            <h1 className={styles.heroTitle}><span>Launching Liteflow:</span>{" "}<span>define and run AI workflows.</span></h1>
            <div className={styles.heroDetails}>
              <p className={styles.heroIntro}>Build workflows that call LLMs and run Python code. Define them with the Liteflow SDK and register them on your gateway, without maintaining a separate workflow server.</p>
              <p className={styles.heroFlow}>Define the workflow. Register it. Call it through Chat Completions.</p>
              <div className={styles.heroActions}>
                <a href="#step-1-define-your-workflow">Build a workflow <Arrow /></a>
                <a href="https://github.com/BerriAI/liteflow" target="_blank" rel="noopener noreferrer">View the SDK <Arrow /></a>
              </div>
            </div>
          </div>
          <WorkflowAnimation />
          <p className={styles.graphCaption}>Graph execution is in development. Start with the sequential example below.</p>
        </div>
      </header>
      <div className={styles.article}>
        <div className={styles.byline}><PostByline horizontal /></div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
