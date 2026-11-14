import React, {useId, useRef} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Cloud = 'aws' | 'azure' | 'gcp' | 'hybrid';
type Flow = 'management' | 'inference' | 'data' | 'egress';
type Point = [number, number];
type CloudLayout = {
  name: string;
  regions: [string, string, string];
  network: string;
  compute: string;
  computeIcon: string;
  ingress: string;
  ingressIcon: string;
  database: string[];
  databaseIcon: string;
  redis: string;
  redisIcon: string;
  access: string;
  peering: string;
};

const layouts: Record<Cloud, CloudLayout> = {
  aws: {
    name: 'AWS', regions: ['us-east-1', 'us-east-2', 'eu-west-1'],
    network: 'VPC', compute: 'EKS', computeIcon: 'aws-eks.svg',
    ingress: 'Internal ALB', ingressIcon: 'aws-alb.svg',
    database: ['Aurora PostgreSQL'], databaseIcon: 'aws-aurora.svg',
    redis: 'ElastiCache', redisIcon: 'aws-elasticache.svg',
    access: 'VPN / Direct Connect', peering: 'Inter-Region VPC peering',
  },
  azure: {
    name: 'Azure', regions: ['East US', 'Central US', 'West Europe'],
    network: 'VNet', compute: 'AKS', computeIcon: 'azure-kubernetes-services.svg',
    ingress: 'App Gateway', ingressIcon: 'azure-application-gateways.svg',
    database: ['PostgreSQL', 'Flexible Server'], databaseIcon: 'azure-azure-database-postgresql-server.svg',
    redis: 'Managed Redis', redisIcon: 'azure-cache-redis.svg',
    access: 'VPN / ExpressRoute', peering: 'Global VNet peering',
  },
  hybrid: {
    name: 'Hybrid cloud', regions: ['us-east-1', 'us-east-2', 'on-premises data center'],
    network: 'VPC', compute: 'EKS', computeIcon: 'aws-eks.svg',
    ingress: 'Internal ALB', ingressIcon: 'aws-alb.svg',
    database: ['Aurora PostgreSQL'], databaseIcon: 'aws-aurora.svg',
    redis: 'ElastiCache', redisIcon: 'aws-elasticache.svg',
    access: 'VPN / Direct Connect', peering: 'VPC peering and Site-to-Site VPN',
  },
  gcp: {
    name: 'Google Cloud', regions: ['us-central1', 'us-east4', 'europe-west1'],
    network: 'VPC (global)', compute: 'GKE', computeIcon: 'gcp-google-kubernetes-engine.svg',
    ingress: 'Internal ALB', ingressIcon: 'gcp-cloud-load-balancing.svg',
    database: ['Cloud SQL', 'PostgreSQL'], databaseIcon: 'gcp-cloud-sql.svg',
    redis: 'Memorystore', redisIcon: 'gcp-memorystore.svg',
    access: 'Cloud VPN / Interconnect', peering: 'VPC Network Peering',
  },
};

function Lines({x, y, lines, className}: {x: number; y: number; lines: string[]; className: string}) {
  return <text x={x} y={y} textAnchor="middle" className={className}>
    {lines.map((line, index) => <tspan key={line} x={x} dy={index ? 17 : 0}>{line}</tspan>)}
  </text>;
}

function Group({x, y, width, height, label, kind = 'boundary'}: {
  x: number; y: number; width: number; height: number; label: string | string[];
  kind?: 'boundary' | 'region' | 'network' | 'subnet' | 'external';
}) {
  return <g data-boundary={kind}>
    <rect x={x} y={y} width={width} height={height} className={styles[kind]} />
    <text x={x + 12} y={y + 20} className={styles.groupLabel}>{(Array.isArray(label) ? label : [label]).map((part, index) => <tspan key={part} x={x + 12} dy={index ? 15 : 0}>{part}</tspan>)}</text>
  </g>;
}

