import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/* Shared primitives, mirrored from CloudArchitecture.tsx */

function Icon({ file, className }: { file: string; className?: string }) {
  return (
    <img
      src={useBaseUrl(`/img/cloud_icons/${file}`)}
      className={className ?? styles.nodeIcon}
      alt=""
      role="presentation"
    />
  );
}

function Clients({ label = 'Clients (OpenAI SDK, LangChain, curl)' }: { label?: string }) {
  return (
    <div className={styles.clients}>
      <div className={styles.clientsIcon}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
      <span className={styles.clientsLabel}>{label}</span>
    </div>
  );
}

function Node({
  icon,
  title,
  subtitle,
  accent,
  small,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  accent?: 'blue' | 'green';
  small?: boolean;
}) {
  const cls = [
    styles.node,
    accent === 'blue' ? styles.nodeAccent : '',
    accent === 'green' ? styles.nodeGreen : '',
    small ? styles.nodeSmall : '',
  ].join(' ');
  return (
    <div className={cls}>
      <Icon file={icon} />
      <div className={styles.nodeText}>
        <span className={styles.nodeTitle}>{title}</span>
        {subtitle && <span className={styles.nodeSubtitle}>{subtitle}</span>}
      </div>
    </div>
  );
}

function StepNode({
  n,
  title,
  subtitle,
  accent,
}: {
  n?: number;
  title: string;
  subtitle?: string;
  accent?: 'blue' | 'green';
}) {
  const cls = [
    styles.node,
    styles.nodeSmall,
    accent === 'blue' ? styles.nodeAccent : '',
    accent === 'green' ? styles.nodeGreen : '',
  ].join(' ');
  return (
    <div className={cls}>
      {n !== undefined && <span className={styles.stepChip}>{n}</span>}
      <div className={styles.nodeText}>
        <span className={styles.nodeTitle}>{title}</span>
        {subtitle && <span className={styles.nodeSubtitle}>{subtitle}</span>}
      </div>
    </div>
  );
}

