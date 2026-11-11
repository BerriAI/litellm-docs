import React, { useState } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';
import { NetworkArchitecture } from './NetworkArchitecture';
import type { CloudKey } from './networkTypes';

/* ────────────────────── Shared pieces ────────────────────── */

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
    legs === 2 ? ['25%', '75%'] : legs === 3 ? ['16.67%', '50%', '83.33%'] : ['50%'];
  return (
    <div className={styles.branch}>
      <div className={styles.branchStem} />
      <div className={styles.branchBar} style={{ left: positions[0], right: `calc(100% - ${positions[positions.length - 1]})` }} />
      {positions.map((p) => (
        <div key={p} className={styles.branchLeg} style={{ left: p }} />
      ))}
    </div>
  );
}

function Dependencies({ items }: {
  items: { icon: string; title: string; subtitle: string }[];
}) {
  return (
    <div className={styles.dependencies} style={{ '--dependency-count': items.length } as React.CSSProperties}>
      {items.map((item) => (
        <div className={styles.dependency} key={item.title}>
          <ConnectorDown />
          <Node {...item} small />
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── Per-cloud single-region diagrams ────────────────────── */

const MONO_PILLS = ['proxy', 'proxy', 'proxy'];
const MICRO_PILLS = ['gateway', 'backend', 'ui'];

const CLOUD_SPECS: Record<
  CloudKey,
  {
    lb: { icon: string; title: string; subtitle: string };
    compute: { icon: string; title: string; subtitle: string; pills: string[] };
    data: { icon: string; title: string; subtitle: string }[];
  }
> = {
  'aws-ecs': {
    lb: { icon: 'aws-alb.svg', title: 'Application Load Balancer', subtitle: 'HTTPS, path-based routing' },
    compute: {
      icon: 'aws-ecs.svg',
      title: 'ECS Fargate',
      subtitle: 'gateway :4000, backend :4001, ui :3000',
      pills: MICRO_PILLS,
    },
    data: [
      { icon: 'aws-aurora.svg', title: 'Aurora PostgreSQL', subtitle: 'writer + reader, IAM auth' },
      { icon: 'aws-elasticache.svg', title: 'ElastiCache Redis', subtitle: 'multi-AZ, TLS' },
      { icon: 'aws-secrets-manager.svg', title: 'Secrets Manager', subtitle: 'master key, provider keys' },
    ],
  },
  'aws-eks': {
    lb: { icon: 'aws-elb.svg', title: 'Load Balancer', subtitle: 'ALB or NLB via Service / Ingress' },
    compute: { icon: 'aws-eks.svg', title: 'EKS', subtitle: 'litellm chart, monolith.enabled: true', pills: MONO_PILLS },
    data: [
      { icon: 'aws-rds.svg', title: 'RDS PostgreSQL', subtitle: 'DATABASE_URL' },
      { icon: 'aws-elasticache.svg', title: 'ElastiCache Redis', subtitle: 'REDIS_HOST / PORT / PASSWORD' },
    ],
  },
  'aws-eks-micro': {
    lb: { icon: 'aws-alb.svg', title: 'Application Load Balancer', subtitle: 'ALB Ingress, path-based routing' },
    compute: {
      icon: 'aws-eks.svg',
      title: 'EKS',
      subtitle: 'litellm chart: gateway :4000, backend :4001, ui :3000',
      pills: MICRO_PILLS,
    },
    data: [
      { icon: 'aws-rds.svg', title: 'RDS PostgreSQL', subtitle: 'writer + optional reader' },
      { icon: 'aws-elasticache.svg', title: 'ElastiCache Redis', subtitle: 'standalone or cluster' },
    ],
  },
  'gcp-cloud-run': {
    lb: { icon: 'gcp-cloud-load-balancing.svg', title: 'Global HTTPS Load Balancer', subtitle: 'serverless NEGs, URL map' },
    compute: {
      icon: 'gcp-cloud-run.svg',
      title: 'Cloud Run',
      subtitle: 'gateway :4000, backend :4001, ui :3000',
      pills: MICRO_PILLS,
    },
    data: [
      { icon: 'gcp-cloud-sql.svg', title: 'Cloud SQL PostgreSQL', subtitle: 'primary + read replica' },
      { icon: 'gcp-memorystore.svg', title: 'Memorystore Redis', subtitle: 'private IP, TLS' },
    ],
  },
  'gcp-gke': {
    lb: { icon: 'gcp-cloud-load-balancing.svg', title: 'Cloud Load Balancing', subtitle: 'via Service / Ingress' },
    compute: {
      icon: 'gcp-google-kubernetes-engine.svg',
      title: 'GKE',
      subtitle: 'litellm chart, monolith.enabled: true',
      pills: MONO_PILLS,
    },
    data: [
      { icon: 'gcp-cloud-sql.svg', title: 'Cloud SQL PostgreSQL', subtitle: 'DATABASE_URL' },
      { icon: 'gcp-memorystore.svg', title: 'Memorystore Redis', subtitle: 'REDIS_HOST / PORT / PASSWORD' },
    ],
  },
  'gcp-gke-micro': {
    lb: { icon: 'gcp-cloud-load-balancing.svg', title: 'Cloud Load Balancing', subtitle: 'GKE Ingress, path-based routing' },
    compute: {
      icon: 'gcp-google-kubernetes-engine.svg',
      title: 'GKE',
      subtitle: 'litellm chart: gateway :4000, backend :4001, ui :3000',
      pills: MICRO_PILLS,
    },
    data: [
      { icon: 'gcp-cloud-sql.svg', title: 'Cloud SQL PostgreSQL', subtitle: 'writer + optional reader' },
      { icon: 'gcp-memorystore.svg', title: 'Memorystore Redis', subtitle: 'standalone or cluster' },
    ],
  },
  'azure-aks': {
    lb: { icon: 'azure-application-gateways.svg', title: 'Application Gateway', subtitle: 'or Front Door, TLS termination' },
    compute: {
      icon: 'azure-kubernetes-services.svg',
      title: 'AKS',
      subtitle: 'litellm chart, monolith.enabled: true',
      pills: MONO_PILLS,
    },
    data: [
      { icon: 'azure-azure-database-postgresql-server.svg', title: 'Azure Database for PostgreSQL', subtitle: 'Flexible Server' },
      { icon: 'azure-cache-redis.svg', title: 'Azure Cache for Redis', subtitle: 'REDIS_HOST / PORT / PASSWORD' },
    ],
  },
  'azure-aks-micro': {
    lb: { icon: 'azure-application-gateways.svg', title: 'Application Gateway', subtitle: 'AGIC, path-based routing' },
    compute: {
      icon: 'azure-kubernetes-services.svg',
      title: 'AKS',
      subtitle: 'litellm chart: gateway :4000, backend :4001, ui :3000',
      pills: MICRO_PILLS,
    },
    data: [
      { icon: 'azure-azure-database-postgresql-server.svg', title: 'Azure Database for PostgreSQL', subtitle: 'writer + optional reader' },
      { icon: 'azure-cache-redis.svg', title: 'Azure Cache for Redis', subtitle: 'standalone or cluster' },
    ],
  },
};

export function CloudArchitecture({ cloud }: { cloud: CloudKey }) {
  return <NetworkArchitecture cloud={cloud} />;
}

/* ────────────────────── CSP selector ────────────────────── */

const CSP_TABS: {
  key: string;
  label: string;
  icon: string;
  variants: { key: CloudKey; label: string }[];
}[] = [
  {
    key: 'aws',
    label: 'AWS',
    icon: 'aws.svg',
    variants: [
      { key: 'aws-ecs', label: 'Terraform on ECS Fargate' },
      { key: 'aws-eks-micro', label: 'EKS: separate services' },
      { key: 'aws-eks', label: 'EKS: single service' },
    ],
  },
  {
    key: 'gcp',
    label: 'Google Cloud',
    icon: 'google-cloud.svg',
    variants: [
      { key: 'gcp-cloud-run', label: 'Terraform on Cloud Run' },
      { key: 'gcp-gke-micro', label: 'GKE: separate services' },
      { key: 'gcp-gke', label: 'GKE: single service' },
    ],
  },
  {
    key: 'azure',
    label: 'Azure',
    icon: 'microsoft-azure.svg',
    variants: [
      { key: 'azure-aks-micro', label: 'AKS: separate services' },
      { key: 'azure-aks', label: 'AKS: single service' },
    ],
  },
];

export function CloudArchitectureSelector({ provider }: { provider?: 'aws' | 'gcp' | 'azure' } = {}) {
  const [cspKey, setCspKey] = useState('aws');
  const csp = CSP_TABS.find((t) => t.key === (provider ?? cspKey)) ?? CSP_TABS[0];
  const [variantByCsp, setVariantByCsp] = useState<Record<string, CloudKey>>({});
  const variant = variantByCsp[csp.key] ?? csp.variants[0].key;

  return (
    <div className={styles.wrapper}>
      {!provider && <div className={styles.tabs} role="group" aria-label="Cloud provider">
        {CSP_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.key === csp.key}
            className={`${styles.tab} ${t.key === csp.key ? styles.tabActive : ''}`}
            onClick={() => setCspKey(t.key)}
          >
            <Icon file={t.icon} className={styles.tabIcon} />
            {t.label}
          </button>
        ))}
      </div>}
      {csp.variants.length > 1 && (
        <div className={styles.variantRow}>
          {csp.variants.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={v.key === variant}
              className={`${styles.variantPill} ${v.key === variant ? styles.variantPillActive : ''}`}
              onClick={() => setVariantByCsp({ ...variantByCsp, [csp.key]: v.key })}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {csp.variants.length === 1 && (
        <div className={styles.variantRow}>
          <span className={`${styles.variantPill} ${styles.variantPillActive}`}>
            {csp.variants[0].label}
          </span>
        </div>
      )}
      <CloudArchitecture cloud={variant} />
    </div>
  );
}

/* ────────────────────── Multi-region diagram ────────────────────── */

function Region({
  name,
  brandIcon,
  primary,
  children,
}: {
  name: string;
  brandIcon: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.region} ${primary ? styles.regionPrimary : ''}`}>
      <div className={styles.regionHeader}>
        <Icon file={brandIcon} className={styles.regionIcon} />
        <span className={styles.regionName}>{name}</span>
        <span className={`${styles.badge} ${primary ? styles.badgeBlue : styles.badgeGreen}`}>
          {primary ? 'primary' : 'secondary'}
        </span>
      </div>
      {children}
    </div>
  );
}

const MULTI_REGION_SPECS = {
  aws: {
    label: 'AWS',
    cloud: 'aws-eks',
    brand: 'aws.svg',
    dns: { icon: 'aws-route53.svg', title: 'Route 53', subtitle: 'latency-based routing' },
    primaryRegion: 'us-east-1',
    secondaryRegion: 'eu-west-1',
  },
  gcp: {
    label: 'Google Cloud',
    cloud: 'gcp-gke',
    brand: 'google-cloud.svg',
    dns: { icon: 'gcp-cloud-dns.svg', title: 'Cloud DNS', subtitle: 'geolocation routing policy' },
    primaryRegion: 'us-central1',
    secondaryRegion: 'europe-west1',
  },
  azure: {
    label: 'Azure',
    cloud: 'azure-aks',
    brand: 'microsoft-azure.svg',
    dns: {
      icon: 'azure-traffic-manager-profiles.svg',
      title: 'Traffic Manager',
      subtitle: 'performance routing, or Front Door',
    },
    primaryRegion: 'East US',
    secondaryRegion: 'West Europe',
  },
} as const;

export function MultiRegionArchitecture() {
  const [csp, setCsp] = useState<keyof typeof MULTI_REGION_SPECS>('aws');
  const spec = MULTI_REGION_SPECS[csp];
  const services = CLOUD_SPECS[spec.cloud];
  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="group" aria-label="Cloud provider">
        {(Object.keys(MULTI_REGION_SPECS) as (keyof typeof MULTI_REGION_SPECS)[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === csp}
            className={`${styles.tab} ${k === csp ? styles.tabActive : ''}`}
            onClick={() => setCsp(k)}
          >
            <Icon file={MULTI_REGION_SPECS[k].brand} className={styles.tabIcon} />
            {MULTI_REGION_SPECS[k].label}
          </button>
        ))}
      </div>
      <figure className={`${styles.cloudCanvas} ${styles.regionalCanvas}`} aria-label={`${spec.label} multi-region reference architecture`}>
      <div className={`${styles.diagram} ${styles.cloudDiagram}`}>
        <Clients label="Clients, routed to the nearest region" />
        <ConnectorDown label="latency or geo DNS routing" />
        <Node icon={spec.dns.icon} title={spec.dns.title} subtitle={spec.dns.subtitle} accent="blue" />
        <Branch legs={2} />
        <div className={styles.regionsRow}>
          <Region name={spec.primaryRegion} brandIcon={spec.brand} primary>
            <Node icon={services.compute.icon} title={`LiteLLM on ${services.compute.title}`} subtitle="regional load balancer + pods" small />
            <div className={styles.dependencyStem} />
            <Dependencies items={[
              { ...services.data[1], subtitle: 'regional rate limits and cache' },
              { ...services.data[0], subtitle: 'the single shared primary database' },
            ]} />
          </Region>
          <Region name={spec.secondaryRegion} brandIcon={spec.brand}>
            <Node icon={services.compute.icon} title={`LiteLLM on ${services.compute.title}`} subtitle="regional load balancer + pods" small />
            <div className={styles.dependencyStem} />
            <Dependencies items={[
              { ...services.data[1], subtitle: 'regional rate limits and cache' },
              { ...services.data[0], subtitle: 'Optional read replica. Writes go to primary.' },
            ]} />
          </Region>
        </div>
      </div>
        <figcaption className={styles.regionalCaption}>
          Example using Kubernetes and managed data stores. All instances connect directly to the
          primary region's PostgreSQL database; the optional replica serves reads in the secondary
          region. Redis is a separate regional dependency.
        </figcaption>
      </figure>
        <div className={`${styles.callout} ${styles.calloutSuccess}`}>
          <span>
            One Enterprise license covers every region. Each instance validates the same
            LITELLM_LICENSE, and user / team limits are counted from the single shared database. All
            instances must also share the same LITELLM_MASTER_KEY and LITELLM_SALT_KEY.
          </span>
        </div>
    </div>
  );
}
