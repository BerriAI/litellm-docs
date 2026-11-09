import React, {useId} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function CrossClusterRoutingDiagram() {
  const id = useId().replace(/:/g, '');
  const podIcon = useBaseUrl('/img/kubernetes-icons/pod.svg');
  const serviceIcon = useBaseUrl('/img/kubernetes-icons/svc.svg');
  const clusterIcon = useBaseUrl('/img/cloud_icons/kubernetes.svg');
  const arrow = (name) => `url(#${id}-${name})`;

  return (
    <figure className={styles.figure}>
      <div className={styles.viewport}>
        <svg className={styles.diagram} viewBox="0 0 760 650" role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>Two-tier cache-aware routing across GPU clusters</title>
          <desc id={`${id}-description`}>
            A top-level LiteLLM instance C uses session affinity to select LiteLLM
            A or B in separate GPU clusters. The selected instance discovers its
            local pods and uses the forwarded session ID to select a stable pod.
            The highlighted example routes conversation-123 through C to A to
            Pod A1. Each GPU cluster has its own headless Service and prompt caches.
          </desc>
          <defs>
            {['session', 'roundRobin', 'discovery'].map((kind) => (
              <marker key={kind} id={`${id}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles[`${kind}Arrow`]} />
              </marker>
            ))}
          </defs>

          <rect x="250" y="8" width="260" height="58" rx="12" className={styles.card} />
          <text x="380" y="32" textAnchor="middle" className={styles.title}>Client requests</text>
          <text x="380" y="53" textAnchor="middle" className={styles.subtitle}>session: conversation-123</text>
          <path d="M 380 66 V 104" className={styles.session} markerEnd={arrow('session')} />

          <rect x="230" y="110" width="300" height="76" rx="12" className={styles.gateway} />
          <text x="380" y="141" textAnchor="middle" className={styles.title}>Top-level LiteLLM C</text>
          <text x="380" y="165" textAnchor="middle" className={styles.subtitle}>Session affinity selects A or B</text>

          {[16, 392].map((x) => (
            <rect key={x} x={x} y="250" width="352" height="384" rx="18" className={styles.cluster} />
          ))}
          <path d="M 380 186 V 218 H 568 V 300" className={styles.roundRobin} markerEnd={arrow('roundRobin')} />
          <path d="M 380 186 V 218 H 192 V 300" className={styles.session} markerEnd={arrow('session')} />
          <text x="180" y="210" textAnchor="end" className={styles.sessionLabel}>This session</text>
          <text x="580" y="210" className={styles.subtitle}>Other cluster target</text>

          {[{name: 'A', x: 16}, {name: 'B', x: 392}].map(({name, x}, index) => {
            const selected = index === 0;
            const center = x + 176;
            const routeClass = selected ? styles.session : styles.roundRobin;
            const routeArrow = arrow(selected ? 'session' : 'roundRobin');
            return (
              <g key={name}>
                <image href={clusterIcon} x={x + 20} y="265" width="24" height="24" />
                <text x={x + 54} y="282" className={styles.clusterLabel}>GPU cluster {name}</text>

                <rect x={x + 48} y="306" width="256" height="70" rx="12" className={selected ? styles.gateway : styles.card} />
                <text x={center} y="334" textAnchor="middle" className={styles.title}>LiteLLM {name}</text>
                <text x={center} y="357" textAnchor="middle" className={styles.subtitle}>Local pod discovery + affinity</text>

                <path d={`M ${center} 412 V 382`} className={styles.discovery} markerEnd={arrow('discovery')} />
                <rect x={x + 70} y="418" width="212" height="58" rx="10" className={styles.card} />
                <image href={serviceIcon} x={x + 82} y="427" width="40" height="40" />
                <text x={x + 134} y="442" className={styles.resourceTitle}>Headless Service</text>
                <text x={x + 134} y="461" className={styles.resourceSubtitle}>Local DNS</text>

                <path d={`M ${x + 60} 376 V 494 H ${x + 264} V 512`} className={styles.roundRobin} markerEnd={arrow('roundRobin')} />
                <path d={`M ${x + 60} 376 V 494 H ${x + 96} V 512`} className={routeClass} markerEnd={routeArrow} />

                {[24, 192].map((offset, podIndex) => {
                  const podX = x + offset;
                  return (
                    <g key={offset}>
                      <rect x={podX} y="518" width="144" height="98" rx="12" className={selected && podIndex === 0 ? styles.selectedPod : styles.card} />
                      <image href={podIcon} x={podX + 52} y="528" width="40" height="40" />
                      <text x={podX + 72} y="588" textAnchor="middle" className={styles.resourceTitle}>GPU pod {name}{podIndex + 1}</text>
                      <text x={podX + 72} y="607" textAnchor="middle" className={styles.resourceSubtitle}>Prompt cache</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption>C pins the cluster; A or B pins the local GPU pod. Forward the same session ID through both tiers.</figcaption>
    </figure>
  );
}
