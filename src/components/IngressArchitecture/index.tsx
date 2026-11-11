import React, { useId } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Kind = 'mtls' | 'iap-aws' | 'iap-azure' | 'iap-gcp' | 'iap-cloudflare';
type Step = { title: string; detail: string; icon?: string; symbol?: 'client' | 'shield' };
type Architecture = {
  title: string;
  client: Step;
  boundary: string;
  edge: Step;
  identity: string;
  connector?: Step;
  origin: string;
  note: string;
};

const architectures: Record<Kind, Architecture> = {
  mtls: {
    title: 'Client certificate identity',
    client: { title: 'Workload', detail: 'Client certificate', symbol: 'client' },
    boundary: 'Private ingress',
    edge: { title: 'ALB or API gateway', detail: 'Verify client certificate', symbol: 'shield' },
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    origin: 'Key permissions + usage',
    note: 'The ingress overwrites the identity header. LiteLLM records the customer ID and applies virtual-key permissions.',
  },
  'iap-aws': {
    title: 'AWS employee sign-in',
    client: { title: 'Employee', detail: 'VPN or Direct Connect', symbol: 'client' },
    boundary: 'Private ingress',
    edge: { title: 'Internal ALB', detail: 'OIDC authentication', icon: 'cloud_icons/aws-alb.svg' },
    identity: 'x-amzn-oidc-data',
    origin: 'Verify JWT → UI session',
    note: 'ALB signs the identity header. The LiteLLM handler verifies it and maps sub to the user ID.',
  },
  'iap-azure': {
    title: 'Azure employee sign-in',
    client: { title: 'Employee', detail: 'Approved device', symbol: 'client' },
    boundary: 'Microsoft Entra',
    edge: { title: 'Application Proxy', detail: 'Conditional Access', icon: 'cloud_icons/azure-enterprise-applications.svg' },
    identity: 'X-LiteLLM-User-ID + X-LiteLLM-User-Email',
    connector: { title: 'Connectors', detail: 'Outbound channel', icon: 'cloud_icons/azure-virtual-network.svg' },
    origin: 'Trusted headers → UI session',
    note: 'Application Proxy sets the identity headers. LiteLLM accepts them only from trusted connectors.',
  },
  'iap-gcp': {
    title: 'GCP employee sign-in',
    client: { title: 'Employee', detail: 'VPN or Interconnect', symbol: 'client' },
    boundary: 'Private ingress',
    edge: { title: 'Internal ALB + IAP', detail: 'IAP access policy', icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    identity: 'x-goog-iap-jwt-assertion',
    origin: 'Verify JWT → UI session',
    note: 'IAP signs the identity header. The LiteLLM handler verifies it and maps sub and email to the user.',
  },
  'iap-cloudflare': {
    title: 'Cloudflare employee sign-in',
    client: { title: 'Employee', detail: 'Corporate WARP device', symbol: 'client' },
    boundary: 'Cloudflare',
    edge: { title: 'Access', detail: 'Allow policy + Gateway', icon: 'providers/cloudflare.svg' },
    identity: 'Cf-Access-Jwt-Assertion',
    connector: { title: 'cloudflared', detail: 'Verify Access JWT', icon: 'providers/cloudflare.svg' },
    origin: 'Verify JWT → UI session',
    note: 'Access signs the identity header. The tunnel reaches the private origin. LiteLLM verifies the employee identity.',
  },
};

function Symbol({ kind }: { kind: 'client' | 'shield' }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={styles.symbol} fill="none" stroke="currentColor" strokeWidth="1.7">
      {kind === 'client' ? <><rect x="4" y="6" width="32" height="23" rx="3" /><path d="M13 35h14M20 29v6M15 13l-5 5 5 5m10-10 5 5-5 5" /></> : <><path d="M20 3 34 9v11c0 8-8 14-14 17C14 34 6 28 6 20V9Z" /><path d="m13 20 5 5 10-11" /></>}
    </svg>
  );
}

function Card({ step }: { step: Step }) {
  const iconUrl = useBaseUrl(`/img/${step.icon ?? 'brand/litellm-monogram-blue.svg'}`);
  return <div className={styles.card}>
    {step.symbol ? <Symbol kind={step.symbol} /> : <img src={iconUrl} alt="" className={styles.icon} />}
    <div className={styles.cardText}><strong>{step.title}</strong><span>{step.detail}</span></div>
  </div>;
}

function Arrow() {
  return <span className={styles.arrow} aria-hidden="true" />;
}

export function IngressArchitecture({ kind }: { kind: Kind }) {
  const data = architectures[kind];
  const id = useId();
  return <figure className={styles.figure} aria-labelledby={id}>
    <figcaption id={id} className={styles.heading}>{data.title}</figcaption>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label={`${data.title}, request path`}>
      <div className={`${styles.canvas} ${data.connector ? styles.withConnector : ''}`}>
        <section className={styles.boundary} aria-label="Corporate network">
          <div className={styles.boundaryLabel}>Corporate access</div>
          <Card step={data.client} />
        </section>
        <Arrow />
        <section className={styles.boundary} aria-label={data.boundary}>
          <div className={styles.boundaryLabel}>{data.boundary}</div>
          <Card step={data.edge} />
        </section>
        <Arrow />
        <section className={`${styles.boundary} ${styles.origin}`} aria-label="Private origin, ingress access only">
          <div className={styles.boundaryLabel}>Private origin</div>
          <div className={styles.originPath}>
            {data.connector && <><Card step={data.connector} /><Arrow /></>}
            <Card step={{ title: 'LiteLLM', detail: data.origin }} />
          </div>
        </section>
      </div>
    </div>
    <div className={styles.identity}><span>Forwarded identity</span><code>{data.identity}</code></div>
    <p className={styles.note}>{data.note}</p>
  </figure>;
}
