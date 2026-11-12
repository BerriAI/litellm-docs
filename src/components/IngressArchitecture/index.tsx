import React, { useId, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Kind = 'mtls-aws' | 'mtls-azure' | 'mtls-gcp' | 'mtls-nginx' | 'mtls-haproxy' | 'mtls-kong' | 'iap-aws' | 'iap-azure' | 'iap-gcp' | 'iap-cloudflare';
type Actor = { name: string[]; icon?: string; symbol?: 'client' | 'shield' };
type Event =
  | { type: 'message'; from: number; to: number; label: string[] }
  | { type: 'action'; at: number; label: string[] }
  | { type: 'response' };
type Sequence = { title: string; actors: Actor[]; events: Event[]; identity: string; note: string };

const caller: Actor = { name: ['Corporate client'], symbol: 'client' };
const litellm: Actor = { name: ['LiteLLM', 'Private origin'], icon: 'brand/litellm-monogram-blue.svg' };
const nginx: Actor = { name: ['NGINX'], symbol: 'shield' };
const alb: Actor = { name: ['Internal ALB'], icon: 'cloud_icons/aws-alb.svg' };
const request = (from: number, to: number, ...label: string[]): Event => ({ type: 'message', from, to, label });
const action = (at: number, ...label: string[]): Event => ({ type: 'action', at, label });
const response: Event = { type: 'response' };

function mtls(edge: Actor, mapping: string, note: string, title = `${edge.name.join(' ')} mTLS sequence`): Sequence {
  return {
    title,
    actors: [caller, edge, litellm],
    events: [
      request(0, 1, 'TLS handshake', 'Client certificate'),
      action(1, 'Verify certificate'),
      request(0, 1, 'API request', '+ LiteLLM key'),
      action(1, mapping),
      request(1, 2, 'Certificate identity', '+ LiteLLM key'),
      action(2, 'Check key + policies', 'Record customer ID'),
      response,
    ],
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    note,
  };
}

function assertionSequence(edge: Actor, adapter: Actor, assertion: string, note: string): Sequence {
  return {
    title: `${edge.name.join(' ')} sequence`,
    actors: [caller, edge, adapter, litellm],
    events: [
      request(0, 1, 'Request + identity'),
      action(1, 'Check identity', 'and access policy'),
      request(1, 2, 'Signed assertion'),
      action(2, 'Add Bearer prefix'),
      request(2, 3, 'Bearer assertion'),
      action(3, 'Verify JWT', 'Apply user/team rules'),
      response,
    ],
    identity: `${assertion} → X-LiteLLM-IAP-Token`,
    note,
  };
}

const sequences: Record<Kind, Sequence> = {
  'mtls-aws': {
    title: 'AWS ALB mTLS sequence',
    actors: [caller, alb, nginx, litellm],
    events: [
      request(0, 1, 'TLS handshake', 'Client certificate'),
      action(1, 'Verify certificate'),
      request(0, 1, 'API request', '+ LiteLLM key'),
      request(1, 2, 'Certificate fields', '+ LiteLLM key'),
      action(2, 'Map certificate', 'to workload ID'),
      request(2, 3, 'Workload ID', '+ LiteLLM key'),
      action(3, 'Check key + policies', 'Record customer ID'),
      response,
    ],
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    note: 'NGINX maps the ALB certificate headers to an approved workload. LiteLLM uses the key for permissions and the workload ID for customer policies.',
  },
  'mtls-azure': mtls(
    { name: ['Application', 'Gateway'], icon: 'cloud_icons/azure-application-gateways.svg' },
    'Set issuer + serial',
    'Application Gateway overwrites the identity header with the verified issuer and serial. LiteLLM uses them as the customer ID.',
  ),
  'mtls-gcp': mtls(
    { name: ['Internal ALB'], icon: 'cloud_icons/gcp-cloud-load-balancing.svg' },
    'Set fingerprint',
    'The URL map overwrites the identity header with the verified certificate fingerprint. LiteLLM uses it as the customer ID.',
    'Google Cloud ALB mTLS sequence',
  ),
  'mtls-nginx': mtls(nginx, 'Map workload ID', 'NGINX maps the approved certificate to a workload ID. LiteLLM uses the key for permissions and the workload ID for customer policies.'),
  'mtls-haproxy': mtls(
    { name: ['HAProxy'], symbol: 'shield' },
    'Map workload ID',
    'HAProxy maps the approved certificate fingerprint to a workload ID. LiteLLM uses the key for permissions and the workload ID for customer policies.',
  ),
  'mtls-kong': {
    title: 'Kong Gateway mTLS sequence',
    actors: [caller, { name: ['Kong Gateway'], symbol: 'shield' }, litellm],
    events: [
      request(0, 1, 'TLS handshake', 'Client certificate'),
      request(0, 1, 'API request', '+ LiteLLM key'),
      action(1, 'Verify certificate', 'Resolve Consumer'),
      action(1, 'Set Consumer custom ID'),
      request(1, 2, 'Consumer custom ID', '+ LiteLLM key'),
      action(2, 'Check key + policies', 'Record customer ID'),
      response,
    ],
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    note: 'The mTLS plugin validates the certificate and resolves the Consumer. Post-Function forwards its custom ID. LiteLLM still validates the key.',
  },
  'iap-aws': {
    title: 'AWS ALB identity sequence',
    actors: [caller, alb, litellm],
    events: [
      request(0, 1, 'Request + bearer JWT'),
      action(1, 'Verify JWT', 'Check audience/scope'),
      request(1, 2, 'Original bearer JWT'),
      action(2, 'Verify JWT', 'Apply user/team rules'),
      response,
    ],
    identity: 'Authorization: Bearer <JWT>',
    note: 'ALB validates the caller token and forwards it unchanged. LiteLLM verifies its claims and applies user and team permissions.',
  },
  'iap-azure': {
    title: 'Entra Application Proxy sequence',
    actors: [caller, { name: ['Entra Application', 'Proxy'], icon: 'cloud_icons/azure-enterprise-applications.svg' }, { name: ['Connectors', '+ NGINX'], icon: 'cloud_icons/azure-virtual-network.svg' }, litellm],
    events: [
      request(0, 1, 'Request + identity'),
      action(1, 'Authenticate user', 'Check access policy'),
      request(1, 2, 'Verified user headers'),
      action(2, 'Require user headers', 'Set approved team'),
      request(2, 3, 'User + team headers'),
      action(3, 'Check trusted peer', 'Apply user/team rules'),
      response,
    ],
    identity: 'X-LiteLLM-User-ID + X-LiteLLM-User-Email + X-LiteLLM-Team-ID',
    note: 'Application Proxy sets the user headers. NGINX rejects missing identity and sets the team. LiteLLM trusts only the private NGINX peers.',
  },
  'iap-gcp': assertionSequence(
    { name: ['Internal ALB', '+ Cloud IAP'], icon: 'cloud_icons/gcp-cloud-load-balancing.svg' }, nginx,
    'x-goog-iap-jwt-assertion',
    'Cloud IAP authenticates the caller and signs its identity. NGINX formats the header. LiteLLM verifies it and applies user and team permissions.',
  ),
  'iap-cloudflare': assertionSequence(
    { name: ['Cloudflare', 'Access'], icon: 'providers/cloudflare.svg' },
    { name: ['cloudflared', '+ NGINX'], icon: 'providers/cloudflare.svg' },
    'Cf-Access-Jwt-Assertion',
    'Access checks the caller and corporate device. The tunnel reaches private NGINX. LiteLLM verifies the Access assertion and applies user and team permissions.',
  ),
};

function Symbol({ kind, x, y }: { kind: 'client' | 'shield'; x: number; y: number }) {
  return <svg x={x} y={y} width="28" height="28" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" className={styles.symbol}>
    {kind === 'client' ? <><rect x="4" y="6" width="32" height="23" rx="3" /><path d="M13 35h14M20 29v6M15 13l-5 5 5 5m10-10 5 5-5 5" /></> : <><path d="M20 3 34 9v11c0 8-8 14-14 17C14 34 6 28 6 20V9Z" /><path d="m13 20 5 5 10-11" /></>}
  </svg>;
}

function Lines({ x, y, lines, className }: { x: number; y: number; lines: string[]; className: string }) {
  return <text x={x} y={y} textAnchor="middle" className={className}>
    {lines.map((line, index) => <tspan key={index} x={x} dy={index ? 15 : 0}>{line}</tspan>)}
  </text>;
}

function Participant({ actor, x, width }: { actor: Actor; x: number; width: number }) {
  const icon = useBaseUrl(`/img/${actor.icon ?? 'brand/litellm-monogram-blue.svg'}`);
  return <g>
    <rect x={x - width / 2} y={12} width={width} height={56} rx={5} className={styles.actorBox} />
    {actor.symbol ? <Symbol kind={actor.symbol} x={x - width / 2 + 10} y={26} /> : <>
      <rect x={x - width / 2 + 8} y={24} width={32} height={32} rx={3} fill="white" />
      <image href={icon} x={x - width / 2 + 11} y={27} width={26} height={26} />
    </>}
    <Lines x={x + 18} y={actor.name.length > 1 ? 36 : 44} lines={actor.name} className={styles.actorText} />
  </g>;
}

function SequenceSvg({ sequence }: { sequence: Sequence }) {
  const id = useId().replace(/:/g, '');
  const width = 760;
  const gap = width / sequence.actors.length;
  const center = (index: number) => gap * (index + 0.5);
  const rowHeight = 44;
  const height = 88 + sequence.events.length * rowHeight;
  const describe = (event: Event) => event.type === 'response' ? 'Stream response back through each proxy to the client.'
    : event.type === 'action' ? `${sequence.actors[event.at].name.join(' ')}: ${event.label.join('. ')}.`
      : `${sequence.actors[event.from].name.join(' ')} to ${sequence.actors[event.to].name.join(' ')}: ${event.label.join(' ')}.`;
  return <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>{sequence.title}</title>
    <desc id={`${id}-desc`}>Successful request, read from top to bottom. {sequence.events.map(describe).join(' ')} LiteLLM accepts requests only through the private ingress.</desc>
    <defs><marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" className={styles.arrowhead} /></marker></defs>
    {sequence.actors.map((actor, index) => <g key={index}>
      <line x1={center(index)} y1={68} x2={center(index)} y2={height - 10} className={styles.lifeline} />
      <Participant actor={actor} x={center(index)} width={gap - 18} />
    </g>)}
    {sequence.events.map((event, index) => {
      const y = 80 + index * rowHeight;
      if (event.type === 'action') return <g key={index}>
        <rect x={center(event.at) - 82} y={y} width={164} height={36} rx={4} className={styles.actionBox} />
        <Lines x={center(event.at)} y={y + (event.label.length > 1 ? 14 : 22)} lines={event.label} className={styles.actionText} />
      </g>;
      if (event.type === 'response') return <g key={index}>
        <Lines x={width / 2} y={y + 12} lines={['Stream response through the same proxies']} className={styles.messageText} />
        {sequence.actors.slice(1).map((_, actorIndex) => <line key={actorIndex} x1={center(actorIndex + 1) - 5} y1={y + 26} x2={center(actorIndex) + 5} y2={y + 26} className={styles.responseLine} markerEnd={`url(#${id}-arrow)`} />)}
      </g>;
      return <g key={index}>
        <Lines x={(center(event.from) + center(event.to)) / 2} y={y + (event.label.length > 1 ? 3 : 15)} lines={event.label} className={styles.messageText} />
        <line x1={center(event.from) + 5} y1={y + 26} x2={center(event.to) - 5} y2={y + 26} className={styles.messageLine} markerEnd={`url(#${id}-arrow)`} />
      </g>;
    })}
  </svg>;
}

export function IngressArchitecture({ kind }: { kind: Kind }) {
  const sequence = sequences[kind];
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return <figure className={styles.figure} aria-labelledby={id}>
    <figcaption className={styles.heading}>
      <span id={id}>{sequence.title}</span>
      <button type="button" className={styles.expandButton} onClick={() => dialog.current?.showModal()}>Expand diagram</button>
    </figcaption>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label={`${sequence.title}, diagram preview`}>
      <SequenceSvg sequence={sequence} />
    </div>
    <div className={styles.identity}><span>Forwarded identity</span><code>{sequence.identity}</code></div>
    <details className={styles.details}>
      <summary>Sequence details</summary>
      <p>{sequence.note} A failed check stops the request. LiteLLM accepts requests only through the private ingress.</p>
    </details>
    <dialog ref={dialog} className={styles.dialog} aria-label={sequence.title} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.heading}>
        <strong>{sequence.title}</strong>
        <button type="button" className={styles.expandButton} onClick={() => dialog.current?.close()} autoFocus>Close diagram</button>
      </div>
      <div className={styles.expandedViewport} tabIndex={0} role="region" aria-label="Expanded sequence diagram"><SequenceSvg sequence={sequence} /></div>
    </dialog>
  </figure>;
}