function PillsNode({
  title,
  subtitle,
  pills,
}: {
  title: string;
  subtitle?: string;
  pills: string[];
}) {
  return (
    <div className={styles.computeNode}>
      <div className={styles.computeHeader}>
        <div className={styles.nodeText}>
          <span className={styles.nodeTitle}>{title}</span>
          {subtitle && <span className={styles.nodeSubtitle}>{subtitle}</span>}
        </div>
      </div>
      <div className={styles.replicaRow}>
        {pills.map((p) => (
          <span key={p} className={styles.replicaPill}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConnectorDown({ label }: { label?: string }) {
  if (!label) return <div className={styles.connectorDown} />;
  return (
    <div className={styles.connectorLabeled}>
      <span className={styles.connectorLabel}>{label}</span>
      <div className={styles.connectorDown} />
    </div>
  );
}

function Branch({ legs }: { legs: number }) {
  const positions =
    legs === 2 ? ['30%', '70%'] : legs === 3 ? ['20%', '50%', '80%'] : ['50%'];
  return (
    <div className={styles.branch}>
      <div className={styles.branchStem} />
      <div
        className={styles.branchBar}
        style={{ left: positions[0], right: `calc(100% - ${positions[positions.length - 1]})` }}
      />
      {positions.map((p) => (
        <div key={p} className={styles.branchLeg} style={{ left: p }} />
      ))}
    </div>
  );
}

function Box({
  name,
  badge,
  badgeColor,
  children,
}: {
  name: string;
  badge?: string;
  badgeColor?: 'blue' | 'green' | 'orange';
  children: React.ReactNode;
}) {
  const badgeCls =
    badgeColor === 'green'
      ? styles.badgeGreen
      : badgeColor === 'orange'
      ? styles.badgeOrange
      : styles.badgeBlue;
  return (
    <div className={styles.region}>
      <div className={styles.regionHeader}>
        <span className={styles.regionName}>{name}</span>
        {badge && <span className={`${styles.badge} ${badgeCls}`}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

/* ────────────────────── Life of a Request ────────────────────── */

export function RequestFlowDiagram() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.diagram}>
        <Clients />
        <ConnectorDown label="Authorization: Bearer sk-..." />
        <Box name="LiteLLM Gateway" badge=":4000" badgeColor="blue">
          <StepNode n={1} title="Auth and budget checks" subtitle="virtual key: cache first, database on miss" />
          <ConnectorDown />
          <StepNode n={2} title="Rate limiting" subtitle="rpm / tpm for key, user, team, and server" />
          <Branch legs={2} />
          <div className={styles.dataRow}>
            <Node icon="postgresql.svg" title="PostgreSQL" subtitle="keys, teams, spend" small />
            <Node icon="redis.svg" title="Redis" subtitle="key cache, rate-limit counters" small />
          </div>
          <ConnectorDown />
          <StepNode n={3} title="Router" subtitle="load balancing, fallbacks, retries" />
          <ConnectorDown />
          <StepNode n={4} title="Provider translation" subtitle="litellm SDK, OpenAI format in and out" />
        </Box>
        <ConnectorDown label="provider-native request" />
        <PillsNode title="LLM providers" pills={['OpenAI', 'Anthropic', 'Bedrock', 'Vertex', '100+ more']} />
        <div className={`${styles.callout} ${styles.calloutSuccess}`}>
          <span>
            After the response is returned to the client, spend logging, rate-limit accounting, and
            logging callbacks all run as asynchronous background tasks; no database write sits in
            the request path.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Router: fallbacks and retries ────────────────────── */

export function RouterFlowDiagram() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.diagram}>
        <StepNode title="Unified call" subtitle=".completion, .embeddings, and every other unified endpoint" accent="blue" />
        <ConnectorDown />
        <StepNode n={1} title="function_with_fallbacks" subtitle="catches failures; moves to the next model group in fallbacks" />
        <ConnectorDown />
        <StepNode n={2} title="function_with_retries" subtitle="retries on another available deployment in the same group" />
        <ConnectorDown />
        <StepNode n={3} title="litellm.completion" subtitle="makes the provider API call" />
        <ConnectorDown />
        <PillsNode
          title="model group: gpt-4o"
          subtitle="deployments sharing one model_name, load balanced"
          pills={['deployment 1', 'deployment 2', 'deployment 3']}
        />
        <div className={`${styles.callout} ${styles.calloutSuccess}`}>
          <span>
            Retries stay inside the model group that failed; fallbacks leave it for the next group
            in your fallbacks configuration.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Image URL handling ────────────────────── */

export function ImageFlowDiagram() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.diagram}>
        <StepNode title="Request contains an image URL" accent="blue" />
        <ConnectorDown />
        <StepNode title="Does the target provider accept URLs?" />
        <Branch legs={2} />
        <div className={styles.regionsRow}>
          <Box name="Yes" badge="pass through" badgeColor="green">
            <StepNode title="URL forwarded unchanged" subtitle="provider fetches the image itself" />
          </Box>
          <Box name="No" badge="convert" badgeColor="orange">
            <StepNode n={1} title="Download the image" subtitle="up to 50MB (MAX_IMAGE_URL_DOWNLOAD_SIZE_MB)" />
            <ConnectorDown />
            <StepNode n={2} title="Send base64 to the provider" subtitle="conversion cached, up to 10 images in memory" />
          </Box>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Tenancy hierarchy ────────────────────── */

export function TenancyDiagram() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.diagram}>
        <Box name="Organization" badge="enterprise" badgeColor="blue">
          <div className={styles.regionsRow}>
            <Box name="Team: production" badge="budget + models" badgeColor="green">
              <PillsNode title="Users" pills={['alice', 'bob']} />
              <ConnectorDown />
              <PillsNode title="Keys" subtitle="user keys and team service accounts" pills={['sk-alice', 'sk-svc-prod']} />
            </Box>
            <Box name="Team: experiments" badge="budget + models" badgeColor="green">
              <PillsNode title="Users" pills={['carol']} />
              <ConnectorDown />
              <PillsNode title="Keys" pills={['sk-carol']} />
            </Box>
          </div>
        </Box>
        <div className={`${styles.callout} ${styles.calloutSuccess}`}>
          <span>
            Every request's spend is attributed to its key, user, team, and organization at once,
            and budgets are enforced at each level; a request is blocked when any level on its path
            is over budget. Teams are the top-level boundary in open source; Organizations add the
            outer layer and are an enterprise feature.
          </span>
        </div>
      </div>
    </div>
  );
}
