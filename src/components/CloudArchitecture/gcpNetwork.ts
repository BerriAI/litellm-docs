import type { CloudKey, NetworkDiagram, NetworkEdge, NetworkNode } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/11af2eb22dc799dff033c2d3ba71be991b6a8201/terraform/litellm/gcp';
const NETWORK_ICON = 'gcp-networking.svg';

function cloudRunDiagram(): NetworkDiagram {
  return {
    title: 'Google Cloud Run: Terraform network',
    description: 'The Terraform module separates public ingress, private database connections, and public provider calls. Cloud Run runs outside the customer VPC. The dashed NAT path is an optional customization.',
    provider: 'gcp',
    width: 1200,
    height: 1200,
    groups: [
      { id: 'project', x: 20, y: 110, width: 1160, height: 920, label: 'Google Cloud', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'cloud-run-region', x: 50, y: 390, width: 465, height: 360, label: 'Cloud Run • region', kind: 'managed', icon: 'gcp-cloud-run.svg' },
      { id: 'vpc', x: 545, y: 390, width: 605, height: 410, label: 'Customer project VPC • global', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'connector-subnet', x: 570, y: 435, width: 265, height: 170, label: 'Connector subnet • region', kind: 'subnet' },
      { id: 'general-subnet', x: 855, y: 435, width: 275, height: 170, label: 'General subnet • region', kind: 'subnet' },
      { id: 'optional-nat', x: 855, y: 615, width: 275, height: 170, label: 'Optional all-traffic egress', kind: 'optional' },
      { id: 'producer-network', x: 545, y: 840, width: 605, height: 180, label: 'Managed VPCs', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 600, y: 35, title: ['Applications and admins'], detail: ['HTTPS'] },
      { id: 'load-balancer', x: 600, y: 175, icon: 'gcp-cloud-load-balancing.svg', title: ['Global external', 'Application Load Balancer'], detail: ['URL map • managed TLS certificate'] },
      { id: 'gateway-neg', x: 130, y: 310, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['gateway paths'] },
      { id: 'backend-neg', x: 285, y: 310, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['management paths'] },
      { id: 'ui-neg', x: 435, y: 310, icon: NETWORK_ICON, title: ['Serverless NEG'], detail: ['UI paths'] },
      { id: 'gateway', x: 130, y: 470, icon: 'gcp-cloud-run.svg', title: ['Gateway'], detail: [':4000 • inference'] },
      { id: 'backend', x: 285, y: 470, icon: 'gcp-cloud-run.svg', title: ['Backend'], detail: [':4001 • management'] },
      { id: 'ui', x: 435, y: 470, icon: 'gcp-cloud-run.svg', title: ['UI'], detail: [':3000 • browser assets'] },
      { id: 'migrations', x: 285, y: 655, icon: 'gcp-cloud-run.svg', title: ['Migration job'], detail: ['Private database connection'] },
      { id: 'connector', x: 700, y: 500, icon: NETWORK_ICON, title: ['Serverless VPC Access'], detail: ['10.41.0.0/28 • default'] },
      { id: 'psa', x: 700, y: 700, icon: NETWORK_ICON, title: ['Private Services Access'], detail: ['Allocated /16 peering range'] },
      { id: 'optional-nat', x: 1000, y: 680, icon: NETWORK_ICON, title: ['Cloud NAT'], detail: ['Cloud Router configuration', 'Requires module changes'] },
      { id: 'postgres', x: 700, y: 900, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL PostgreSQL'], detail: ['Regional HA writer + read replica', 'Private IP only'] },
      { id: 'redis', x: 1000, y: 900, icon: 'gcp-memorystore.svg', title: ['Memorystore Redis'], detail: ['Standard HA • TLS', 'Private Services Access'] },
      { id: 'public-providers', x: 260, y: 1115, title: ['Public LLM APIs'], detail: ['HTTPS'] },
    ],
    edges: [
      { points: [[600, 104], [600, 153]], kind: 'request' },
      { points: [[600, 267], [600, 278], [130, 278], [130, 288]], kind: 'request' },
      { points: [[600, 267], [600, 278], [285, 278], [285, 288]], kind: 'request' },
      { points: [[600, 267], [600, 278], [435, 278], [435, 288]], kind: 'request' },
      { points: [[130, 382], [40, 382], [40, 438], [130, 438], [130, 448]], kind: 'request' },
      { points: [[285, 382], [285, 448]], kind: 'request' },
      { points: [[435, 382], [435, 448]], kind: 'request' },
      { points: [[130, 545], [130, 580], [530, 580], [530, 500], [678, 500]], kind: 'data', label: 'Private IP traffic', labelX: 335, labelY: 572 },
      { points: [[285, 545], [285, 580], [530, 580], [530, 500], [678, 500]], kind: 'data' },
      { points: [[307, 655], [530, 655], [530, 500], [678, 500]], kind: 'data' },
      { points: [[700, 590], [700, 678]], kind: 'data', label: 'Private ranges only', labelX: 555, labelY: 638 },
      { points: [[700, 780], [700, 820], [700, 878]], kind: 'data' },
      { points: [[700, 780], [700, 820], [1000, 820], [1000, 878]], kind: 'data', label: 'Private peering', labelX: 815, labelY: 815 },
      { points: [[108, 470], [35, 470], [35, 1115], [238, 1115]], kind: 'egress', label: 'Default: public HTTPS, no VPC or NAT', labelX: 50, labelY: 1085 },
      { points: [[722, 500], [845, 500], [845, 680], [978, 680]], kind: 'optional' },
      { points: [[1022, 680], [1165, 680], [1165, 1115], [282, 1115]], kind: 'optional', label: 'Optional static outbound IP', labelX: 760, labelY: 1095 },
    ],
    annotations: [
      { x: 435, y: 555, lines: ['No VPC connector'], anchor: 'middle' },
      { x: 285, y: 740, lines: ['Ingress: internal + load balancer traffic'], anchor: 'middle' },
      { x: 992, y: 495, lines: ['10.40.0.0/16 • default', 'Private Google Access enabled', 'Cloud Run is not in this subnet'], anchor: 'middle' },
      { x: 700, y: 326, lines: ['DNS records are operator-managed.', 'The module creates the load balancer IP.'] },
    ],
    notes: [
      { title: 'Created by Terraform', text: 'VPC, regional subnet, connector, Private Services Access, private Cloud SQL and Memorystore, Cloud Run services, migration job, and load balancer. Existing VPC and PSA connections can be reused.' },
      { title: 'Ingress and egress are separate', text: 'Serverless NEGs carry load-balancer requests to Cloud Run. Only gateway, backend, and migrations use the VPC connector. Public provider calls use direct Cloud Run egress by default.' },
      { title: 'Optional NAT design', text: 'The module does not create Cloud NAT or Cloud Router and hard-codes PRIVATE_RANGES_ONLY. Routing public calls through NAT requires an all-traffic egress customization. Cloud Router configures NAT; it is not a packet-forwarding hop.' },
      { title: 'Private managed services', text: 'Cloud SQL and Memorystore use addresses allocated through Private Services Access in Google-managed producer networks. They are not deployed into the customer subnet. The read replica is separate from the writer’s HA standby.' },
    ],
    sources: [
      { label: 'Terraform network', url: `${MODULE}/network.tf` },
      { label: 'Cloud Run services', url: `${MODULE}/cloudrun.tf` },
      { label: 'Load balancer', url: `${MODULE}/load_balancer.tf` },
      { label: 'Connector egress', url: 'https://docs.cloud.google.com/run/docs/configuring/vpc-connectors' },
      { label: 'Private Services Access', url: 'https://docs.cloud.google.com/vpc/docs/private-services-access' },
    ],
  };
}

function gkeDiagram(microservices: boolean): NetworkDiagram {
  const positions = [225, 425, 625];
  const names = microservices ? ['Gateway', 'Backend', 'UI'] : ['LiteLLM replica', 'LiteLLM replica', 'LiteLLM replica'];
  const details = microservices ? [':4000 • inference', ':4001 • management', ':3000 • browser assets'] : [':4000', ':4000', ':4000'];
  const workloads: NetworkNode[] = positions.map((x, index) => ({
    id: `workload-${index}`, x, y: 550, icon: 'gcp-google-kubernetes-engine.svg', title: [names[index]], detail: [details[index]],
  }));
  const requestEdges: NetworkEdge[] = positions.map(x => ({ points: [[425, 362], [800, 362], [800, 505], [x, 505], [x, 528]], kind: 'request' }));
  const dataEdges: NetworkEdge[] = positions.filter((_, index) => !microservices || index < 2).map(x => ({
    points: [[x, 630], [x, 715], [625, 715], [625, 768]], kind: 'data',
  }));

  return {
    title: `Google Kubernetes Engine: ${microservices ? 'microservices' : 'single-service'} network`,
    description: 'An illustrative network for a private GKE cluster running LiteLLM with Helm. The operator provisions the cluster, ingress, network, and managed data services; Helm installs the LiteLLM workloads.',
    provider: 'gcp',
    width: 1200,
    height: 1140,
    groups: [
      { id: 'project', x: 20, y: 115, width: 1160, height: 850, label: 'Google Cloud • operator-managed reference', kind: 'cloud', icon: 'google-cloud.svg' },
      { id: 'vpc', x: 50, y: 350, width: 760, height: 530, label: 'Customer project VPC • global', kind: 'vpc', icon: NETWORK_ICON },
      { id: 'private-subnet', x: 80, y: 395, width: 700, height: 335, label: 'Private GKE subnet • regional node and pod IP ranges', kind: 'subnet' },
      { id: 'cluster', x: 105, y: 455, width: 650, height: 230, label: `Existing GKE cluster • ${microservices ? 'litellm chart' : 'litellm-helm chart'}`, kind: 'managed' },
      { id: 'producer-network', x: 850, y: 350, width: 300, height: 530, label: 'Service producer networks', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 425, y: 35, title: ['Applications and admins'], detail: ['HTTPS'] },
      { id: 'load-balancer', x: 425, y: 175, icon: 'gcp-cloud-load-balancing.svg', title: ['Cloud Load Balancing'], detail: ['External Application Load Balancer'] },
      { id: 'ingress', x: 425, y: 290, icon: NETWORK_ICON, title: ['GKE ingress backends'], detail: ['Selected controller and routes'] },
      ...workloads,
      { id: 'nat', x: 225, y: 790, icon: NETWORK_ICON, title: ['Cloud NAT'], detail: ['Cloud Router configuration', 'Outbound access for private nodes'] },
      { id: 'psa', x: 625, y: 790, icon: NETWORK_ICON, title: ['Private Services Access'], detail: ['Allocated peering range'] },
      { id: 'postgres', x: 1000, y: 480, icon: 'gcp-cloud-sql.svg', title: ['Cloud SQL', 'PostgreSQL'], detail: ['Private IP', 'Writer + optional read replica'] },
      { id: 'redis', x: 1000, y: 720, icon: 'gcp-memorystore.svg', title: ['Memorystore Redis'], detail: ['Private IP • TLS', 'Private Services Access'] },
      { id: 'public-providers', x: 225, y: 1040, title: ['Public LLM APIs'], detail: ['HTTPS'] },
    ],
    edges: [
      { points: [[425, 104], [425, 153]], kind: 'request' },
      { points: [[425, 247], [425, 268]], kind: 'request' },
      ...requestEdges,
      ...dataEdges,
      { points: [[647, 790], [825, 790], [825, 480], [978, 480]], kind: 'data' },
      { points: [[647, 790], [825, 790], [825, 720], [978, 720]], kind: 'data', label: 'Private peering', labelX: 865, labelY: 702 },
      { points: [[203, 550], [65, 550], [65, 790], [203, 790]], kind: 'egress' },
      { points: [[225, 872], [225, 1018]], kind: 'egress', label: 'Public provider HTTPS', labelX: 245, labelY: 915 },
    ],
    annotations: [
      { x: 430, y: 935, lines: ['Cloud NAT enables outbound connections.', 'It does not serve inbound requests.'] },
    ],
    notes: [
      { title: 'Illustrative infrastructure', text: 'The Helm chart does not create the VPC, GKE cluster, load balancer, Cloud NAT, or managed databases. This reference uses private nodes with a separately configured ingress controller.' },
      { title: 'Private node egress', text: 'Configure Cloud NAT for the required node and pod address ranges to reach public provider APIs and external registries. Private Google Access serves supported Google APIs without requiring internet NAT.' },
      { title: 'Private data connections', text: 'Use Private Services Access to reach Cloud SQL and Memorystore private IPs. Google-managed producer networks remain outside the customer subnet.' },
      { title: 'Terraform dependencies only', text: 'The Google module can provision the data dependencies with create_runtime=false. It then omits Cloud Run, its load balancer, VPC connector, and migration job; GKE and its network configuration remain operator-managed.' },
    ],
    sources: [
      { label: 'GKE network isolation', url: 'https://docs.cloud.google.com/kubernetes-engine/docs/how-to/latest/network-isolation' },
      { label: 'GKE networking practices', url: 'https://docs.cloud.google.com/kubernetes-engine/docs/best-practices/networking' },
      { label: 'Private Services Access', url: 'https://docs.cloud.google.com/vpc/docs/private-services-access' },
      { label: 'Terraform dependencies-only mode', url: `${MODULE}/README.md#dependencies-only-run-litellm-on-gke` },
    ],
  };
}

export function makeGcpNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  return cloud === 'gcp-cloud-run' ? cloudRunDiagram() : gkeDiagram(cloud === 'gcp-gke-micro');
}
