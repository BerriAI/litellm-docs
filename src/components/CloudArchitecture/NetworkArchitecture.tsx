import React, { useId, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { makeAwsNetworkDiagram } from './awsNetwork';
import { makeGcpNetworkDiagram } from './gcpNetwork';
import { makeAzureNetworkDiagram } from './azureNetwork';
import { routeNetworkEdges } from './networkRouting';
import type { CloudKey, NetworkDiagram, NetworkGroup } from './networkTypes';
import styles from './network.module.css';

const PATH_COLORS = {
  request: 'var(--network-request)',
  data: 'var(--network-data)',
  egress: 'var(--network-egress)',
  optional: 'var(--network-optional)',
};

const GROUP_COLORS: Record<NetworkGroup['kind'], { stroke: string; fill: string }> = {
  cloud: { stroke: 'var(--network-outline)', fill: 'var(--network-bg)' },
  region: { stroke: 'var(--network-muted)', fill: 'var(--network-bg)' },
  vpc: { stroke: 'var(--network-optional)', fill: 'var(--network-bg)' },
  az: { stroke: 'var(--network-muted)', fill: 'var(--network-bg)' },
  public: { stroke: 'var(--network-public)', fill: 'var(--network-public-bg)' },
  private: { stroke: 'var(--network-private)', fill: 'var(--network-private-bg)' },
  managed: { stroke: 'var(--network-muted)', fill: 'var(--network-managed-bg)' },
  optional: { stroke: PATH_COLORS.optional, fill: 'var(--network-optional-bg)' },
  project: { stroke: 'var(--network-muted)', fill: 'var(--network-bg)' },
  subnet: { stroke: 'var(--network-request)', fill: 'var(--network-private-bg)' },
};

function NetworkSvg({ diagram }: { diagram: NetworkDiagram }) {
  const instanceId = useId().replace(/:/g, '');
  const iconRoot = useBaseUrl('/img/cloud_icons/');
  const edgePaths = routeNetworkEdges(diagram);
  const groupColors = {
    ...GROUP_COLORS,
    ...(diagram.provider === 'gcp' ? { vpc: { stroke: 'var(--network-request)', fill: 'var(--network-bg)' }, project: { stroke: 'var(--network-request)', fill: 'var(--network-bg)' } } : {}),
    ...(diagram.provider === 'azure' ? { vpc: { stroke: 'var(--network-request)', fill: 'var(--network-bg)' } } : {}),
  };
  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={diagram.width}
      height={diagram.height}
      role="img"
      aria-labelledby={`${instanceId}-title`}
      aria-describedby={`${instanceId}-description`}
    >
      <title id={`${instanceId}-title`}>{diagram.title}</title>
      <desc id={`${instanceId}-description`}>
        {diagram.description} {diagram.notes.map(note => `${note.title}: ${note.text}`).join(' ')}
      </desc>
      <defs>
        {Object.entries(PATH_COLORS).map(([kind, color]) => (
          <marker key={kind} id={`${instanceId}-${kind}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0 0 L8 4 L0 8 Z" fill={color} />
          </marker>
        ))}
      </defs>
      {diagram.groups.map(group => (
        <g key={group.id}>
          <rect
            x={group.x} y={group.y} width={group.width} height={group.height}
            fill={groupColors[group.kind].fill}
            stroke={groupColors[group.kind].stroke}
            strokeWidth="1.5"
            strokeDasharray={group.kind === 'optional' || group.kind === 'az' ? '7 5' : undefined}
          />
          {group.icon && <g><rect className={styles.iconTile} x={group.x + 8} y={group.y + 7} width="26" height="26" rx="3" /><image href={`${iconRoot}${group.icon}`} x={group.x + 10} y={group.y + 9} width="22" height="22" preserveAspectRatio="xMidYMid meet" /></g>}
          <text x={group.x + (group.icon ? 40 : 12)} y={group.y + 25} className={styles.groupLabel} fill={groupColors[group.kind].stroke}>
            {group.label}
          </text>
        </g>
      ))}
      {diagram.edges.map((edge, index) => (
        <g key={index}>
          <path
            d={edgePaths[index]}
            data-network-edge={edge.kind}
            data-points={edge.points.map(point => point.join(',')).join(' ')}
            fill="none" stroke={PATH_COLORS[edge.kind]} strokeWidth="1.7"
            strokeLinejoin="round" strokeDasharray={edge.kind === 'optional' ? '7 5' : undefined}
            markerEnd={edge.arrow === false ? undefined : `url(#${instanceId}-${edge.kind})`}
          />
          {edge.label && <text x={edge.labelX} y={edge.labelY} className={styles.edgeLabel} fill={PATH_COLORS[edge.kind]}>{edge.label}</text>}
        </g>
      ))}
      {diagram.junctions?.map(junction => (
        <circle key={`${junction.kind}-${junction.x}-${junction.y}`} cx={junction.x} cy={junction.y} r="3.5" fill={PATH_COLORS[junction.kind]} />
      ))}
      {diagram.nodes.map(node => (
        <g key={node.id}>
          {node.icon ? (
            <g><rect className={styles.iconTile} x={node.x - 25} y={node.y - 25} width="50" height="50" rx="5" /><image href={`${iconRoot}${node.icon}`} x={node.x - 22} y={node.y - 22} width="44" height="44" preserveAspectRatio="xMidYMid meet" /></g>
          ) : (
            <g fill="none" stroke="var(--network-outline)" strokeWidth="2">
              <rect x={node.x - 22} y={node.y - 18} width="44" height="30" rx="2" />
              <path d={`M${node.x},${node.y + 12} v9 M${node.x - 12},${node.y + 21} h24`} />
            </g>
          )}
          {node.title.map((line, index) => <text key={`title-${index}`} x={node.x} y={node.y + 39 + index * 18} textAnchor="middle" className={styles.nodeTitle}>{line}</text>)}
          {node.detail?.map((line, index) => <text key={`detail-${index}`} x={node.x} y={node.y + 39 + (node.title.length + index) * 18} textAnchor="middle" className={styles.nodeDetail}>{line}</text>)}
        </g>
      ))}
      {diagram.annotations?.map((annotation, index) => (
        <text key={index} x={annotation.x} y={annotation.y} textAnchor={annotation.anchor ?? 'start'} className={styles.annotation}>
          {annotation.lines.map((line, lineIndex) => <tspan key={lineIndex} x={annotation.x} dy={lineIndex === 0 ? 0 : 18}>{line}</tspan>)}
        </text>
      ))}
    </svg>
  );
}

function Legend() {
  return (
    <div className={styles.legend} aria-label="Diagram legend">
      <span><i style={{ borderColor: PATH_COLORS.request }} />Requests</span>
      <span><i style={{ borderColor: PATH_COLORS.data }} />Private traffic</span>
      <span><i style={{ borderColor: PATH_COLORS.egress }} />Egress</span>
      <span><i className={styles.optionalLine} style={{ borderColor: PATH_COLORS.optional }} />Optional</span>
      <span>Dots join paths. Bridges cross them.</span>
    </div>
  );
}

export function NetworkArchitecture({ cloud }: { cloud: CloudKey }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const expandedViewport = useRef<HTMLDivElement>(null);
  const diagram = cloud.startsWith('aws') ? makeAwsNetworkDiagram(cloud)
    : cloud.startsWith('gcp') ? makeGcpNetworkDiagram(cloud) : makeAzureNetworkDiagram(cloud);

  return (
    <section className={styles.viewer} aria-label={diagram.title}>
      <div className={styles.toolbar}>
        <strong>{diagram.title}</strong>
        <button type="button" className={styles.expandButton} onClick={() => { dialog.current?.showModal(); expandedViewport.current?.scrollTo(0, 0); }}>Expand diagram</button>
      </div>
      <Legend />
      <div className={styles.viewport} tabIndex={0} role="region" aria-label={`${diagram.title}, diagram preview`}>
        <NetworkSvg diagram={diagram} />
      </div>
      <p className={styles.description}>{diagram.description}</p>
      <details className={styles.details}>
        <summary>Architecture details and references</summary>
        <dl className={styles.notes}>
          {diagram.notes.map(note => <div key={note.title}><dt>{note.title}</dt><dd>{note.text}</dd></div>)}
        </dl>
        <p className={styles.sources}>
          Design references: {diagram.sources.map((source, index) => <React.Fragment key={source.url}>{index > 0 && ' · '}<a href={source.url}>{source.label}</a></React.Fragment>)}
        </p>
      </details>
      <dialog ref={dialog} className={styles.dialog} aria-label={diagram.title} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className={styles.dialogHeader}>
          <strong>{diagram.title}</strong>
          <button type="button" className={styles.expandButton} onClick={() => dialog.current?.close()} autoFocus>Close diagram</button>
        </div>
        <Legend />
        <div ref={expandedViewport} className={styles.expandedViewport} tabIndex={0} role="region" aria-label="Expanded network diagram">
          <NetworkSvg diagram={diagram} />
        </div>
      </dialog>
    </section>
  );
}
