import type { CloudKey, NetworkDiagram, NetworkEdge, NetworkNode } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp';
const NETWORK_ICON = 'gcp-networking.svg';
const PRIVATE_LB_GUIDE = 'https://docs.cloud.google.com/load-balancing/docs/l7-internal/setting-up-l7-internal-serverless';

function cloudRunDiagram(): NetworkDiagram {
  return {
    title: 'Google Cloud Run: private deployment',
    description: 'Corporate clients reach a regional internal Application Load Balancer through private network access. This architecture requires changes to the Terraform module. Cloud Run stays outside the customer VPC. Provider calls use Cloud NAT.',
    provider: 'gcp',
    width: 1200,
    height: 1420,
    groups: [
      { id: 'project', x: 20, y: 140, width: 1160, height: 1140, label: 'Google Cloud', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'vpc', x: 550, y: 200, width: 600, height: 820, label: 'Customer project VPC', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'frontend-subnet', x: 575, y: 255, width: 550, height: 175, label: 'Frontend subnet', kind: 'private' },
      { id: 'proxy-subnet', x: 575, y: 450, width: 550, height: 140, label: 'Proxy-only subnet', kind: 'subnet' },
      { id: 'cloud-run-region', x: 50, y: 560, width: 465, height: 400, label: 'Cloud Run', kind: 'managed', icon: 'gcp-cloud-run.svg' },
      { id: 'connector-subnet', x: 575, y: 605, width: 260, height: 175, label: 'Connector subnet', kind: 'subnet' },
      { id: 'nat-config', x: 855, y: 605, width: 275, height: 175, label: 'Regional egress', kind: 'managed' },
      { id: 'producer-network', x: 550, y: 1060, width: 600, height: 190, label: 'Data services', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 180, y: 40, title: ['Corporate users', 'and applications'], detail: ['Private DNS'] },
      { id: 'private-access', x: 650, y: 40, title: ['Private network access'], detail: ['Cloud VPN / Interconnect', 'or approved access service'] },
      { id: 'load-balancer', x: 700, y: 330, icon: 'gcp-cloud-load-balancing.svg', title: ['Internal Application LB'], detail: ['Regional HTTPS frontend', 'Private IP from this subnet'] },
      { id: 'lb-proxies', x: 700, y: 505, icon: NETWORK_ICON, title: ['Managed LB proxies'], detail: ['REGIONAL_MANAGED_PROXY'] },
      { id: 'gateway-neg', x: 130, y: 440, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['gateway paths'] },
      { id: 'backend-neg', x: 285, y: 440, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['management paths'] },
      { id: 'ui-neg', x: 435, y: 440, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['UI paths'] },
      { id: 'gateway', x: 130, y: 650, icon: 'gcp-cloud-run.svg', title: ['Gateway'], detail: [':4000, inference'] },
      { id: 'backend', x: 285, y: 650, icon: 'gcp-cloud-run.svg', title: ['Backend'], detail: [':4001, management'] },
      { id: 'ui', x: 435, y: 650, icon: 'gcp-cloud-run.svg', title: ['UI'], detail: [':3000, browser assets'] },
      { id: 'migrations', x: 285, y: 835, icon: 'gcp-cloud-run.svg', title: ['Migration job'], detail: ['Private database connection'] },
      { id: 'connector', x: 700, y: 680, icon: NETWORK_ICON, title: ['Serverless VPC Access'], detail: ['ALL_TRAFFIC egress'] },
      { id: 'nat', x: 1000, y: 680, icon: NETWORK_ICON, title: ['Cloud NAT'], detail: ['Cloud Router configuration', 'Outbound requests only'] },
      { id: 'psa', x: 700, y: 900, icon: NETWORK_ICON, title: ['Private Services Access'], detail: ['Allocated peering range'] },
      { id: 'postgres', x: 700, y: 1120, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL PostgreSQL'], detail: ['HA writer + read replica', 'Private IP only'] },
      { id: 'redis', x: 1000, y: 1120, icon: 'gcp-memorystore.svg', title: ['Memorystore Redis'], detail: ['Standard HA, TLS', 'Private Services Access'] },
      { id: 'public-providers', x: 260, y: 1330, title: ['Public LLM APIs'], detail: ['HTTPS egress only'] },
    ],
    edges: [
      { points: [[202, 40], [628, 40]], kind: 'request' },
      { points: [[672, 40], [900, 40], [900, 330], [722, 330]], kind: 'request' },
      { points: [[700, 420], [700, 440], [840, 440], [840, 505], [722, 505]], kind: 'request' },
      { points: [[678, 505], [530, 505], [530, 390], [130, 390]], kind: 'request', arrow: false },
      { points: [[130, 390], [130, 418]], kind: 'request' },
      { points: [[285, 390], [285, 418]], kind: 'request' },
      { points: [[435, 390], [435, 418]], kind: 'request' },
      { points: [[130, 512], [40, 512], [40, 610], [130, 610], [130, 628]], kind: 'request' },
      { points: [[285, 512], [285, 628]], kind: 'request' },
      { points: [[435, 512], [435, 628]], kind: 'request' },
      { points: [[130, 725], [130, 760], [530, 760]], kind: 'data', arrow: false, label: 'Outbound from Cloud Run', labelX: 320, labelY: 750 },
      { points: [[285, 725], [285, 760]], kind: 'data', arrow: false },
      { points: [[307, 835], [530, 835], [530, 680], [678, 680]], kind: 'data' },
      { points: [[700, 770], [700, 878]], kind: 'data', label: 'Private IPs', labelX: 760, labelY: 830 },
      { points: [[700, 980], [700, 1030], [1000, 1030]], kind: 'data', arrow: false, label: 'Private peering', labelX: 845, labelY: 1048 },
      { points: [[700, 1030], [700, 1098]], kind: 'data' },
      { points: [[1000, 1030], [1000, 1098]], kind: 'data' },
      { points: [[722, 680], [978, 680]], kind: 'egress', label: 'Public API traffic', labelX: 850, labelY: 667 },
      { points: [[1022, 680], [1165, 680], [1165, 1330], [282, 1330]], kind: 'egress', label: 'NAT egress', labelX: 760, labelY: 1310 },
    ],
    junctions: [
      { x: 285, y: 390, kind: 'request' },
      { x: 435, y: 390, kind: 'request' },
      { x: 285, y: 760, kind: 'data' },
      { x: 530, y: 760, kind: 'data' },
      { x: 700, y: 1030, kind: 'data' },
    ],
    annotations: [
      { x: 435, y: 735, lines: ['No VPC connector'], anchor: 'middle' },
      { x: 285, y: 945, lines: ['Internal ingress on all three services'], anchor: 'middle' },
      { x: 980, y: 505, lines: ['Reserved for LB proxies', 'No frontend IP here'], anchor: 'middle' },
      { x: 285, y: 245, lines: ['Private deployment', 'Update the source module before deployment'], anchor: 'middle' },
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
  const positions = [225, 425, 625];
  const names = microservices ? ['Gateway', 'Backend', 'UI'] : ['LiteLLM replica', 'LiteLLM replica', 'LiteLLM replica'];
  const details = microservices ? [':4000, inference', ':4001, management', ':3000, browser assets'] : [':4000', ':4000', ':4000'];
  const workloads: NetworkNode[] = positions.map((x, index) => ({
    id: `workload-${index}`, x, y: 770, icon: 'gcp-google-kubernetes-engine.svg', title: [names[index]], detail: [details[index]],
  }));
  const requestEdges: NetworkEdge[] = positions.map(x => ({ points: [[x, 725], [x, 748]], kind: 'request' }));
  const dataEdges: NetworkEdge[] = positions.filter((_, index) => !microservices || index < 2).map(x => ({
    points: [[x, 850], [x, 935]], kind: 'data', arrow: false,
  }));

  return {
    title: `Google Kubernetes Engine: ${microservices ? 'separate services' : 'single service'} private network`,
    description: 'Corporate clients use private network access to reach an internal Application Load Balancer. GKE nodes, pods, and data stores use private addresses. Cloud NAT handles outbound provider requests.',
    provider: 'gcp', width: 1200, height: 1360,
    groups: [
      { id: 'project', x: 20, y: 140, width: 1160, height: 1080, label: 'Google Cloud', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'vpc', x: 50, y: 200, width: 760, height: 900, label: 'Customer project VPC', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'frontend-subnet', x: 80, y: 245, width: 700, height: 140, label: 'Frontend subnet', kind: 'private' },
      { id: 'proxy-subnet', x: 80, y: 415, width: 700, height: 160, label: 'Proxy-only subnet', kind: 'subnet' },
      { id: 'private-subnet', x: 80, y: 615, width: 700, height: 335, label: 'Private GKE subnet', kind: 'private' },
      { id: 'cluster', x: 105, y: 675, width: 650, height: 230, label: 'Existing GKE cluster', kind: 'managed' },
      { id: 'producer-network', x: 850, y: 615, width: 300, height: 485, label: 'Service producer networks', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 180, y: 40, title: ['Corporate users', 'and applications'], detail: ['Private DNS'] },
      { id: 'private-access', x: 650, y: 40, title: ['Private network access'], detail: ['Cloud VPN / Interconnect', 'or approved access service'] },
      { id: 'load-balancer', x: 425, y: 305, icon: 'gcp-cloud-load-balancing.svg', title: ['Internal Application LB'], detail: ['Private HTTPS frontend'] },
      { id: 'lb-proxies', x: 425, y: 480, icon: NETWORK_ICON, title: ['Managed LB proxies'], detail: ['REGIONAL_MANAGED_PROXY'] },
      ...workloads,
      { id: 'nat', x: 225, y: 1010, icon: NETWORK_ICON, title: ['Cloud NAT'], detail: ['Cloud Router configuration', 'Outbound access for private nodes'] },
      { id: 'psa', x: 625, y: 1010, icon: NETWORK_ICON, title: ['Private Services Access'], detail: ['Allocated peering range'] },
      { id: 'postgres', x: 1000, y: 700, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL', 'PostgreSQL'], detail: ['Private IP', 'Writer + optional read replica'] },
      { id: 'redis', x: 1000, y: 940, icon: 'gcp-memorystore.svg', title: ['Memorystore Redis'], detail: ['Private IP, TLS', 'Private Services Access'] },
      { id: 'public-providers', x: 225, y: 1270, title: ['Public LLM APIs'], detail: ['HTTPS egress only'] },
    ],
    edges: [
      { points: [[202, 40], [628, 40]], kind: 'request' },
      { points: [[672, 40], [800, 40], [800, 235], [425, 235], [425, 283]], kind: 'request' },
      { points: [[425, 377], [425, 458]], kind: 'request' },
      { points: [[425, 552], [425, 562], [800, 562], [800, 725], [225, 725]], kind: 'request', arrow: false },
      ...requestEdges,
      ...dataEdges,
      { points: [[225, 935], [625, 935], [625, 988]], kind: 'data' },
      { points: [[647, 1010], [825, 1010], [825, 700]], kind: 'data', arrow: false },
      { points: [[825, 700], [978, 700]], kind: 'data' },
      { points: [[825, 940], [978, 940]], kind: 'data', label: 'Private peering', labelX: 865, labelY: 922 },
      { points: [[203, 770], [65, 770], [65, 1010], [203, 1010]], kind: 'egress' },
      { points: [[225, 1092], [225, 1248]], kind: 'egress', label: 'Public provider HTTPS', labelX: 245, labelY: 1160 },
    ],
    junctions: [
      { x: 425, y: 725, kind: 'request' },
      { x: 625, y: 725, kind: 'request' },
      { x: 425, y: 935, kind: 'data' },
      ...(!microservices ? [{ x: 625, y: 935, kind: 'data' as const }] : []),
      { x: 825, y: 940, kind: 'data' },
    ],
    annotations: [
      { x: 430, y: 1190, lines: ['Cloud NAT serves outbound connections only.'] },
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
