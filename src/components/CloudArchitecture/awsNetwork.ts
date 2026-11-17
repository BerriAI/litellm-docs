import type { CloudKey, NetworkDiagram } from './networkTypes';

const MODULE = 'https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws';

export function makeAwsNetworkDiagram(cloud: CloudKey): NetworkDiagram {
  const ecs = cloud === 'aws-ecs';
  const micro = ecs || cloud === 'aws-eks-micro';
  return {
    title: ecs ? 'AWS ECS Fargate: private deployment' : `AWS EKS: ${micro ? 'separate services' : 'single service'}`,
    description: 'Corporate clients use an internal ALB. Private workloads share database and cache endpoints. NAT serves outbound traffic only.',
    provider: 'aws', width: 1560, height: 650,
    groups: [
      { id: 'aws', x: 360, y: 120, width: 1180, height: 510, label: 'AWS Region', kind: 'cloud', icon: 'aws-cloud.svg' },
      { id: 'vpc', x: 380, y: 165, width: 880, height: 445, label: 'VPC', kind: 'vpc', icon: 'aws-vpc.svg' },
      { id: 'private', x: 400, y: 210, width: 630, height: 380, label: 'Private subnets', kind: 'private', icon: 'aws-private-subnet.svg' },
      { id: 'az-a', x: 620, y: 255, width: 180, height: 130, label: 'AZ A', kind: 'az' },
      { id: 'az-b', x: 830, y: 255, width: 180, height: 130, label: 'AZ B', kind: 'az' },
      { id: 'public', x: 1050, y: 250, width: 185, height: 150, label: 'Public egress', kind: 'public', icon: 'aws-public-subnet.svg' },
      { id: 'regional-services', x: 1300, y: 350, width: 220, height: 240, label: 'AWS services', kind: 'managed' },
    ],
    nodes: [
      { id: 'clients', x: 85, y: 320, title: ['Employees / apps'] },
      { id: 'private-access', x: 260, y: 320, title: ['Private access'], detail: ['VPN / Direct Connect'] },
      { id: 'alb', x: 470, y: 320, icon: 'aws-alb.svg', title: ['Internal ALB'], detail: ['HTTPS 443'] },
      { id: 'compute-a', x: 710, y: 320, icon: ecs ? 'aws-fargate.svg' : 'aws-eks.svg', title: [ecs ? 'Fargate tasks' : 'EKS pods'], detail: [micro ? 'Separate services' : 'Proxy replicas'] },
      { id: 'compute-b', x: 920, y: 320, icon: ecs ? 'aws-fargate.svg' : 'aws-eks.svg', title: [ecs ? 'Fargate tasks' : 'EKS pods'], detail: [micro ? 'Separate services' : 'Proxy replicas'] },
      { id: 'nat', x: 1140, y: 320, icon: 'aws-nat-gateway.svg', title: ['NAT gateway'], detail: [ecs ? 'One shared NAT' : 'One per AZ'] },
      { id: 'igw', x: 1260, y: 300, icon: 'aws-internet-gateway.svg', title: ['Internet gateway'] },
      { id: 'external', x: 1450, y: 50, title: ['Public LLM APIs'], detail: ['Image registries'] },
      { id: 'aws-apis', x: 1410, y: 410, icon: 'aws-cloud.svg', title: ['Secrets / S3 / Logs'], detail: ['HTTPS 443'] },
      { id: 'endpoint', x: 470, y: 500, icon: 'aws-vpc-endpoint.svg', title: ['Bedrock endpoints'], detail: ['Optional 443'] },
      { id: 'aurora', x: 710, y: 500, icon: 'aws-aurora.svg', title: ['Aurora'], detail: ['5432, writer + reader'] },
      { id: 'redis', x: 920, y: 500, icon: 'aws-elasticache.svg', title: ['Redis'], detail: ['6379 TLS, primary + replica'] },
      { id: 'bedrock', x: 1410, y: 520, icon: 'aws-bedrock.svg', title: ['Bedrock runtime'] },
    ],
    edges: [
      { points: [[107, 320], [238, 320]], kind: 'request' },
      { points: [[282, 320], [448, 320]], kind: 'request' },
      { points: [[492, 320], [580, 320], [580, 240], [920, 240]], kind: 'request', arrow: false, label: micro ? '4000 / 4001 / 3000' : '4000', labelX: 680, labelY: 226 },
      { points: [[710, 240], [710, 298]], kind: 'request' },
      { points: [[920, 240], [920, 298]], kind: 'request' },
      { points: [[710, 390], [710, 420], [920, 420]], kind: 'data', arrow: false },
      { points: [[920, 390], [920, 420]], kind: 'data', arrow: false },
      { points: [[710, 420], [710, 478]], kind: 'data' },
      { points: [[920, 420], [920, 478]], kind: 'data' },
      { points: [[732, 310], [805, 310], [805, 200], [1035, 200], [1035, 320], [1118, 320]], kind: 'egress' },
      { points: [[942, 310], [1015, 310], [1015, 200]], kind: 'egress', arrow: false },
      { points: [[1162, 320], [1200, 320], [1200, 300], [1238, 300]], kind: 'egress' },
      { points: [[1282, 300], [1330, 300], [1330, 50], [1428, 50]], kind: 'egress' },
      { points: [[1330, 300], [1490, 300], [1490, 410], [1432, 410]], kind: 'egress' },
      { points: [[688, 330], [600, 330], [600, 455], [470, 455], [470, 478]], kind: 'optional' },
      { points: [[898, 330], [825, 330], [825, 455], [600, 455]], kind: 'optional', arrow: false },
      { points: [[492, 500], [570, 500], [570, 575], [1280, 575], [1280, 520], [1388, 520]], kind: 'optional' },
    ],
    junctions: [
      { x: 710, y: 240, kind: 'request' },
      { x: 710, y: 420, kind: 'data' },
      { x: 920, y: 420, kind: 'data' },
      { x: 1015, y: 200, kind: 'egress' },
      { x: 1330, y: 300, kind: 'egress' },
      { x: 600, y: 455, kind: 'optional' },
    ],
    notes: ecs ? [
      { title: 'One image', text: 'The gateway, backend, UI, and migration job use the same image with a different startup argument for each component.' },
      { title: 'Required module changes', text: 'The module creates an internet-facing ALB. In your fork, set internal=true, select private ALB subnets, update the subnet precondition, and restrict port 443 to corporate source ranges. Remove public HTTP ingress. Add private access routes and private DNS. These are source changes, not module inputs.' },
      { title: 'Base module resources', text: 'The module creates one public and one private subnet for each supplied AZ, and one NAT gateway in the first public subnet. Supply at least two AZs. With an existing VPC, provide the subnets and routes yourself. Tasks, Aurora, and Redis share the private subnet set.' },
      { title: 'Placement and availability', text: 'The gateway defaults to two tasks. The backend and UI each default to one. Workload placements are illustrative. Data icons show shared endpoints, not AZ placement. Both AZs use the Aurora writer endpoint and Redis primary endpoint. Aurora has a reader, and Redis has one replica by default. The diagram omits replication paths. Add per-AZ NAT gateways and service replicas to meet your availability requirements.' },
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