function Icon({x, y, icon, size = 38}: {x: number; y: number; icon: string; size?: number}) {
  const root = useBaseUrl('/img/cloud_icons/');
  if (icon === 'private-ingress') return <g transform={`translate(${x - size / 2} ${y - size / 2})`} className={styles.symbol}>
    <rect x={3} y={7} width={size - 6} height={size - 14} rx={3} />
    <path d={`M8 ${size / 2}h${size - 16}m-6-5 5 5-5 5`} />
  </g>;
  return <image href={`${root}${icon}`} x={x - size / 2} y={y - size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;
}

function Service({x, y, icon, lines}: {x: number; y: number; icon: string; lines: string[]}) {
  return <g data-service={lines.join(' ')}>
    <Icon x={x} y={y} icon={icon} />
    <Lines x={x} y={y + 36} lines={lines} className={styles.nodeLabel} />
  </g>;
}

function Client({x, label}: {x: number; label: string}) {
  return <g>
    <g transform={`translate(${x - 12} 39)`} className={styles.symbol}>
      <rect x="0" y="0" width="24" height="16" rx="2" />
      <path d="M8 21h8m-4-5v5" />
    </g>
    <Lines x={x} y={75} lines={[label]} className={styles.clientLabel} />
  </g>;
}

function ExternalService({x, kind, label}: {x: number; kind: 'audit' | 'identity'; label: string}) {
  return <g>
    <g transform={`translate(${x - 16} 431)`} className={styles.symbol}>
      {kind === 'audit' ? <><rect x="3" y="0" width="26" height="32" rx="2" /><path d="M9 8h14M9 15h14M9 22h10" /></>
        : <><path d="M16 0 30 6v12c0 8-14 16-14 16S2 26 2 18V6Z" /><circle cx="16" cy="12" r="4" /><path d="M9 25c0-9 14-9 14 0" /></>}
    </g>
    <Lines x={x} y={487} lines={[label]} className={styles.nodeLabel} />
  </g>;
}

function ArchitectureSvg({cloud}: {cloud: Cloud}) {
  const layout = layouts[cloud];
  const id = useId().replace(/:/g, '');
  const isGcp = cloud === 'gcp';
  const isAzure = cloud === 'azure';
  const isHybrid = cloud === 'hybrid';
  const scopeLabel = isGcp ? 'Google Cloud project' : isAzure ? 'Azure subscription' : 'AWS account';
  const line = (points: Point[], kind: Flow, arrow = true) => <path
    d={points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ')}
    className={`${styles.flow} ${styles[kind]}`} fill="none"
    markerEnd={arrow ? `url(#${id}-${kind})` : undefined}
  />;
  const title = `${layout.name}: Global Control Plane`;
  return <svg viewBox="0 0 1200 610" className={styles.svg} role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-desc`}>
      Corporate administrators reach one control plane through private ingress in {layout.regions[0]}.
      The control plane sends management requests over {layout.peering} to independent LiteLLM dataplanes in {layout.regions[1]} and {layout.regions[2]}.
      Metadata and usage responses return through the same path. Each dataplane has separate private frontends for inference and management.
      Applications call the inference frontend. Only the control plane can reach the management frontend. The paired ingress icons represent these two frontends.
      Each dataplane has its own PostgreSQL and Redis. The control plane has no database or Redis.
      {isHybrid ? 'The control plane and AWS dataplane share one AWS account. The on-premises dataplane runs Kubernetes in the corporate data center. AWS Site-to-Site VPN carries private management HTTPS over an encrypted IPsec tunnel.' : `The control plane and both dataplanes share one ${scopeLabel}.`}
      {isGcp ? 'The project contains separate global VPCs with regional private, frontend, and proxy-only subnets. Data services use private service connections outside the deployment VPC.' : ''}
      {isAzure ? 'Managed PostgreSQL and Redis sit outside the deployment VNet and connect through private endpoints.' : ''}
      The control plane uses outbound HTTPS for audit export and optional OIDC discovery and token exchange.
      When a dataplane uses OIDC token exchange authentication, it fetches signing keys from the identity provider over HTTPS.
      Dataplanes initiate the JWKS requests. Control-plane OIDC login can also use service tokens to authenticate to dataplanes, without this JWKS path.
    </desc>
    <defs>{(['management', 'inference', 'data', 'egress'] as Flow[]).map(kind => <marker key={kind} id={`${id}-${kind}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0 0 7 3.5 0 7Z" className={styles[`${kind}Arrow`]} />
    </marker>)}</defs>

    <Group x={20} y={8} width={1160} height={77} label={`Corporate network · ${layout.access}`} kind="external" />
    <Client x={265} label="Admins / automation" />
    <Client x={isGcp ? 680 : 650} label="Applications: region A" />
    <Client x={isGcp ? 1110 : 1080} label={isHybrid ? "Applications: on-premises" : "Applications: region B"} />

    <g data-boundary="account">
      <path d={`M20 100H${isHybrid ? 755 : 1185}V600H350V${isHybrid ? 365 : 355}H20Z`} className={styles.boundary} />
      <text x={32} y={120} className={styles.groupLabel}>{scopeLabel}</text>
    </g>
    {isHybrid && <Group x={800} y={100} width={385} height={500} label="Corporate data center" />}

    <Group x={30} y={132} width={300} height={203} label={isGcp ? `Management ${layout.network}` : layout.regions[0]} kind={isGcp ? 'network' : 'region'} />
    <Group x={40} y={164} width={280} height={161} label={isGcp ? layout.regions[0] : `Management ${layout.network}`} kind={isGcp ? 'region' : 'network'} />
    <Group x={50} y={196} width={260} height={120} label={isGcp ? 'Private + proxy-only subnets' : 'Private subnets'} kind="subnet" />
    <Group x={20} y={370} width={320} height={165} label="External services" kind="external" />

    {[0, 1].map(index => {
      const x = 370 + index * 430;
      const letter = index ? 'B' : 'A';
      const onPremises = isHybrid && index === 1;
      return <g key={letter}>
        <Group x={x + 10} y={132} width={365} height={isGcp ? 203 : 393} label={onPremises ? 'Production network' : isGcp ? `Dataplane ${letter} ${layout.network}` : layout.regions[index + 1]} kind={isGcp || onPremises ? 'network' : 'region'} />
        <Group x={x + 20} y={164} width={345} height={isGcp ? 161 : isAzure ? 249 : 350} label={onPremises ? 'Dataplane B' : isGcp ? layout.regions[index + 1] : `Dataplane ${letter} ${layout.network}`} kind={onPremises ? 'boundary' : isGcp ? 'region' : 'network'} />
        {isGcp ? <>
          <Group x={x + 30} y={196} width={140} height={120} label={['Private GKE', 'subnet']} kind="subnet" />
          <Group x={x + 175} y={196} width={85} height={120} label={['Proxy-only', 'subnet']} kind="subnet" />
          <Group x={x + 265} y={196} width={90} height={120} label={['Frontend', 'subnet']} kind="subnet" />
          <Group x={x + 30} y={345} width={325} height={155} label={`Managed services · ${layout.regions[index + 1]}`} kind="external" />
        </> : <>
          <Group x={x + 30} y={196} width={155} height={120} label={onPremises ? 'Kubernetes subnet' : `Private ${layout.compute} subnet`} kind="subnet" />
          <Group x={x + 195} y={196} width={160} height={120} label={isAzure ? 'Gateway subnet' : 'Private ingress'} kind="subnet" />
          {(cloud === 'aws' || isHybrid) && <Group x={x + 30} y={335} width={325} height={165} label="Private data subnets" kind="subnet" />}
        </>}
      </g>;
    })}

    {line([[265, 84], [265, 228]], 'management')}
    {line([[243, 250], [152, 250]], 'management')}
    {isHybrid ? <>
      {line([[152, 240], [190, 240], [190, 340], [360, 340], [360, 515], [740, 515]], 'management', false)}
      {line([[190, 320], [298, 320]], 'management')}
      {line([[342, 320], [370, 320], [370, 565], [778, 565]], 'management')}
      {line([[822, 565], [1170, 565]], 'management', false)}
      <circle cx={190} cy={320} r={3} className={styles.managementArrow} />
      <text x={550} y={535} textAnchor="middle" className={styles.peeringLabel}>VPC peering · HTTPS 443</text>
      <text x={570} y={555} textAnchor="middle" className={styles.peeringLabel}>AWS Site-to-Site VPN · IPsec</text>
      <text x={1010} y={555} textAnchor="middle" className={styles.peeringLabel}>Management HTTPS 443</text>
    </> : <>
      {line([[152, 240], [190, 240], [190, 340], [360, 340], [360, 565], [1170, 565]], 'management', false)}
      <text x={600} y={555} textAnchor="middle" className={styles.flowLabel}>Management HTTPS 443</text>
      <text x={600} y={591} textAnchor="middle" className={styles.peeringLabel}>{layout.peering}</text>
    </>}
    {line([[108, 260], [80, 260], [80, 350], [330, 350], [330, 411], [100, 411]], 'egress', false)}
    {line([[100, 411], [100, 426]], 'egress')}
    {line([[260, 411], [260, 426]], 'egress')}
    <text x={isHybrid ? 50 : 210} y={361} className={styles.egressLabel}>HTTPS egress</text>

    {[0, 1].map(index => {
      const offset = index * 430;
      const ingressX = (isGcp ? 680 : 650) + offset;
      const onPremises = isHybrid && index === 1;
      return <g key={index}>
        {line([[ingressX, 84], [ingressX, 228]], 'inference')}
        {isGcp ? <>
          {line([[658 + offset, 250], [603 + offset, 250]], 'inference')}
          {line([[658 + offset, 240], [603 + offset, 240]], 'management')}
          {line([[567 + offset, 250], [492 + offset, 250]], 'inference')}
          {line([[567 + offset, 240], [492 + offset, 240]], 'management')}
        </> : <>
          {line([[628 + offset, 250], [507 + offset, 250]], 'inference')}
          {line([[628 + offset, 240], [507 + offset, 240]], 'management')}
        </>}
        {line([[740 + offset, isHybrid && !onPremises ? 515 : 565], [740 + offset, 250], [ingressX + 22, 250]], 'management')}
        <circle cx={740 + offset} cy={isHybrid && !onPremises ? 515 : 565} r={3} className={styles.managementArrow} />
        {isAzure ? <>
          {line([[507 + offset, 260], [560 + offset, 260], [560 + offset, 346]], 'data')}
          {line([[582 + offset, 368], [700 + offset, 368], [700 + offset, 422], [480 + offset, 422], [480 + offset, 443]], 'data')}
          {line([[645 + offset, 422], [645 + offset, 443]], 'data')}
        </> : <>
          {line(isGcp ? [[492 + offset, 260], [535 + offset, 260], [535 + offset, 327], [730 + offset, 327], [730 + offset, 375], [480 + offset, 375]] : [[507 + offset, 260], [560 + offset, 260], [560 + offset, 375], [480 + offset, 375]], 'data', false)}
          {line([[480 + offset, 375], [480 + offset, 388]], 'data')}
          {line([[645 + offset, 375], [645 + offset, 388]], 'data')}
          {!isGcp && line([[560 + offset, 375], [645 + offset, 375]], 'data', false)}
        </>}
        <Service x={(isGcp ? 470 : 485) + offset} y={250} icon={onPremises ? 'kubernetes.svg' : layout.computeIcon} lines={['LiteLLM dataplane', onPremises ? 'Kubernetes' : layout.compute]} />
        <g data-service="Separate private inference and management frontends">
          <Icon x={ingressX - 9} y={245} size={28} icon={onPremises ? 'private-ingress' : layout.ingressIcon} />
          <Icon x={ingressX + 9} y={255} size={28} icon={onPremises ? 'private-ingress' : layout.ingressIcon} />
          <Lines x={ingressX} y={286} lines={[onPremises ? 'Private ingresses' : isAzure ? 'App Gateways' : 'Internal ALBs', 'LLM / mgmt']} className={styles.nodeLabel} />
        </g>
        {isAzure && <Service x={560 + offset} y={368} icon="azure-private-endpoint.svg" lines={['Private endpoints']} />}
        {isGcp && <>
          <Icon x={585 + offset} y={250} size={26} icon="gcp-networking.svg" />
          <Lines x={585 + offset} y={286} lines={['LB proxies']} className={styles.noteLabel} />
        </>}
        <Service x={480 + offset} y={isAzure ? 465 : 410} icon={onPremises ? 'postgresql.svg' : layout.databaseIcon} lines={onPremises ? ['PostgreSQL'] : layout.database} />
        <Service x={645 + offset} y={isAzure ? 465 : 410} icon={onPremises ? 'redis.svg' : layout.redisIcon} lines={onPremises ? ['Redis'] : isAzure ? [layout.redis] : [layout.redis, 'Redis']} />
        {isGcp && <text x={560 + offset} y={487} textAnchor="middle" className={styles.noteLabel}>Private Services Access</text>}
      </g>;
    })}

    {isHybrid && <>
      <Icon x={320} y={320} icon="aws-vpn-gateway.svg" />
      <Lines x={320} y={356} lines={['Virtual private gateway']} className={styles.nodeLabel} />
      <Icon x={800} y={565} icon="aws-customer-gateway.svg" />
      <Lines x={800} y={540} lines={['VPN router']} className={styles.nodeLabel} />
    </>}
    <Service x={130} y={250} icon={layout.computeIcon} lines={['Control plane', `${layout.compute} · 1 replica`]} />
    <Service x={265} y={250} icon={layout.ingressIcon} lines={[layout.ingress, 'HTTPS 443']} />
    <g data-flow="dataplane-jwks" aria-label="Dataplanes fetch IdP signing keys when they use OIDC token exchange">
      {[0, 1].map(index => {
        const offset = index * 430;
        const sourceX = (isGcp ? 470 : 485) + offset;
        const laneX = 375 + offset;
        return <g key={index}>
          {line([[sourceX - 22, 260], [laneX, 260], [laneX, 90]], 'egress', false)}
          <path d={`M${sourceX - 45} 256l-7 4 7 4Z`} className={styles.egressArrow} />
          <circle cx={laneX} cy={90} r={3} className={styles.egressArrow} />
        </g>;
      })}
      {[265, isGcp ? 680 : 650].map(x => <path key={x} d={`M${x + 7} 90Q${x} 100 ${x - 7} 90`} className={styles.crossingGap} />)}
      <path
        d={`M805 90H${(isGcp ? 680 : 650) + 7}Q${isGcp ? 680 : 650} 100 ${(isGcp ? 680 : 650) - 7} 90H272Q265 100 258 90H10V530H345V447H282`}
        className={`${styles.flow} ${styles.egress}`} fill="none" markerEnd={`url(#${id}-egress)`}
      />
      <Lines x={180} y={507} lines={['JWKS · HTTPS 443', 'With OIDC token exchange']} className={styles.egressLabel} />
    </g>
    <Lines x={245} y={400} lines={['OIDC discovery / exchange']} className={styles.egressLabel} />
    <ExternalService x={100} kind="audit" label="Audit sink" />
    <ExternalService x={260} kind="identity" label="IdP (optional)" />
  </svg>;
}

