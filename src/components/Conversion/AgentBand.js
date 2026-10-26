import React from 'react';
import Link from '@docusaurus/Link';
import {IconAgent} from './icons';
import {track} from './shared';
import styles from './usecases.module.css';

// A one-line pointer for readers who would rather hand the setup to a coding
// agent: where the prompts and skills live, and where the markdown starts.
export default function AgentBand({source = 'docs-home'}) {
  return (
    <aside className={styles.agentBand}>
      <IconAgent size={18} />
      <p className={styles.agentText}>
        <strong>Do you use a coding agent?</strong> Copy the agent prompt of a product below. You can also start from{' '}
        <Link to="/docs/agent_resources" onClick={() => track('docs_agent_band', {target: 'agent_resources', source})}>
          Agent resources
        </Link>{' '}
        and{' '}
        <Link to="https://docs.litellm.ai/llms.txt" onClick={() => track('docs_agent_band', {target: 'llms_txt', source})}>
          llms.txt
        </Link>
        .
      </p>
    </aside>
  );
}
