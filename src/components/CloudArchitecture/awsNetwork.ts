import type { CloudKey, NetworkDiagram, NetworkEdge, NetworkNode } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/732a50318b8bddc6cf79f2c21b31bcd63474b6d6/terraform/litellm/aws';

/** ECS follows the pinned module; EKS is an explicitly separate infrastructure example. */
export function makeAwsNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  const ecs = cloud === 'aws-ecs';
  const micro = ecs || cloud === 'aws-eks-micro';
  const nodes: NetworkNode[] = [
    { id: 'clients', x: 310, y: 50, title: ['Clients'], detail: ['Public DNS; HTTPS 443'] },
    { id: 'external', x: 1050, y: 50, title: ['External LLM APIs', 'and image registry'], detail: [ecs ? 'GHCR images by default' : 'Public provider / registry APIs'] },
    { id: 'igw', x: 400, y: 220, icon: 'aws-internet-gateway.svg', title: ['Internet gateway'] },
    { id: 'nat-a', x: 175, y: 430, icon: 'aws-nat-gateway.svg', title: ['NAT gateway'], detail: [ecs ? 'Single NAT' : 'One per AZ'] },
    { id: 'alb-a', x: 350, y: 430, icon: 'aws-alb.svg', title: ['Application LB'], detail: ['Public; HTTPS 443', 'Shared across AZs'] },
    { id: 'alb-b', x: 780, y: 430, icon: 'aws-alb.svg', title: ['Application LB'], detail: ['Public; HTTPS 443', 'Shared across AZs'] },
    { id: 'secrets', x: 1085, y: 330, icon: 'aws-secrets-manager.svg', title: ['Secrets Manager'], detail: ['Credentials and secrets'] },
    { id: 's3', x: 1085, y: 510, icon: 'aws-s3.svg', title: ['Amazon S3'], detail: ['Config / optional logs'] },
    { id: 'logs', x: 1085, y: 690, icon: 'aws-cloudwatch.svg', title: ['CloudWatch Logs'], detail: ['Container logs'] },
    { id: 'bedrock', x: 1085, y: 930, icon: 'aws-bedrock.svg', title: ['Amazon Bedrock'], detail: ['Runtime inference API'] },
  ];

  for (const [suffix, offset] of [['a', 0], ['b', 430]] as const) {
    nodes.push(
      {
        id: `compute-${suffix}`, x: 350 + offset, y: 650,
        icon: ecs ? 'aws-fargate.svg' : 'aws-eks.svg',
        title: ecs ? ['LiteLLM', 'Fargate tasks'] : ['LiteLLM pods'],
        detail: [micro ? 'Gateway / backend / UI' : 'One Deployment', ecs ? 'Placement by ECS' : 'Private EKS workers'],
      },
      {
        id: `endpoint-${suffix}`, x: 175 + offset, y: 650,
        icon: 'aws-vpc-endpoint.svg', title: ['Interface endpoint'],
        detail: ['Bedrock runtime', 'Optional; private DNS'],
      },
      {
        id: `aurora-${suffix}`, x: 200 + offset, y: 910,
        icon: 'aws-aurora.svg', title: [suffix === 'a' ? 'Aurora writer' : 'Aurora reader'],
        detail: ['PostgreSQL; private', 'Illustrative AZ placement'],
      },
      {
        id: `redis-${suffix}`, x: 385 + offset, y: 910,
        icon: 'aws-elasticache.svg', title: [suffix === 'a' ? 'Redis primary' : 'Redis replica'],
        detail: ['ElastiCache', 'Multi-AZ enabled'],
      },
    );
  }
  if (!ecs) {
    nodes.push({ id: 'nat-b', x: 605, y: 430, icon: 'aws-nat-gateway.svg', title: ['NAT gateway'], detail: ['One per AZ'] });
  }

  const edges: NetworkEdge[] = [
    // One request trunk branches to the ALB nodes in the two public subnets.
    { kind: 'request', points: [[310, 120], [310, 295]], arrow: false },
    { kind: 'request', points: [[310, 295], [780, 295]], arrow: false },
    { kind: 'request', points: [[350, 295], [350, 408]] },
    { kind: 'request', points: [[780, 295], [780, 408]] },
    { kind: 'request', points: [[350, 520], [350, 628]] },
    { kind: 'request', points: [[780, 520], [780, 628]] },

    // Keep outbound routes in the space between the workload and endpoint columns.
    { kind: 'egress', points: [[328, 640], [280, 640], [280, 560]], arrow: false },
    { kind: 'egress', points: [[280, 560], [280, 430], [197, 430]] },
    ...(ecs ? [
      { kind: 'egress' as const, points: [[758, 640], [710, 640], [710, 560], [280, 560]] as [number, number][], arrow: false },
    ] : [
      { kind: 'egress' as const, points: [[758, 640], [710, 640], [710, 430], [627, 430]] as [number, number][] },
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
    { kind: 'data', points: [[372, 660], [450, 660], [450, 820]], arrow: false },
    { kind: 'data', points: [[802, 660], [880, 660], [880, 820]], arrow: false },
    { kind: 'data', points: [[200, 820], [880, 820]], arrow: false },
    { kind: 'data', points: [[200, 820], [200, 888]], label: '5432', labelX: 200, labelY: 806 },
    { kind: 'data', points: [[385, 820], [385, 888]], label: '6379 / TLS', labelX: 330, labelY: 806 },

    // Optional interface endpoints join only on the dedicated PrivateLink path.
    { kind: 'optional', points: [[328, 660], [197, 660]], label: '443', labelX: 255, labelY: 683 },
    { kind: 'optional', points: [[758, 660], [627, 660]], label: '443', labelX: 685, labelY: 683 },
    { kind: 'optional', points: [[153, 650], [100, 650], [100, 855], [945, 855], [945, 930], [1063, 930]] },
    { kind: 'optional', points: [[583, 650], [530, 650], [530, 855]], arrow: false },
  ];

  return {
    title: ecs ? 'AWS ECS Fargate: Terraform network' : `AWS EKS: ${micro ? 'microservices' : 'single deployment'} network example`,
    description: ecs
      ? 'Two-AZ example of the AWS Terraform module, with its single NAT gateway and optional private Bedrock access.'
      : 'A two-AZ network example to provision around Helm: public ALB, private EKS workers, managed data, and a NAT gateway in each AZ.',
    provider: 'aws', width: 1240, height: 1150,
    groups: [
      { id: 'aws', x: 20, y: 140, width: 1200, height: 1000, label: 'AWS Cloud', kind: 'cloud', icon: 'aws-cloud.svg' },
      { id: 'region', x: 35, y: 175, width: 1170, height: 950, label: 'AWS Region', kind: 'region', icon: 'aws-region.svg' },
      { id: 'vpc', x: 55, y: 220, width: 885, height: 880, label: ecs ? 'VPC 10.40.0.0/16 (default)' : 'VPC', kind: 'vpc', icon: 'aws-vpc.svg' },
      { id: 'az-a', x: 75, y: 310, width: 410, height: 750, label: 'Availability Zone A', kind: 'az' },
      { id: 'az-b', x: 505, y: 310, width: 410, height: 750, label: 'Availability Zone B', kind: 'az' },
      { id: 'public-a', x: 90, y: 360, width: 380, height: 190, label: 'Public subnet A', kind: 'public', icon: 'aws-public-subnet.svg' },
      { id: 'public-b', x: 520, y: 360, width: 380, height: 190, label: 'Public subnet B', kind: 'public', icon: 'aws-public-subnet.svg' },
      { id: 'private-a', x: 90, y: 575, width: 380, height: 460, label: 'Private subnet A', kind: 'private', icon: 'aws-private-subnet.svg' },
      { id: 'private-b', x: 520, y: 575, width: 380, height: 460, label: 'Private subnet B', kind: 'private', icon: 'aws-private-subnet.svg' },
      { id: 'regional-services', x: 970, y: 220, width: 230, height: 880, label: 'Regional AWS services', kind: 'managed' },
    ],
    nodes, edges,
    junctions: [
      { x: 350, y: 295, kind: 'request' },
      { x: 955, y: 135, kind: 'egress' },
      { x: 955, y: 330, kind: 'egress' },
      { x: 955, y: 510, kind: 'egress' },
      { x: 385, y: 820, kind: 'data' },
      { x: 450, y: 820, kind: 'data' },
      { x: 530, y: 855, kind: 'optional' },
      ...(ecs ? [{ x: 280, y: 560, kind: 'egress' as const }] : [{ x: 335, y: 275, kind: 'egress' as const }]),
    ],
    annotations: [
      { x: 285, y: 765, anchor: 'middle', lines: [ecs ? 'ALB to task security group' : 'ALB Ingress to workload targets', micro ? '4000 gateway; 4001 backend; 3000 UI' : 'HTTP 4000 to LiteLLM'] },
      { x: 715, y: 765, anchor: 'middle', lines: [ecs ? 'ALB to task security group' : 'ALB Ingress to workload targets', micro ? '4000 gateway; 4001 backend; 3000 UI' : 'HTTP 4000 to LiteLLM'] },
      { x: 285, y: 1018, anchor: 'middle', lines: [ecs ? 'DB / cache ingress: task security group' : 'DB / cache ingress: app security group'] },
      { x: 715, y: 1018, anchor: 'middle', lines: ['Replicas; writes use writer / primary'] },
      { x: 490, y: 1085, anchor: 'middle', lines: [ecs ? 'Private default route: NAT A. Public default route: Internet gateway.' : 'Private default route: same-AZ NAT. Public default route: Internet gateway.'] },
      { x: 1085, y: 277, anchor: 'middle', lines: ['Public HTTPS endpoints', 'through NAT by default'] },
      { x: 1085, y: 1035, anchor: 'middle', lines: ['PrivateLink: bedrock-runtime', 'Optional; no NAT on this path'] },
      ...(ecs ? [{ x: 605, y: 430, anchor: 'middle' as const, lines: ['No NAT in AZ B', 'Uses NAT in AZ A'] }] : []),
    ],
    notes: ecs ? [
      { title: 'Exact module scope', text: 'The module creates one public and one private subnet for each supplied AZ, and one NAT gateway in the first public subnet. Supply at least two AZs. With an existing VPC, provide the subnets and routes yourself. Tasks, Aurora, and Redis share the private subnet set.' },
      { title: 'Placement and availability', text: 'Gateway defaults to two tasks; backend and UI each default to one. Workload and Aurora AZ positions here are illustrative, not task placement guarantees. Both AZs use the Aurora writer endpoint and Redis primary endpoint. Aurora has a reader, and Redis has one replica by default; replication paths are omitted. Add per-AZ NAT gateways and service replicas to meet your availability requirements.' },
      { title: 'Security and egress', text: 'Supply acm_certificate_arn for HTTPS. TLS terminates at the ALB. The task security group allows all TCP ports from the ALB security group; the diagram labels the actual target ports. Aurora allows 5432 and Redis allows 6379 from tasks only. Tasks have no public IP. External providers, GHCR, and public AWS service endpoints use NAT. DNS records, WAF, and ECR repositories are not created by this module.' },
      { title: 'Optional PrivateLink', text: 'Bedrock interface endpoints are additions, not module defaults. Use com.amazonaws.<region>.bedrock-runtime, private DNS, and endpoint security group ingress 443 from tasks. Grant Bedrock IAM permissions separately. The bedrock endpoint is for the control plane. Private access to your own LiteLLM service needs a separate endpoint-service design.' },
    ] : [
      { title: 'Infrastructure around Helm', text: 'This is a recommended network example, not resources created by a Helm install. Provision the VPC, ALB integration, private EKS workers, Aurora, Redis, and per-AZ NAT gateways separately. Configure AWS Load Balancer Controller and Ingress for the chosen chart. Direct pod targets assume alb.ingress.kubernetes.io/target-type: ip; instance mode instead targets NodePorts. Configure secrets and container log collection separately.' },
      { title: 'Availability and access', text: 'Spread replicas across AZs and set disruption budgets. Both AZs use the writer and primary endpoints by default; replication paths are omitted. The data icons illustrate a writer/reader and primary/replica design; select the database and cache topology you need. Allow ALB traffic to workload targets and allow database/cache traffic only from application security groups. Use a private EKS API endpoint where appropriate.' },
      { title: 'Optional PrivateLink', text: 'The interface endpoints shown provide private Bedrock inference access through com.amazonaws.<region>.bedrock-runtime. Enable private DNS and allow HTTPS from workloads on the endpoint security group. Use pod identity and grant Bedrock permissions. Public providers and registries still need outbound access.' },
    ],
    sources: [
      ...(ecs ? [
        { label: 'Terraform network and security groups (pinned)', url: `${MODULE}/network.tf` },
        { label: 'Terraform ALB routes and TLS (pinned)', url: `${MODULE}/alb.tf` },
        { label: 'Terraform ECS services (pinned)', url: `${MODULE}/ecs.tf` },
        { label: 'Terraform defaults (pinned)', url: `${MODULE}/variables.tf` },
      ] : [
        { label: 'AWS EKS load balancing', url: 'https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html' },
        { label: 'EKS cluster endpoint access', url: 'https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html' },
      ]),
      { label: 'AWS web application reference architecture', url: 'https://docs.aws.amazon.com/reference-architecture-diagrams/latest/web-application-architecture/web-application-architecture.html' },
      { label: 'AWS NAT gateway availability', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html' },
      { label: 'Bedrock interface VPC endpoints', url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/vpc-interface-endpoints.html' },
    ],
  };
}
