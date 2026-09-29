import React from 'react';
import Link from '@docusaurus/Link';
import {IconAgent} from './icons';
import {track} from './shared';
import cv from './styles.module.css';
import styles from './usecases.module.css';

// A panel for readers who would rather hand the setup to a coding agent:
// where the prompts live and where the markdown copy of the docs starts.
export default function AgentBand({source = 'docs-home'}) {
  return (
    <aside className={styles.agentBand} aria-labelledby="agent-band-title">
      <span className={styles.agentIcon}>
        <IconAgent size={24} />
      </span>
      <div className={styles.agentCopy}>
        <h2 id="agent-band-title" className={styles.agentTitle}>
          Set up LiteLLM with your coding agent
        </h2>
        <p className={styles.agentText}>
          Claude Code, Codex, and Cursor can install and configure LiteLLM for you. Every product below has a prompt to copy, and every docs page
          is also published as markdown for agents to read.
        </p>
      </div>
      <div className={styles.agentActions}>
        <Link className={cv.btnPrimary} to="/docs/agent_resources" onClick={() => track('docs_agent_band', {target: 'agent_resources', source})}>
          Agent resources
        </Link>
        <Link className={cv.btnSecondary} to="https://docs.litellm.ai/llms.txt" onClick={() => track('docs_agent_band', {target: 'llms_txt', source})}>
          llms.txt
        </Link>
      </div>
    </aside>
  );
}
