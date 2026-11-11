import React, { useId } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Kind = 'mtls' | 'iap-aws' | 'iap-azure' | 'iap-gcp' | 'iap-cloudflare';
type Step = { title: string; detail: string; icon?: string; symbol?: 'client' | 'shield' };
type Architecture = {
  title: string;
  client: Step;
  credential: string;
  boundary: string;
  edge: Step;
  policy: string;
  link: string;
  originBoundary: string;
  connector?: Step;
  origin: string;
  note: string;
};

const architectures: Record<Kind, Architecture> = {
  mtls: {
    title: 'Client certificate authentication',
    client: { title: 'Client application', detail: 'Client certificate + private key; LiteLLM virtual key', symbol: 'client' },
    credential: 'mTLS · client certificate + Authorization header',
    boundary: 'Your API ingress',
    edge: { title: 'Load balancer or API gateway', detail: 'Terminates client TLS and validates the client certificate', symbol: 'shield' },
    policy: 'Require a valid certificate from your trusted client CA. Forward the LiteLLM key.',
    link: 'New HTTPS connection · LiteLLM virtual key',
    originBoundary: 'Private origin · allow only the configured ingress',
    origin: 'Checks the virtual key, permitted models, and budgets',
    note: 'The two TLS connections have separate certificates and trust settings. A client certificate does not automatically become a LiteLLM user. Configure origin TLS and certificate verification as described for your ingress.',
  },
  'iap-aws': {
    title: 'AWS identity-aware ingress',
    client: { title: 'Browser or API client', detail: 'Browser session, or an IdP JWT plus a LiteLLM key', symbol: 'client' },
    credential: 'HTTPS · separate browser and API listener rules',
    boundary: 'AWS · Application Load Balancer',
    edge: { title: 'Application Load Balancer', detail: 'Browser: authenticate-oidc · API: jwt-validation', icon: 'cloud_icons/aws-alb.svg' },
    policy: 'Browser rule redirects to your IdP. API rule validates JWT signature and required claims.',
    link: 'HTTPS target group · separate TLS connection',
    originBoundary: 'VPC · private targets · ingress from the ALB security group only',
    origin: 'Checks the UI session or the virtual key in X-Litellm-Key',
    note: 'The diagram shows the HTTPS target option. ALB does not verify target certificates. Keep targets private. OIDC redirects and IdP exchanges are omitted from this request-path view.',
  },
  'iap-azure': {
    title: 'Microsoft Entra Application Proxy',
    client: { title: 'Employee browser or delegated client', detail: 'Entra user sign-in; retain LiteLLM sign-in or an API key', symbol: 'client' },
    credential: 'HTTPS · Entra user identity',
    boundary: 'Microsoft Entra · managed application access',
    edge: { title: 'Application Proxy', detail: 'Entra preauthentication and assigned user access', icon: 'cloud_icons/azure-enterprise-applications.svg' },
    policy: 'Check employee access and Conditional Access policy. Application-only tokens are outside this flow.',
    link: 'Encrypted connector channel · opened outbound by the connector',
    originBoundary: 'Private network · no public origin listener',
    connector: { title: 'Private-network connectors', detail: 'Windows Server connector group; use separate hosts for availability', icon: 'cloud_icons/azure-virtual-network.svg' },
    origin: 'Checks the UI session or the virtual key in X-Litellm-Key',
    note: 'Arrows follow a request. The connectors initiate the connection to Microsoft, so no inbound Internet port is required. Connector-to-origin HTTPS must validate the origin certificate.',
  },
  'iap-gcp': {
    title: 'Google Cloud Identity-Aware Proxy',
    client: { title: 'Browser or service account', detail: 'IAP credential plus a LiteLLM session or virtual key', symbol: 'client' },
    credential: 'HTTPS · IAP token in Proxy-Authorization for API calls',
    boundary: 'Google Cloud · HTTPS load balancer',
    edge: { title: 'Application Load Balancer with IAP', detail: 'IAP authenticates the caller and checks resource access', icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    policy: 'Protect every exposed backend. Grant IAP-Secured Web App User to approved principals.',
    link: 'Authorized request · configure transport for the backend type',
    originBoundary: 'Restricted origin · block routes around IAP',
    origin: 'Cloud Run or GKE; checks its own session, key, and permissions',
    note: 'For Cloud Run, restrict ingress and require invoker IAM checks. For GKE or VM backends, configure backend TLS and firewall rules. Validate signed IAP assertions at a trusted ingress or application layer.',
  },
  'iap-cloudflare': {
    title: 'Cloudflare Access and Tunnel',
    client: { title: 'Browser or service', detail: 'Access session or service token, plus LiteLLM credentials', symbol: 'client' },
    credential: 'HTTPS · Access credential + LiteLLM credential',
    boundary: 'Cloudflare · managed edge',
    edge: { title: 'Cloudflare Access', detail: 'Employee Allow policy or Service Auth policy', icon: 'providers/cloudflare.svg' },
    policy: 'Access authenticates the caller before forwarding the request through Tunnel.',
    link: 'Encrypted Tunnel · opened outbound by cloudflared',
    originBoundary: 'Private network · no public origin listener',
    connector: { title: 'cloudflared connectors', detail: 'Validate the Access application JWT; run on separate hosts', icon: 'providers/cloudflare.svg' },
    origin: 'Checks the UI session or Authorization: Bearer virtual key',
    note: 'Arrows follow a request; cloudflared opens the tunnel outbound. Use HTTPS with certificate verification from the connector to LiteLLM. Cloudflare identity does not assign LiteLLM roles.',
  },
};

function Symbol({ kind }: { kind: 'client' | 'shield' }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={styles.symbol} fill="none" stroke="currentColor" strokeWidth="1.7">
      {kind === 'client' ? <><rect x="4" y="6" width="32" height="23" rx="3" /><path d="M13 35h14M20 29v6M15 13l-5 5 5 5m10-10 5 5-5 5" /></> : <><path d="M20 3 34 9v11c0 8-8 14-14 17C14 34 6 28 6 20V9Z" /><path d="m13 20 5 5 10-11" /></>}
    </svg>
  );
}

