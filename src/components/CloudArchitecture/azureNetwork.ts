import type { CloudKey, NetworkDiagram } from './networkTypes';

export function makeAzureNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  const microservices = cloud === 'azure-aks-micro';

  return {
    title: microservices
      ? 'Azure AKS: separate services'
      : 'Azure AKS: single service',
    description:
      'Corporate clients use private network access to reach a private Application Gateway frontend. AKS and data stores stay private. NAT Gateway handles outbound provider requests.',
    provider: 'azure',
    width: 1540,
    height: 740,
    groups: [
      { id: 'azure', x: 400, y: 20, width: 1120, height: 710, label: 'Microsoft Azure', kind: 'cloud', icon: 'microsoft-azure.svg' },
      { id: 'region', x: 420, y: 55, width: 1080, height: 660, label: 'Azure region', kind: 'region' },
      { id: 'vnet', x: 440, y: 90, width: 1040, height: 455, label: 'Workload virtual network', kind: 'vpc', icon: 'azure-virtual-network.svg' },
      { id: 'app-gateway-subnet', x: 460, y: 145, width: 380, height: 165, label: 'Dedicated Application Gateway subnet', kind: 'subnet', icon: 'azure-subnet.svg' },
      { id: 'aks-subnet', x: 880, y: 145, width: 580, height: 165, label: 'Private AKS node subnet', kind: 'private', icon: 'azure-subnet.svg' },
      { id: 'endpoint-subnet', x: 760, y: 375, width: 700, height: 150, label: 'Private endpoints', kind: 'private', icon: 'azure-subnet.svg' },
      { id: 'optional-openai-endpoint', x: 1265, y: 395, width: 185, height: 120, label: 'Optional', kind: 'optional' },
      { id: 'managed-services', x: 760, y: 570, width: 700, height: 130, label: 'Managed services', kind: 'managed' },
      { id: 'optional-openai-service', x: 1265, y: 580, width: 185, height: 110, label: 'Optional', kind: 'optional' },
    ],
    nodes: [
      { id: 'clients', x: 100, y: 215, title: ['Corporate users'], detail: ['and applications'] },
      { id: 'private-access', x: 300, y: 215, title: ['Private access'], detail: ['VPN / ExpressRoute'] },
      { id: 'public-providers', x: 170, y: 440, title: ['Public LLM APIs'] },
      {
        id: 'application-gateway', x: 650, y: 215,
        icon: 'azure-application-gateways.svg',
        title: ['Application Gateway'],
        detail: ['Private frontend'],
      },
      {
        id: 'aks', x: 1040, y: 215,
        icon: 'azure-kubernetes-services.svg',
        title: ['LiteLLM on AKS'],
        detail: microservices
          ? ['Gateway / backend / UI']
          : ['Service :4000'],
      },
      {
        id: 'aks-nsg', x: 1330, y: 215,
        icon: 'azure-network-security-group.svg',
        title: ['AKS subnet NSG'],
      },
      {
        id: 'nat-gateway', x: 600, y: 440,
        icon: 'azure-nat-gateway.svg',
        title: ['NAT Gateway'],
        detail: ['Outbound only'],
      },
      {
        id: 'postgres-endpoint', x: 940, y: 440,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'PostgreSQL'],
      },
      {
        id: 'redis-endpoint', x: 1160, y: 440,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'Redis'],
      },
      {
        id: 'openai-endpoint', x: 1370, y: 440,
        icon: 'azure-private-endpoint.svg',
        title: ['Private endpoint', 'Azure OpenAI'],
      },
      {
        id: 'postgres', x: 940, y: 620,
        icon: 'azure-azure-database-postgresql-server.svg',
        title: ['PostgreSQL', 'Flexible Server'],
      },
      {
        id: 'redis', x: 1160, y: 620,
        icon: 'azure-cache-redis.svg',
        title: ['Azure Cache for Redis'],
      },
      {
        id: 'openai', x: 1370, y: 620,
        icon: 'azure-openai.svg',
        title: ['Azure OpenAI'],
      },
    ],
    edges: [
      { points: [[122, 215], [278, 215]], kind: 'request' },
      { points: [[322, 215], [628, 215]], kind: 'request', label: 'HTTPS :443', labelX: 445, labelY: 202 },
      { points: [[672, 215], [1018, 215]], kind: 'request', label: 'AGIC pod routing', labelX: 785, labelY: 202 },
      { points: [[1015, 290], [1015, 330], [600, 330], [600, 418]], kind: 'egress' },
      { points: [[578, 440], [192, 440]], kind: 'egress', label: 'HTTPS :443', labelX: 325, labelY: 427 },
      { points: [[1040, 290], [1040, 345]], kind: 'data', arrow: false },
      { points: [[1040, 345], [940, 345], [940, 418]], kind: 'data' },
      { points: [[1040, 345], [1160, 345]], kind: 'data', arrow: false },
      { points: [[1160, 345], [1160, 418]], kind: 'data' },
      { points: [[1160, 345], [1370, 345], [1370, 418]], kind: 'optional' },
      { points: [[940, 510], [940, 598]], kind: 'data', label: 'TLS :5432', labelX: 950, labelY: 558 },
      { points: [[1160, 510], [1160, 598]], kind: 'data', label: 'TLS :6380', labelX: 1170, labelY: 558 },
      { points: [[1370, 510], [1370, 598]], kind: 'optional', label: 'HTTPS :443', labelX: 1380, labelY: 558 },
    ],
    junctions: [
      { x: 1040, y: 345, kind: 'data' },
      { x: 1160, y: 345, kind: 'data' },
    ],
    annotations: [
      {
        x: 465, y: 605,
        lines: [
          'Private DNS zones link to the VNet.',
          'Service names resolve to endpoint IPs.',
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
