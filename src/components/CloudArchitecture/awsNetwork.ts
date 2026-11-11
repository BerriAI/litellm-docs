import type { CloudKey, NetworkDiagram, NetworkEdge, NetworkNode } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws';

/** Corporate-only target. ECS requires the module changes listed in the cloud guide. */
export function makeAwsNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  const ecs = cloud === 'aws-ecs';
  const micro = ecs || cloud === 'aws-eks-micro';
  const nodes: NetworkNode[] = [
    { id: 'clients', x: 160, y: 50, title: ['Corporate users', 'and applications'], detail: ['Private DNS'] },
    { id: 'private-access', x: 600, y: 50, title: ['Private network access'], detail: ['VPN / Direct Connect', 'or approved access service'] },
    { id: 'external', x: 1050, y: 50, title: ['External LLM APIs', 'and image registry'], detail: ['Public provider / registry APIs'] },
    { id: 'igw', x: 400, y: 220, icon: 'aws-internet-gateway.svg', title: ['Internet gateway'] },
    { id: 'nat-a', x: 175, y: 430, icon: 'aws-nat-gateway.svg', title: ['NAT gateway'], detail: [ecs ? 'Single NAT' : 'One per AZ'] },
    { id: 'alb-a', x: 350, y: 650, icon: 'aws-alb.svg', title: ['Internal ALB'], detail: ['Private HTTPS 443', 'One logical ALB'] },
    { id: 'alb-b', x: 780, y: 650, icon: 'aws-alb.svg', title: ['Internal ALB'], detail: ['Private HTTPS 443', 'One logical ALB'] },
    { id: 'secrets', x: 1085, y: 330, icon: 'aws-secrets-manager.svg', title: ['Secrets Manager'], detail: ['Credentials and secrets'] },
    { id: 's3', x: 1085, y: 510, icon: 'aws-s3.svg', title: ['Amazon S3'], detail: ['Config / optional logs'] },
    { id: 'logs', x: 1085, y: 690, icon: 'aws-cloudwatch.svg', title: ['CloudWatch Logs'], detail: ['Container logs'] },
    { id: 'bedrock', x: 1085, y: 1130, icon: 'aws-bedrock.svg', title: ['Amazon Bedrock'], detail: ['Runtime inference API'] },
  ];

  for (const [suffix, offset] of [['a', 0], ['b', 430]] as const) {
    nodes.push(
      {
        id: `compute-${suffix}`, x: 350 + offset, y: 850,
        icon: ecs ? 'aws-fargate.svg' : 'aws-eks.svg',
        title: ecs ? ['LiteLLM', 'Fargate tasks'] : ['LiteLLM pods'],
        detail: [micro ? 'Gateway / backend / UI' : 'One Deployment', ecs ? 'Placement by ECS' : 'Private EKS workers'],
      },
      {
        id: `endpoint-${suffix}`, x: 175 + offset, y: 850,
        icon: 'aws-vpc-endpoint.svg', title: ['Interface endpoint'],
        detail: ['Bedrock runtime', 'Optional, private DNS'],
      },
      {
        id: `aurora-${suffix}`, x: 200 + offset, y: 1110,
        icon: 'aws-aurora.svg', title: [suffix === 'a' ? 'Aurora writer' : 'Aurora reader'],
        detail: ['Private PostgreSQL', 'Example AZ placement'],
      },
      {
        id: `redis-${suffix}`, x: 385 + offset, y: 1110,
        icon: 'aws-elasticache.svg', title: [suffix === 'a' ? 'Redis primary' : 'Redis replica'],
        detail: ['ElastiCache', 'Multi-AZ enabled'],
      },
    );
  }
  if (!ecs) {
    nodes.push({ id: 'nat-b', x: 605, y: 430, icon: 'aws-nat-gateway.svg', title: ['NAT gateway'], detail: ['One per AZ'] });
  }

  const edges: NetworkEdge[] = [
    // Corporate traffic reaches only the internal ALB.
    { kind: 'request', points: [[182, 50], [578, 50]] },
    { kind: 'request', points: [[622, 50], [930, 50], [930, 560], [350, 560]], arrow: false },
    { kind: 'request', points: [[350, 560], [350, 628]] },
    { kind: 'request', points: [[780, 560], [780, 628]] },
    { kind: 'request', points: [[350, 740], [350, 828]] },
    { kind: 'request', points: [[780, 740], [780, 828]] },

    // Keep outbound routes in the space between the workload and endpoint columns.
    { kind: 'egress', points: [[328, 840], [280, 840], [280, 760]], arrow: false },
    { kind: 'egress', points: [[280, 760], [280, 430], [197, 430]] },
    ...(ecs ? [
      { kind: 'egress' as const, points: [[758, 840], [710, 840], [710, 760], [280, 760]] as [number, number][], arrow: false },
    ] : [
      { kind: 'egress' as const, points: [[758, 840], [710, 840], [710, 430], [627, 430]] as [number, number][] },
    ]),
    { kind: 'egress', points: [[153, 430], [80, 430], [80, 275], [335, 275]], arrow: false },
    ...(!ecs ? [
      { kind: 'egress' as const, points: [[583, 430], [510, 430], [510, 275], [335, 275]] as [number, number][], arrow: false },
    ] : []),
    { kind: 'egress', points: [[335, 275], [335, 220], [378, 220]] },
    { kind: 'egress', points: [[400, 198], [400, 135], [1180, 135], [1180, 50], [1072, 50]] },
    // The regional service endpoints share a public-egress trunk.
    { kind: 'egress', points: [[955, 135], [955, 690]], arrow: false },
    { kind: 'egress', points: [[955, 330], [1063, 330]] },
    { kind: 'egress', points: [[955, 510], [1063, 510]] },
    { kind: 'egress', points: [[955, 690], [1063, 690]] },

    // Both AZs use the same writer and primary endpoints through one shared path.
    { kind: 'data', points: [[372, 860], [450, 860], [450, 1020]], arrow: false },
    { kind: 'data', points: [[802, 860], [880, 860], [880, 1020]], arrow: false },
    { kind: 'data', points: [[200, 1020], [880, 1020]], arrow: false },
    { kind: 'data', points: [[200, 1020], [200, 1088]], label: '5432', labelX: 200, labelY: 1006 },
    { kind: 'data', points: [[385, 1020], [385, 1088]], label: '6379 / TLS', labelX: 330, labelY: 1006 },

    // Optional interface endpoints join only on the dedicated PrivateLink path.
    { kind: 'optional', points: [[328, 860], [197, 860]], label: '443', labelX: 255, labelY: 883 },
    { kind: 'optional', points: [[758, 860], [627, 860]], label: '443', labelX: 685, labelY: 883 },
    { kind: 'optional', points: [[153, 850], [100, 850], [100, 1055], [945, 1055], [945, 1130], [1063, 1130]] },
    { kind: 'optional', points: [[583, 850], [530, 850], [530, 1055]], arrow: false },
  ];

  return {
    title: ecs ? 'AWS ECS Fargate: private deployment' : `AWS EKS: ${micro ? 'separate services' : 'single service'} network example`,
    description: ecs
      ? 'Corporate clients reach an internal ALB through private network access. This architecture requires changes to the Terraform module. NAT handles outbound traffic only.'
      : 'Corporate clients reach an internal ALB and private EKS workers. Create the private network access, data stores, and NAT gateways around Helm.',
    provider: 'aws', width: 1240, height: 1350,
    groups: [
      { id: 'aws', x: 20, y: 140, width: 1200, height: 1200, label: 'AWS Cloud', kind: 'cloud', icon: 'aws-cloud.svg' },
      { id: 'region', x: 35, y: 175, width: 1170, height: 1150, label: 'AWS Region', kind: 'region', icon: 'aws-region.svg' },
      { id: 'vpc', x: 55, y: 220, width: 885, height: 1080, label: ecs ? 'VPC 10.40.0.0/16 (default)' : 'VPC', kind: 'vpc', icon: 'aws-vpc.svg' },
      { id: 'az-a', x: 75, y: 310, width: 410, height: 950, label: 'Availability Zone A', kind: 'az' },
      { id: 'az-b', x: 505, y: 310, width: 410, height: 950, label: 'Availability Zone B', kind: 'az' },
      { id: 'public-a', x: 90, y: 360, width: 380, height: 190, label: 'Public egress subnet A', kind: 'public', icon: 'aws-public-subnet.svg' },
      { id: 'public-b', x: 520, y: 360, width: 380, height: 190, label: 'Public egress subnet B', kind: 'public', icon: 'aws-public-subnet.svg' },
      { id: 'private-a', x: 90, y: 575, width: 380, height: 660, label: 'Private subnet A', kind: 'private', icon: 'aws-private-subnet.svg' },
      { id: 'private-b', x: 520, y: 575, width: 380, height: 660, label: 'Private subnet B', kind: 'private', icon: 'aws-private-subnet.svg' },
      { id: 'regional-services', x: 970, y: 220, width: 230, height: 1080, label: 'Regional AWS services', kind: 'managed' },
    ],
    nodes, edges,
    junctions: [
      { x: 780, y: 560, kind: 'request' },
      { x: 955, y: 135, kind: 'egress' },
      { x: 955, y: 330, kind: 'egress' },
      { x: 955, y: 510, kind: 'egress' },
      { x: 385, y: 1020, kind: 'data' },
      { x: 450, y: 1020, kind: 'data' },
      { x: 530, y: 1055, kind: 'optional' },
      ...(ecs ? [{ x: 280, y: 760, kind: 'egress' as const }] : [{ x: 335, y: 275, kind: 'egress' as const }]),
    ],
    annotations: [
      { x: 285, y: 965, anchor: 'middle', lines: [ecs ? 'ALB to task security group' : 'ALB Ingress to workload targets', micro ? '4000 gateway, 4001 backend, 3000 UI' : 'HTTP 4000 to LiteLLM'] },
      { x: 715, y: 965, anchor: 'middle', lines: [ecs ? 'ALB to task security group' : 'ALB Ingress to workload targets', micro ? '4000 gateway, 4001 backend, 3000 UI' : 'HTTP 4000 to LiteLLM'] },
      { x: 285, y: 1218, anchor: 'middle', lines: [ecs ? 'DB / cache ingress: task security group' : 'DB / cache ingress: app security group'] },
      { x: 715, y: 1218, anchor: 'middle', lines: ['Writes use writer / primary'] },
      { x: 490, y: 1285, anchor: 'middle', lines: [ecs ? 'Private default route: NAT A. Public default route: Internet gateway.' : 'Private default route: same-AZ NAT. Public default route: Internet gateway.'] },
      { x: 1085, y: 277, anchor: 'middle', lines: ['Public HTTPS endpoints', 'through NAT by default'] },
      { x: 1085, y: 1235, anchor: 'middle', lines: ['PrivateLink: bedrock-runtime', 'Optional path without NAT'] },
      ...(ecs ? [{ x: 605, y: 430, anchor: 'middle' as const, lines: ['No NAT in AZ B', 'Uses NAT in AZ A'] }] : []),
    ],
    notes: ecs ? [
      { title: 'One image', text: 'The gateway, backend, UI, and migration job use the same image with a different startup argument for each component.' },
      { title: 'Required module changes', text: 'The module creates an internet-facing ALB. In your fork, set internal=true, select private ALB subnets, update the subnet precondition, and restrict port 443 to corporate source ranges. Remove public HTTP ingress. Add private access routes and private DNS. These are source changes, not module inputs.' },
      { title: 'Base module resources', text: 'The module creates one public and one private subnet for each supplied AZ, and one NAT gateway in the first public subnet. Supply at least two AZs. With an existing VPC, provide the subnets and routes yourself. Tasks, Aurora, and Redis share the private subnet set.' },
      { title: 'Placement and availability', text: 'The gateway defaults to two tasks. The backend and UI each default to one. The diagram shows example AZ placements for workloads and Aurora. Both AZs use the Aurora writer endpoint and Redis primary endpoint. Aurora has a reader, and Redis has one replica by default. The diagram omits replication paths. Add per-AZ NAT gateways and service replicas to meet your availability requirements.' },
      { title: 'Security and egress', text: 'Supply acm_certificate_arn for HTTPS. Allow corporate traffic only through the private access path. TLS terminates at the internal ALB. The task security group allows all TCP ports from the ALB security group. The diagram labels the target ports. Aurora allows 5432 and Redis allows 6379 from tasks only. Tasks have no public IP. External providers, public registries, and public AWS service endpoints use NAT. Create DNS records separately. Add WAF or ECR repositories if needed.' },
      { title: 'Optional PrivateLink', text: 'Create Bedrock interface endpoints separately. Use com.amazonaws.<region>.bedrock-runtime, private DNS, and endpoint security group ingress 443 from tasks. Grant Bedrock IAM permissions separately. The bedrock endpoint is for the control plane. To expose LiteLLM through PrivateLink, create a separate endpoint service.' },
    ] : [
      { title: 'One Helm chart', text: `The litellm chart uses one image for all components. ${micro ? 'This layout uses the default monolith.enabled=false.' : 'Set monolith.enabled=true. Use gateway values to configure the single service.'}` },
      { title: 'Required infrastructure', text: 'Helm deploys the LiteLLM workloads. Create private network access, the VPC, internal ALB, private EKS workers, Aurora, Redis, and per-AZ NAT gateways separately. Configure AWS Load Balancer Controller and Ingress for the selected service layout. Set alb.ingress.kubernetes.io/scheme: internal and select private ALB subnets. Set alb.ingress.kubernetes.io/target-type: ip to target pods directly. Instance mode targets NodePorts. Configure secrets and container log collection separately.' },
      { title: 'Availability and access', text: 'Spread replicas across AZs and set disruption budgets. Both AZs use the writer and primary endpoints by default. The diagram omits replication paths. Choose the database and cache replica layout you need. Allow ALB traffic to workload targets and allow database/cache traffic only from application security groups. Use a private EKS API endpoint.' },
      { title: 'Optional PrivateLink', text: 'The interface endpoints shown provide private Bedrock inference access through com.amazonaws.<region>.bedrock-runtime. Enable private DNS and allow HTTPS from workloads on the endpoint security group. Use pod identity and grant Bedrock permissions. Public providers and registries still need outbound access.' },
    ],
    sources: [
      ...(ecs ? [
        { label: 'Terraform network and security groups (pinned)', url: `${MODULE}/network.tf` },
        { label: 'Terraform ALB routes and TLS (pinned)', url: `${MODULE}/alb.tf` },
        { label: 'Terraform ECS services (pinned)', url: `${MODULE}/ecs.tf` },
        { label: 'Terraform defaults (pinned)', url: `${MODULE}/variables.tf` },
      ] : [
        { label: 'LiteLLM chart and layouts (pinned)', url: 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/README.md' },
        { label: 'AWS EKS load balancing', url: 'https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html' },
        { label: 'EKS cluster endpoint access', url: 'https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html' },
      ]),
      { label: 'Internal load balancer scheme', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html' },
      { label: 'AWS NAT gateway availability', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html' },
      { label: 'Bedrock interface VPC endpoints', url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/vpc-interface-endpoints.html' },
    ],
  };
}
