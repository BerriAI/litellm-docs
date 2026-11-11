import type { CloudKey, NetworkDiagram } from './networkTypes';

export function makeAzureNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  const microservices = cloud === 'azure-aks-micro';

  return {
    title: microservices
      ? 'Azure AKS with Helm: separate gateway, backend, and UI'
      : 'Azure AKS with Helm: one LiteLLM service',
    description:
      'Corporate clients use private network access to reach a private Application Gateway frontend. AKS and data stores stay private. NAT Gateway handles outbound provider requests.',
    provider: 'azure',
    width: 1200,
    height: 1200,
    groups: [
      { id: 'azure', x: 20, y: 130, width: 1160, height: 1050, label: 'Microsoft Azure', kind: 'cloud', icon: 'microsoft-azure.svg' },
      { id: 'region', x: 40, y: 165, width: 1120, height: 995, label: 'Azure region', kind: 'region' },
      { id: 'vnet', x: 60, y: 200, width: 1080, height: 740, label: 'Workload virtual network', kind: 'vpc', icon: 'azure-virtual-network.svg' },
      { id: 'app-gateway-subnet', x: 90, y: 255, width: 620, height: 175, label: 'Dedicated Application Gateway subnet', kind: 'subnet', icon: 'azure-subnet.svg' },
      { id: 'aks-subnet', x: 90, y: 465, width: 1020, height: 225, label: 'Private AKS node subnet', kind: 'private', icon: 'azure-subnet.svg' },
      { id: 'endpoint-subnet', x: 90, y: 735, width: 1020, height: 180, label: 'Endpoint subnet', kind: 'private', icon: 'azure-subnet.svg' },
      { id: 'optional-openai-endpoint', x: 790, y: 755, width: 275, height: 145, label: 'Optional', kind: 'optional' },
      { id: 'managed-services', x: 90, y: 965, width: 1020, height: 175, label: 'Managed services', kind: 'managed' },
      { id: 'optional-openai-service', x: 790, y: 980, width: 275, height: 150, label: 'Optional', kind: 'optional' },
    ],
    nodes: [
      { id: 'clients', x: 170, y: 40, title: ['Corporate users', 'and applications'], detail: ['Private DNS'] },
      { id: 'private-access', x: 530, y: 40, title: ['Private network access'], detail: ['VPN / ExpressRoute', 'or approved access service'] },
      { id: 'public-providers', x: 1000, y: 40, title: ['Public LLM APIs'], detail: ['Outside the workload network'] },
      {
        id: 'application-gateway', x: 430, y: 320,
        icon: 'azure-application-gateways.svg',
        title: ['Application Gateway'],
        detail: ['Private frontend, HTTPS :443', 'AGIC routes to pod IPs'],
      },
      {
        id: 'aks', x: 430, y: 540,
        icon: 'azure-kubernetes-services.svg',
        title: ['LiteLLM pods on AKS'],
        detail: microservices
          ? ['gateway :4000, backend :4001', 'UI :3000, separate services']
          : ['litellm chart, proxy', 'Replicas, service :4000'],
      },
      {
        id: 'aks-nsg', x: 180, y: 540,
        icon: 'azure-network-security-group.svg',
        title: ['Network security group'],
        detail: ['Applies to the AKS subnet'],
      },
      {
        id: 'nat-gateway', x: 920, y: 540,
        icon: 'azure-nat-gateway.svg',
        title: ['NAT Gateway'],
        detail: ['Associated with AKS subnet', 'Public IP, outbound traffic only'],
      },
      {
        id: 'postgres-endpoint', x: 300, y: 805,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'PostgreSQL'],
        detail: ['Private IP in this subnet'],
      },
      {
        id: 'redis-endpoint', x: 600, y: 805,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'Redis'],
        detail: ['Private IP in this subnet'],
      },
      {
        id: 'openai-endpoint', x: 900, y: 805,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'Azure OpenAI'],
        detail: ['Optional private provider access'],
      },
      {
        id: 'postgres', x: 300, y: 1030,
        icon: 'azure-azure-database-postgresql-server.svg',
        title: ['Azure Database for PostgreSQL', 'Flexible Server'],
        detail: ['Private Link connection'],
      },
      {
        id: 'redis', x: 600, y: 1030,
        icon: 'azure-cache-redis.svg',
        title: ['Azure Cache for Redis'],
        detail: ['Private Link connection'],
      },
      {
        id: 'openai', x: 900, y: 1030,
        icon: 'azure-openai.svg',
        title: ['Azure OpenAI'],
        detail: ['Optional private provider access'],
      },
    ],
    edges: [
      { points: [[192, 40], [508, 40]], kind: 'request' },
      { points: [[552, 40], [670, 40], [670, 320], [452, 320]], kind: 'request', label: 'Private HTTPS :443', labelX: 685, labelY: 245 },
      {
        points: [[430, 405], [430, 518]], kind: 'request',
        label: microservices ? 'Pod ports :4000 / :4001 / :3000' : 'Pod port :4000',
        labelX: 585, labelY: 450,
      },
      { points: [[452, 540], [898, 540]], kind: 'egress', label: 'Public egress', labelX: 675, labelY: 527 },
      { points: [[942, 540], [1148, 540], [1148, 40], [1022, 40]], kind: 'egress', label: 'HTTPS :443', labelX: 1055, labelY: 522 },
      { points: [[430, 650], [430, 715]], kind: 'data', arrow: false },
      { points: [[430, 715], [300, 715], [300, 783]], kind: 'data' },
      { points: [[430, 715], [600, 715]], kind: 'data', arrow: false },
      { points: [[600, 715], [600, 783]], kind: 'data' },
      { points: [[600, 715], [900, 715], [900, 783]], kind: 'optional' },
      { points: [[300, 895], [300, 1008]], kind: 'data', label: 'TLS :5432', labelX: 355, labelY: 955 },
      { points: [[600, 895], [600, 1008]], kind: 'data', label: 'TLS :6380', labelX: 655, labelY: 955 },
      { points: [[900, 895], [900, 1008]], kind: 'optional', label: 'HTTPS :443', labelX: 965, labelY: 955 },
    ],
    junctions: [
      { x: 430, y: 715, kind: 'data' },
      { x: 600, y: 715, kind: 'data' },
    ],
    annotations: [
      {
        x: 760, y: 290,
        lines: [
          'Private DNS zones linked to this VNet',
          'Endpoint names resolve to private IPs.',
          'Include the optional Azure OpenAI zone.',
          'DNS does not forward traffic.',
        ],
      },
    ],
    notes: [
      { title: 'One Helm chart', text: `The litellm chart uses one image for all components. ${microservices ? 'This layout uses the default monolith.enabled=false.' : 'Set monolith.enabled=true. Use gateway values to configure the single service.'}` },
      {
        title: 'Infrastructure you provide',
        text: 'This example uses a customer-managed AKS cluster and virtual network. Provision Application Gateway, subnet policies, NAT Gateway, databases, private endpoints, and DNS separately. The LiteLLM Helm chart deploys the application workloads.',
      },
      {
        title: 'Private Application Gateway',
        text: 'Use a private-only frontend in a dedicated subnet delegated to Microsoft.Network/applicationGateways. Use AGIC v1.7 or later and appgw.ingress.kubernetes.io/use-private-ip: true. Allow corporate traffic through VPN, ExpressRoute, or an approved private access service. Configure private DNS. AGIC routes requests to pod private IPs. Set backend routes and health probes for your service layout.',
      },
      {
        title: 'Public outbound traffic',
        text: 'For your own virtual network, use AKS outboundType userAssignedNATGateway and associate NAT Gateway with the AKS subnet. NAT handles outbound public API calls. Private endpoint traffic stays private and bypasses NAT. NAT translates addresses. It does not inspect traffic.',
      },
      {
        title: 'Private data connections',
        text: 'This diagram uses PostgreSQL Private Link. Configure endpoint DNS and disable public access. Creating a private endpoint does not disable public access. Use the private PostgreSQL and Redis connections with TLS.',
      },
      {
        title: 'Optional private model provider',
        text: 'The dashed Azure OpenAI path needs its own private endpoint and private DNS records linked to the workload VNet. Create this endpoint separately. Public providers continue to use the separate NAT egress path.',
      },
    ],
    sources: [
      { label: 'LiteLLM chart and layouts (pinned)', url: 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/README.md' },
      { label: 'Private Application Gateway deployment', url: 'https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-private-deployment' },
      { label: 'AGIC private frontend', url: 'https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-private-ip' },
      { label: 'Application Gateway subnet requirements', url: 'https://learn.microsoft.com/en-us/azure/application-gateway/configuration-infrastructure' },
      { label: 'Application Gateway Ingress Controller', url: 'https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-overview' },
      { label: 'AKS NAT Gateway options', url: 'https://learn.microsoft.com/en-us/azure/aks/nat-gateway' },
      { label: 'PostgreSQL Private Link', url: 'https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private-link' },
      { label: 'Redis Private Link', url: 'https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-private-link' },
      { label: 'Azure AI private network access', url: 'https://learn.microsoft.com/en-us/azure/ai-services/cognitive-services-virtual-networks' },
    ],
  };
}
