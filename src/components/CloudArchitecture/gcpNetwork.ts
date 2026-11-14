import type { CloudKey, NetworkDiagram } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp';
const NETWORK_ICON = 'gcp-networking.svg';
const PRIVATE_LB_GUIDE = 'https://docs.cloud.google.com/load-balancing/docs/l7-internal/setting-up-l7-internal-serverless';

function cloudRunDiagram(): NetworkDiagram {
  return {
    title: 'Google Cloud Run: private deployment',
    description: 'Corporate clients use an internal load balancer. Cloud Run stays outside the customer VPC. Its connector reaches private data stores and Cloud NAT.',
    provider: 'gcp', width: 1560, height: 650,
    groups: [
      { id: 'project', x: 350, y: 20, width: 1190, height: 610, label: 'Google Cloud', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'vpc', x: 370, y: 65, width: 600, height: 545, label: 'Customer VPC', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'frontend-subnet', x: 390, y: 110, width: 230, height: 220, label: 'Frontend subnet', kind: 'private' },
      { id: 'proxy-subnet', x: 650, y: 110, width: 290, height: 220, label: 'Proxy-only subnet', kind: 'subnet' },
      { id: 'cloud-run-region', x: 1010, y: 110, width: 500, height: 300, label: 'Serverless backends', kind: 'managed' },
      { id: 'connector-subnet', x: 650, y: 380, width: 290, height: 190, label: 'Connector', kind: 'subnet' },
      { id: 'nat-config', x: 390, y: 380, width: 230, height: 190, label: 'NAT egress', kind: 'managed' },
      { id: 'producer-network', x: 1010, y: 420, width: 500, height: 190, label: 'Data services', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 85, y: 230, title: ['Employees / apps'] },
      { id: 'private-access', x: 250, y: 230, title: ['Private access'], detail: ['VPN / Interconnect'] },
      { id: 'load-balancer', x: 500, y: 230, icon: 'gcp-cloud-load-balancing.svg', title: ['Internal ALB'], detail: ['HTTPS 443'] },
      { id: 'lb-proxies', x: 790, y: 230, icon: NETWORK_ICON, title: ['LB proxies'] },
      { id: 'serverless-neg', x: 1090, y: 230, icon: NETWORK_ICON, title: ['Serverless NEGs'] },
      { id: 'gateway-backend', x: 1360, y: 230, icon: 'gcp-cloud-run.svg', title: ['Gateway / backend'], detail: ['4000 / 4001'] },
      { id: 'ui', x: 1360, y: 340, icon: 'gcp-cloud-run.svg', title: ['UI'], detail: ['3000'] },
      { id: 'migrations', x: 1150, y: 340, icon: 'gcp-cloud-run.svg', title: ['Migrations'] },
      { id: 'connector', x: 790, y: 450, icon: NETWORK_ICON, title: ['VPC connector'], detail: ['ALL_TRAFFIC'] },
      { id: 'nat', x: 500, y: 450, icon: NETWORK_ICON, title: ['Cloud NAT'] },
      { id: 'postgres', x: 1160, y: 520, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL'], detail: ['5432, HA'] },
      { id: 'redis', x: 1390, y: 520, icon: 'gcp-memorystore.svg', title: ['Memorystore'], detail: ['TLS'] },
      { id: 'public-providers', x: 170, y: 500, title: ['Public LLM APIs'], detail: ['HTTPS egress'] },
    ],
    edges: [
      { points: [[107, 230], [228, 230]], kind: 'request' },
      { points: [[272, 230], [478, 230]], kind: 'request' },
      { points: [[522, 230], [768, 230]], kind: 'request' },
      { points: [[812, 230], [1068, 230]], kind: 'request' },
      { points: [[1112, 230], [1338, 230]], kind: 'request' },
      { points: [[1090, 285], [1090, 300], [1360, 300], [1360, 318]], kind: 'request' },
      { points: [[1360, 208], [1360, 90], [980, 90], [980, 365], [790, 365], [790, 428]], kind: 'data' },
      { points: [[1128, 340], [980, 340]], kind: 'data', arrow: false },
      { points: [[812, 450], [980, 450], [980, 475], [1390, 475]], kind: 'data', arrow: false, label: 'Private Services Access', labelX: 1050, labelY: 462 },
      { points: [[1160, 475], [1160, 498]], kind: 'data' },
      { points: [[1390, 475], [1390, 498]], kind: 'data' },
      { points: [[768, 450], [522, 450]], kind: 'egress' },
      { points: [[478, 450], [320, 450], [320, 500], [192, 500]], kind: 'egress' },
    ],
    junctions: [
      { x: 980, y: 340, kind: 'data' },
      { x: 1160, y: 475, kind: 'data' },
    ],
    notes: [
      { title: 'Required module changes', text: 'The module creates a global external load balancer. Replace it with regional INTERNAL_MANAGED resources, a private frontend address, and a REGIONAL_MANAGED_PROXY subnet. Keep the three serverless NEGs and path routes. Use regional TLS certificates. Set every Cloud Run service to INGRESS_TRAFFIC_INTERNAL_ONLY. The cloud guide lists the resource changes.' },
      { title: 'Corporate access', text: 'Connect corporate clients through Cloud VPN, Interconnect, or an approved private access service. Publish private DNS. Keep regional clients in the load balancer region or configure global access. Add identity checks and keep LiteLLM key permissions. Remove the public load balancer and unused Cloud Run domain mappings.' },
      { title: 'One image', text: 'The gateway, backend, UI, and migration job use the same image with a different startup argument for each component.' },
      { title: 'Separate ingress and egress', text: 'Serverless NEGs carry inbound requests through Google-managed routes. They do not use the VPC connector. Gateway, backend, and migration egress uses the connector. Cloud Run stays outside the customer VPC. Cloud SQL and Memorystore use Private Services Access to reach Google-managed producer networks.' },
      { title: 'NAT egress changes', text: 'The module does not create Cloud NAT or Cloud Router and sets PRIVATE_RANGES_ONLY. Create Cloud Router and Cloud NAT for the connector subnet. Set connector egress to ALL_TRAFFIC. Cloud Router configures NAT. Traffic does not pass through Cloud Router.' },
    ],
    sources: [
      { label: 'Module load balancer defaults', url: `${MODULE}/load_balancer.tf` },
      { label: 'Module Cloud Run defaults', url: `${MODULE}/cloudrun.tf` },
      { label: 'Internal load balancer with Cloud Run', url: PRIVATE_LB_GUIDE },
      { label: 'Cloud Run ingress controls', url: 'https://docs.cloud.google.com/run/docs/securing/ingress' },
      { label: 'Connector egress', url: 'https://docs.cloud.google.com/run/docs/configuring/vpc-connectors' },
    ],
  };
}

function gkeDiagram(microservices: boolean): NetworkDiagram {
  return {
    title: `Google GKE: ${microservices ? 'separate services' : 'single service'}`,
    description: 'Corporate clients use an internal load balancer. GKE workloads reach private data stores through peering. Cloud NAT handles public provider requests.',
    provider: 'gcp', width: 1560, height: 650,
    groups: [
      { id: 'project', x: 350, y: 20, width: 1190, height: 610, label: 'Google Cloud', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'vpc', x: 370, y: 65, width: 900, height: 545, label: 'Customer VPC', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'frontend-subnet', x: 390, y: 110, width: 200, height: 180, label: 'Frontend subnet', kind: 'private' },
      { id: 'proxy-subnet', x: 610, y: 110, width: 210, height: 180, label: 'Proxy-only subnet', kind: 'subnet' },
      { id: 'private-subnet', x: 840, y: 110, width: 400, height: 220, label: 'Private GKE subnet', kind: 'private' },
      { id: 'cluster', x: 860, y: 155, width: 360, height: 150, label: 'GKE cluster', kind: 'managed' },
      { id: 'nat-config', x: 390, y: 400, width: 220, height: 190, label: 'NAT egress', kind: 'managed' },
      { id: 'peering', x: 840, y: 400, width: 400, height: 190, label: 'Private peering', kind: 'managed' },
      { id: 'producer-network', x: 1300, y: 110, width: 220, height: 480, label: 'Data services', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 85, y: 210, title: ['Employees / apps'] },
      { id: 'private-access', x: 250, y: 210, title: ['Private access'], detail: ['VPN / Interconnect'] },
      { id: 'load-balancer', x: 490, y: 210, icon: 'gcp-cloud-load-balancing.svg', title: ['Internal ALB'], detail: ['HTTPS 443'] },
      { id: 'lb-proxies', x: 715, y: 210, icon: NETWORK_ICON, title: ['LB proxies'] },
      { id: 'workloads', x: 1040, y: 210, icon: 'gcp-google-kubernetes-engine.svg', title: ['LiteLLM pods'], detail: [microservices ? 'Gateway / backend / UI' : 'Proxy replicas'] },
      { id: 'nat', x: 510, y: 490, icon: NETWORK_ICON, title: ['Cloud NAT'] },
      { id: 'psa', x: 1040, y: 490, icon: NETWORK_ICON, title: ['Private Services Access'] },
      { id: 'postgres', x: 1410, y: 210, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL'], detail: ['5432, private IP'] },
      { id: 'redis', x: 1410, y: 490, icon: 'gcp-memorystore.svg', title: ['Memorystore'], detail: ['TLS, private IP'] },
      { id: 'public-providers', x: 170, y: 490, title: ['Public LLM APIs'], detail: ['HTTPS egress'] },
    ],
    edges: [
      { points: [[107, 210], [228, 210]], kind: 'request' },
      { points: [[272, 210], [468, 210]], kind: 'request' },
      { points: [[512, 210], [693, 210]], kind: 'request' },
      { points: [[737, 210], [1018, 210]], kind: 'request' },
      { points: [[1062, 210], [1248, 210], [1248, 380], [1040, 380], [1040, 468]], kind: 'data' },
      { points: [[1062, 490], [1290, 490], [1290, 210], [1388, 210]], kind: 'data' },
      { points: [[1290, 490], [1388, 490]], kind: 'data' },
      { points: [[1040, 280], [1040, 350], [510, 350], [510, 468]], kind: 'egress' },
      { points: [[488, 490], [192, 490]], kind: 'egress' },
    ],
    junctions: [
      { x: 1290, y: 490, kind: 'data' },
    ],
    notes: [
      { title: 'Corporate access', text: 'Use Cloud VPN, Interconnect, or an approved private access service and private DNS. Create a regional internal Application Load Balancer with a private frontend and proxy-only subnet. Restrict access to corporate clients. Configure global access if clients connect from another region.' },
      { title: 'One Helm chart', text: `The litellm chart uses one image for all components. ${microservices ? 'This layout uses monolith.enabled=false.' : 'Set monolith.enabled=true. Use gateway values to configure the single service.'}` },
      { title: 'GKE ingress', text: 'Use internal GKE Ingress with the gce-internal class or the gke-l7-rilb GatewayClass. The controller creates zonal NEG backends. Allow the required proxy-only subnet and health-check traffic to pods. Keep nodes and the cluster endpoint private. Create these resources around the Helm workloads.' },
      { title: 'Private node egress', text: 'Configure Cloud NAT for the node and pod ranges that need public provider APIs or registries. Private Google Access serves supported Google APIs. Keep private database routes separate from NAT.' },
      { title: 'Terraform data stores', text: 'Set create_runtime=false to create data stores with the Google module. This skips Cloud Run, its load balancer, VPC connector, and migration job. Create GKE and configure its network separately.' },
    ],
    sources: [
      { label: 'LiteLLM chart and layouts', url: 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/README.md' },
      { label: 'GKE internal Ingress', url: 'https://docs.cloud.google.com/kubernetes-engine/docs/how-to/internal-load-balance-ingress' },
      { label: 'GKE Gateway deployment', url: 'https://docs.cloud.google.com/kubernetes-engine/docs/how-to/deploying-gateways' },
      { label: 'Internal load balancer client access', url: 'https://docs.cloud.google.com/load-balancing/docs/l7-internal#client-access' },
      { label: 'Private Services Access', url: 'https://docs.cloud.google.com/vpc/docs/private-services-access' },
      { label: 'Terraform data stores', url: `${MODULE}/README.md#dependencies-only-run-litellm-on-gke` },
    ],
  };
}

export function makeGcpNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  return cloud === 'gcp-cloud-run' ? cloudRunDiagram() : gkeDiagram(cloud === 'gcp-gke-micro');
}
