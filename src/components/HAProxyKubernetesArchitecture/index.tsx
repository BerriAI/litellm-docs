import React from 'react';
import {NetworkDiagramViewer} from '../CloudArchitecture/NetworkArchitecture';
import type {NetworkDiagram} from '../CloudArchitecture/networkTypes';

const diagram: NetworkDiagram = {
  title: 'HAProxy + LiteLLM',
  description: 'HAProxy buffers bursts and routes requests to ready LiteLLM pods.',
  provider: 'kubernetes',
  width: 1260,
  height: 550,
  groups: [
    {id: 'cluster', x: 165, y: 20, width: 725, height: 510, label: 'Kubernetes cluster', kind: 'cloud', icon: 'kubernetes.svg'},
    {id: 'scaling', x: 330, y: 370, width: 530, height: 140, label: 'Autoscaling', kind: 'cloud', dotted: true},
    {id: 'providers', x: 960, y: 85, width: 280, height: 205, label: 'Model providers', kind: 'cloud'},
    {id: 'state', x: 960, y: 370, width: 280, height: 140, label: '', kind: 'cloud'},
  ],
  nodes: [
    {id: 'clients', x: 65, y: 200, title: ['Applications']},
    {id: 'service', x: 250, y: 200, icon: '../kubernetes-icons/svc.svg', title: ['Service']},
    {id: 'haproxy', x: 460, y: 200, icon: 'haproxy.svg', title: ['HAProxy'], detail: ['2+ replicas']},
    {id: 'gateway', x: 735, y: 200, icon: '../brand/litellm-monogram-blue.svg', title: ['LiteLLM pods']},
    {id: 'openai', x: 1010, y: 195, icon: '../zerobus/logos/openai.svg', title: ['OpenAI']},
    {id: 'anthropic', x: 1100, y: 195, icon: '../zerobus/logos/anthropic.svg', title: ['Anthropic']},
    {id: 'google', x: 1190, y: 195, icon: '../zerobus/logos/google.svg', title: ['Google']},
    {id: 'prometheus', x: 460, y: 435, icon: '../integrations/prometheus.svg', title: ['Prometheus']},
    {id: 'keda', x: 735, y: 435, icon: 'keda.svg', title: ['KEDA']},
    {id: 'postgres', x: 1035, y: 435, icon: 'postgresql.svg', title: ['PostgreSQL']},
    {id: 'redis', x: 1170, y: 435, icon: 'redis.svg', title: ['Redis']},
  ],
  edges: [
    {points: [[87, 200], [228, 200]], kind: 'request'},
    {points: [[272, 200], [438, 200]], kind: 'request'},
    {points: [[482, 200], [713, 200]], kind: 'request'},
    {points: [[757, 190], [925, 190], [925, 140], [1190, 140]], kind: 'egress', arrow: false},
    ...[1010, 1100, 1190].map(x => ({points: [[x, 140], [x, 173]] as [number, number][], kind: 'egress' as const})),
    {points: [[757, 210], [910, 210], [910, 335], [1170, 335]], kind: 'data', arrow: false},
    ...[1035, 1170].map(x => ({points: [[x, 335], [x, 413]] as [number, number][], kind: 'data' as const})),
    {points: [[713, 210], [585, 210], [585, 320], [460, 320], [460, 413]], kind: 'optional'},
    {points: [[482, 435], [713, 435]], kind: 'optional'},
    {points: [[735, 413], [735, 330], [830, 330], [830, 220], [757, 220]], kind: 'optional'},
  ],
  junctions: [
    {x: 1010, y: 140, kind: 'egress'},
    {x: 1100, y: 140, kind: 'egress'},
    {x: 1035, y: 335, kind: 'data'},
  ],
  legend: [
    {kind: 'request', label: 'Requests'},
    {kind: 'egress', label: 'Provider calls'},
    {kind: 'optional', label: 'Metrics / scaling'},
  ],
  notes: [
    {title: 'Queues', text: 'Each HAProxy replica owns its queues. Only unassigned requests can use any ready pod; requests queued inside a worker stay with that worker.'},
    {title: 'Scaling', text: 'Prometheus collects admission metrics through metrics sidecars. KEDA uses those metrics to scale the gateway Deployment across zones.'},
  ],
  sources: [
    {label: 'HAProxy configuration', url: 'https://docs.haproxy.org/3.2/configuration.html'},
    {label: 'KEDA Prometheus scaler', url: 'https://keda.sh/docs/2.18/scalers/prometheus/'},
  ],
};

export default function HAProxyKubernetesArchitecture() {
  return <NetworkDiagramViewer diagram={diagram} caption={<>Each <a href="https://docs.haproxy.org/3.2/configuration.html">HAProxy</a> replica owns its queues; <a href="https://keda.sh/docs/2.18/scalers/prometheus/">KEDA</a> scales LiteLLM using Prometheus admission metrics.</>} />;
}