function Legend() {
  return <div className={styles.legend} aria-label="Diagram legend">
    <span><i className={styles.managementKey} />Management</span>
    <span><i className={styles.inferenceKey} />Inference</span>
    <span><i className={styles.dataKey} />Private data</span>
    <span><i className={styles.egressKey} />Outbound HTTPS</span>
  </div>;
}

export function GlobalControlPlaneArchitecture({cloud}: {cloud: Cloud}) {
  const title = `${layouts[cloud].name}: Global Control Plane`;
  const captionId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return <figure className={styles.figure} aria-labelledby={captionId}>
    <figcaption className={styles.toolbar}>
      <strong id={captionId}>{title}</strong>
      <button className={styles.button} type="button" onClick={() => dialog.current?.showModal()}>Expand diagram</button>
    </figcaption>
    <Legend />
    <div className={styles.viewport} tabIndex={0} role="region" aria-label={`${title}, diagram preview`}><ArchitectureSvg cloud={cloud} /></div>
    <dialog ref={dialog} className={styles.dialog} aria-label={title} onClick={event => {if (event.target === event.currentTarget) dialog.current?.close();}}>
      <div className={styles.toolbar}>
        <strong>{title}</strong>
        <button className={styles.button} type="button" autoFocus onClick={() => dialog.current?.close()}>Close diagram</button>
      </div>
      <Legend />
      <div className={styles.expandedViewport} tabIndex={0} role="region" aria-label="Expanded control plane diagram"><ArchitectureSvg cloud={cloud} /></div>
    </dialog>
  </figure>;
}