function Card({ step, number }: { step: Step; number: number }) {
  const iconUrl = useBaseUrl(`/img/${step.icon ?? 'brand/litellm-monogram-blue.svg'}`);
  return <div className={styles.card}>
    <span className={styles.number}>{number}</span>
    {step.symbol ? <Symbol kind={step.symbol} /> : <img src={iconUrl} alt="" className={styles.icon} />}
    <div className={styles.cardText}><strong>{step.title}</strong><span>{step.detail}</span></div>
  </div>;
}

function Flow({ children }: { children: React.ReactNode }) {
  return <div className={styles.flow}><span className={styles.arrow} aria-hidden="true" /><span>{children}</span></div>;
}

export function IngressArchitecture({ kind }: { kind: Kind }) {
  const data = architectures[kind];
  const id = useId();
  return <figure className={styles.figure} aria-labelledby={id}>
    <figcaption id={id} className={styles.heading}>{data.title}<span>Request path and authentication boundaries</span></figcaption>
    <div className={styles.canvas}>
      <Card step={data.client} number={1} />
      <Flow>{data.credential}</Flow>
      <section className={styles.boundary} aria-label={data.boundary}>
        <div className={styles.boundaryLabel}>{data.boundary}</div>
        <Card step={data.edge} number={2} />
        <p className={styles.policy}>{data.policy}</p>
      </section>
      <Flow>{data.link}</Flow>
      <section className={`${styles.boundary} ${styles.origin}`} aria-label={data.originBoundary}>
        <div className={styles.boundaryLabel}>{data.originBoundary}</div>
        {data.connector && <><Card step={data.connector} number={3} /><Flow>HTTPS · verify the origin certificate</Flow></>}
        <Card step={{ title: 'LiteLLM', detail: data.origin }} number={data.connector ? 4 : 3} />
      </section>
    </div>
    <p className={styles.note}>{data.note}</p>
  </figure>;
}
