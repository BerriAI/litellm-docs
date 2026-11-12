import React, { useId } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Kind = 'mtls' | 'mtls-aws' | 'mtls-azure' | 'mtls-gcp' | 'mtls-nginx' | 'mtls-haproxy' | 'mtls-kong' | 'iap-aws' | 'iap-azure' | 'iap-gcp' | 'iap-cloudflare';
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

const mtls: Architecture = {
  title: 'Client certificate identity',
  client: { title: 'Workload', detail: 'Client certificate', symbol: 'client' },
  boundary: 'Private ingress',
  edge: { title: 'ALB or API gateway', detail: 'Verify client certificate', symbol: 'shield' },
  identity: 'X-MTLS-Client-ID + LiteLLM key',
  origin: 'Customer ID + key permissions',
  note: 'The ingress overwrites the identity header. LiteLLM records the customer ID and applies virtual-key permissions.',
};

const architectures: Record<Kind, Architecture> = {
  mtls,
  'mtls-aws': {
    ...mtls,
    title: 'ALB certificate authentication',
    edge: { title: 'Internal ALB', detail: 'mTLS verify mode', icon: 'cloud_icons/aws-alb.svg' },
    connector: { title: 'NGINX', detail: 'Certificate → workload ID', symbol: 'shield' },
  },
  'mtls-azure': {
    ...mtls,
    title: 'Application Gateway certificate authentication',
    edge: { title: 'Application Gateway', detail: 'Strict mTLS', icon: 'cloud_icons/azure-application-gateways.svg' },
    note: 'Application Gateway forwards the verified certificate issuer and serial. LiteLLM uses them as the customer ID.',
  },
  'mtls-gcp': {
    ...mtls,
    title: 'Google Cloud ALB certificate authentication',
    edge: { title: 'Internal ALB', detail: 'Reject invalid certificates', icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    note: 'The URL map forwards the verified certificate fingerprint. LiteLLM uses it as the customer ID.',
  },
  'mtls-nginx': {
    ...mtls,
    title: 'NGINX certificate authentication',
    edge: { title: 'NGINX', detail: 'Verify certificate + map ID', symbol: 'shield' },
  },
  'mtls-haproxy': {
    ...mtls,
    title: 'HAProxy certificate authentication',
    edge: { title: 'HAProxy', detail: 'Verify certificate + map ID', symbol: 'shield' },
  },
  'mtls-kong': {
    ...mtls,
    title: 'Kong certificate authentication',
    edge: { title: 'Kong Gateway', detail: 'mTLS → Consumer', symbol: 'shield' },
    note: 'Kong maps the verified certificate to a Consumer and forwards its custom ID. LiteLLM records that customer ID.',
  },
  'iap-aws': {
    title: 'ALB authentication and identity forwarding',
    client: { title: 'Application', detail: 'Bearer JWT', symbol: 'client' },
    boundary: 'Private ingress',
    edge: { title: 'Internal ALB', detail: 'JWT validation', icon: 'cloud_icons/aws-alb.svg' },
    identity: 'Authorization: Bearer <JWT>',
    origin: 'Verified claims → user / team',
    note: 'ALB validates the caller token and forwards it unchanged. LiteLLM verifies its claims and applies user and team permissions.',
  },
  'iap-azure': {
    title: 'Entra authentication and identity forwarding',
    client: { title: 'Employee', detail: 'Approved device', symbol: 'client' },
    boundary: 'Microsoft Entra',
    edge: { title: 'Application Proxy', detail: 'Conditional Access', icon: 'cloud_icons/azure-enterprise-applications.svg' },
    identity: 'X-LiteLLM-User-ID + X-LiteLLM-User-Email',
    connector: { title: 'Connectors + NGINX', detail: 'Required identity headers', icon: 'cloud_icons/azure-virtual-network.svg' },
    origin: 'Trusted headers → user / team',
    note: 'Application Proxy sets the user headers. NGINX rejects missing identity and adds the approved team. LiteLLM trusts only NGINX.',
  },
  'iap-gcp': {
    title: 'IAP authentication and identity forwarding',
    client: { title: 'Caller', detail: 'VPN or Interconnect', symbol: 'client' },
    boundary: 'Private ingress',
    edge: { title: 'Internal ALB + IAP', detail: 'IAP access policy', icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    identity: 'x-goog-iap-jwt-assertion → X-LiteLLM-IAP-Token',
    connector: { title: 'NGINX', detail: 'Add Bearer prefix', symbol: 'shield' },
    origin: 'Verified claims → user / team',
    note: 'IAP signs the caller identity. NGINX formats the header. LiteLLM verifies the assertion and applies user and team permissions.',
  },
  'iap-cloudflare': {
    title: 'Access authentication and identity forwarding',
    client: { title: 'Employee', detail: 'Corporate WARP device', symbol: 'client' },
    boundary: 'Cloudflare',
    edge: { title: 'Access', detail: 'Allow policy + Gateway', icon: 'providers/cloudflare.svg' },
    identity: 'Cf-Access-Jwt-Assertion → X-LiteLLM-IAP-Token',
    connector: { title: 'cloudflared + NGINX', detail: 'Private tunnel + Bearer prefix', icon: 'providers/cloudflare.svg' },
    origin: 'Verified claims → user / team',
    note: 'Access signs the caller identity. The tunnel reaches private NGINX. LiteLLM verifies the assertion and applies user and team permissions.',
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
