import React, {useId} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function CacheAwareRoutingDiagram() {
  const id = useId().replace(/:/g, '');
  const podIcon = useBaseUrl('/img/kubernetes-icons/pod.svg');
  const serviceIcon = useBaseUrl('/img/kubernetes-icons/svc.svg');
  const clusterIcon = useBaseUrl('/img/cloud_icons/kubernetes.svg');
  const arrow = (name) => `url(#${id}-${name})`;

  return (
    <figure className={styles.figure}>
      <div className={styles.viewport}>
        <svg className={styles.diagram} viewBox="0 0 760 568" role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>Cache-aware routing to Kubernetes inference pods</title>
          <desc id={`${id}-description`}>
            LiteLLM discovers ready pod IPs through a headless Service, then sends
            requests directly to the pods. A stable session ID selects the same
            pod while the deployment and pod set stay unchanged. Requests without
            a session ID use round robin across the pods.
          </desc>
          <defs>
            {['session', 'roundRobin', 'discovery'].map((kind) => (
              <marker key={kind} id={`${id}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles[`${kind}Arrow`]} />
              </marker>
            ))}
          </defs>

          <rect x="40" y="12" width="250" height="68" rx="12" className={styles.card} />
          <text x="165" y="40" textAnchor="middle" className={styles.title}>Client requests</text>
          <text x="165" y="62" textAnchor="middle" className={styles.subtitle}>session: conversation-123</text>

          <rect x="16" y="108" width="728" height="442" rx="18" className={styles.cluster} />
          <image href={clusterIcon} x="516" y="121" width="25" height="25" />
          <text x="550" y="139" className={styles.clusterLabel}>Kubernetes cluster</text>

          <path d="M 165 80 V 162" className={styles.session} markerEnd={arrow('session')} />
          <rect x="40" y="166" width="250" height="88" rx="12" className={styles.gateway} />
          <text x="165" y="201" textAnchor="middle" className={styles.title}>LiteLLM Gateway</text>
          <text x="165" y="225" textAnchor="middle" className={styles.subtitle}>Select deployment, then pod</text>

          <path d="M 458 210 H 296" className={styles.discovery} markerEnd={arrow('discovery')} />
          <text x="375" y="192" textAnchor="middle" className={styles.connectorLabel}>Discover pod IPs</text>
          <rect x="462" y="166" width="250" height="88" rx="12" className={styles.card} />
          <image href={serviceIcon} x="478" y="181" width="56" height="56" />
          <text x="547" y="201" className={styles.title}>Headless Service</text>
          <text x="547" y="225" className={styles.subtitle}>DNS discovery</text>

          <path d="M 165 254 V 346 H 140 V 388" className={styles.roundRobin} markerEnd={arrow('roundRobin')} />
          <path d="M 165 346 H 620 V 388" className={styles.roundRobin} markerEnd={arrow('roundRobin')} />
          <path d="M 380 346 V 388" className={styles.roundRobin} markerEnd={arrow('roundRobin')} />
          <path d="M 165 254 V 302 H 380 V 388" className={styles.session} markerEnd={arrow('session')} />
          <text x="392" y="307" className={styles.sessionLabel}>Same session, same pod</text>

          {[40, 280, 520].map((x, index) => (
            <g key={x}>
              <rect x={x} y="394" width="200" height="94" rx="12" className={index === 1 ? styles.selectedPod : styles.card} />
              <image href={podIcon} x={x + 14} y="412" width="56" height="56" />
              <text x={x + 82} y="432" className={styles.title}>Pod {index + 1}</text>
              <text x={x + 82} y="456" className={styles.subtitle}>Prompt cache</text>
            </g>
          ))}

          <path d="M 42 520 H 72" className={styles.session} />
          <text x="82" y="525" className={styles.legend}>Session affinity</text>
          <path d="M 292 520 H 322" className={styles.roundRobin} />
          <text x="332" y="525" className={styles.legend}>No session ID: round robin</text>
        </svg>
      </div>
      <figcaption>LiteLLM connects directly to the selected pod; the headless Service provides discovery.</figcaption>
    </figure>
  );
}
