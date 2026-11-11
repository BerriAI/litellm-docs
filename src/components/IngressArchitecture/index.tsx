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
    title: 'Forward verified client certificate identity',
    client: { title: 'Corporate workload', detail: 'Client certificate and private key', symbol: 'client' },
    credential: 'Private network access · mTLS · optional client-held LiteLLM key',
    boundary: 'Private API ingress',
    edge: { title: 'Load balancer or API gateway', detail: 'Verify the client certificate against the client CA', symbol: 'shield' },
    policy: 'Overwrite X-mTLS-Client-ID from the verified certificate. Remove client-supplied customer identity headers.',
    link: 'HTTPS · X-mTLS-Client-ID · LiteLLM key',
    originBoundary: 'Private LiteLLM endpoint · ingress access only',
    origin: 'Validate the key. Apply its permissions. Map the certificate identity to the customer in usage logs.',
    note: 'The examples configure both the ingress header and LiteLLM user_header_mappings. Certificate-only clients can use an ingress that maps each certificate identity to its own stored LiteLLM key.',
  },
  'iap-aws': {
    title: 'Internal ALB forwards employee identity',
    client: { title: 'Corporate employee', detail: 'Browser on VPN, Direct Connect, or approved private access', symbol: 'client' },
    credential: 'Private DNS and HTTPS · OIDC sign-in',
    boundary: 'VPC · internal Application Load Balancer',
    edge: { title: 'Internal ALB', detail: 'authenticate-oidc before forward on each UI route', icon: 'cloud_icons/aws-alb.svg' },
    policy: 'Allow corporate client CIDRs. Authenticate with the configured OIDC provider.',
    link: 'HTTPS target group · signed x-amzn-oidc-data',
    originBoundary: 'Private targets · ALB security group only',
    origin: 'identity_sso.handler verifies the ALB assertion. sub identifies the user. LiteLLM creates the UI session.',
    note: 'Set AWS_ALB_ARN, AWS_ALB_OIDC_CLIENT_ID, and AWS_ALB_OIDC_ISSUER. ALB encrypts the backend connection but does not verify its certificate. API JWT rules use the original IdP token instead.',
  },
  'iap-azure': {
    title: 'Entra Application Proxy forwards employee identity',
    client: { title: 'Corporate employee', detail: 'Entra sign-in and required device policies', symbol: 'client' },
    credential: 'HTTPS · Entra preauthentication and Conditional Access',
    boundary: 'Microsoft Entra · approved corporate access',
    edge: { title: 'Application Proxy', detail: 'Header-based SSO maps the user object ID and email', icon: 'cloud_icons/azure-enterprise-applications.svg' },
    policy: 'Assign approved users or groups. Set X-LiteLLM-User-ID and X-LiteLLM-User-Email from their identity.',
    link: 'Encrypted connector channel · connectors open outbound connections',
    originBoundary: 'Private network · connector access only',
    connector: { title: 'Private-network connectors', detail: 'Separate Windows Server hosts. Verify the origin HTTPS certificate.', icon: 'cloud_icons/azure-virtual-network.svg' },
    origin: 'trusted_proxy_ranges checks the connector peer. identity_sso.handler creates a session for the forwarded user.',
    note: 'Azure forwards plain identity headers through trusted connectors. Restrict direct origin access. This browser flow does not authenticate unattended service principals.',
  },
  'iap-gcp': {
    title: 'Internal load balancer forwards the IAP assertion',
    client: { title: 'Corporate employee', detail: 'Browser on Cloud VPN or Cloud Interconnect', symbol: 'client' },
    credential: 'Private DNS and HTTPS · Google sign-in',
    boundary: 'VPC · internal Application Load Balancer',
    edge: { title: 'Internal load balancer with IAP', detail: 'IAP enabled on every exposed backend service', icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    policy: 'Grant roles/iap.httpsResourceAccessor to approved corporate users or groups.',
    link: 'Signed x-goog-iap-jwt-assertion · sub and email claims',
    originBoundary: 'Private backend · block direct access',
    origin: 'identity_sso.handler verifies the assertion against GCP_IAP_AUDIENCE. LiteLLM opens the user session.',
    note: 'Copy the resource Signed Header JWT Audience from IAP. For Cloud Run, keep internal ingress and Invoker IAM checks. Configure backend TLS separately for GKE or VM targets.',
  },
  'iap-cloudflare': {
    title: 'Cloudflare Access forwards the employee assertion',
    client: { title: 'Corporate employee', detail: 'Browser on a device enrolled in the corporate Zero Trust account', symbol: 'client' },
    credential: 'HTTPS · Access sign-in and required device policy',
    boundary: 'Cloudflare · corporate Access policy',
    edge: { title: 'Cloudflare Access', detail: 'Allow approved employees. Require Gateway.', icon: 'providers/cloudflare.svg' },
    policy: 'Issue a signed assertion for the configured Access application audience.',
    link: 'Tunnel · Cf-Access-Jwt-Assertion',
    originBoundary: 'Private network · connector access only',
    connector: { title: 'cloudflared connectors', detail: 'originRequest.access.required: true, teamName, and audTag', icon: 'providers/cloudflare.svg' },
    origin: 'identity_sso.handler verifies the assertion. sub identifies the employee. LiteLLM creates the UI session.',
    note: 'Keep noTLSVerify: false. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUDIENCE on LiteLLM. Service tokens use common_name for API identity and cannot sign into the UI.',
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
    <figcaption id={id} className={styles.heading}>{data.title}<span>Proxy settings and forwarded identity</span></figcaption>
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
