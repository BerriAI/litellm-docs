export type CloudKey =
  | 'aws-ecs' | 'aws-eks' | 'aws-eks-micro'
  | 'gcp-cloud-run' | 'gcp-gke' | 'gcp-gke-micro'
  | 'azure-aks' | 'azure-aks-micro';

export type NetworkGroup = {
  id: string;
  x: number; y: number; width: number; height: number;
  label: string;
  kind: 'cloud' | 'region' | 'vpc' | 'az' | 'public' | 'private' | 'managed' | 'optional' | 'project' | 'subnet';
  icon?: string;
};

// x/y are the center of the 44px service icon. Titles start at y + 39;
// each title/detail line adds 18px. Keep at least 150px between node centers.
export type NetworkNode = {
  id: string;
  x: number; y: number;
  icon?: string;
  title: string[];
  detail?: string[];
};

export type NetworkEdge = {
  points: [number, number][];
  kind: 'request' | 'data' | 'egress' | 'optional';
  arrow?: boolean;
  label?: string;
  labelX?: number; labelY?: number;
};

export type NetworkAnnotation = {
  x: number; y: number;
  lines: string[];
  anchor?: 'start' | 'middle' | 'end';
};

export type NetworkDiagram = {
  title: string;
  description: string;
  provider: 'aws' | 'gcp' | 'azure';
  width: number; height: number;
  groups: NetworkGroup[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  junctions?: { x: number; y: number; kind: NetworkEdge['kind'] }[];
  annotations?: NetworkAnnotation[];
  notes: { title: string; text: string }[];
  sources: { label: string; url: string }[];
};
