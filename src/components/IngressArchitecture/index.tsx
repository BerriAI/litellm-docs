import React, { useId, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Kind = 'mtls-aws' | 'mtls-azure' | 'mtls-gcp' | 'mtls-nginx' | 'mtls-haproxy' | 'mtls-kong' | 'iap-aws' | 'iap-azure' | 'iap-gcp' | 'iap-cloudflare';
type Actor = { name: string[]; icon?: string; darkIcon?: string; symbol?: 'client' | 'shield' };
type Event =
  | { type: 'message'; from: number; to: number; label: string[] }
  | { type: 'action'; at: number; label: string[] }
  | { type: 'response' };
type Sequence = { title: string; actors: Actor[]; events: Event[]; identity: string; note: string };

const caller: Actor = { name: ['Client'], symbol: 'client' };
const litellm: Actor = { name: ['LiteLLM'], icon: 'brand/litellm-monogram-blue.svg', darkIcon: 'brand/litellm-monogram-white.svg' };
const nginx: Actor = { name: ['NGINX'], symbol: 'shield' };
const alb: Actor = { name: ['Internal ALB'], icon: 'cloud_icons/aws-alb.svg' };
const request = (from: number, to: number, ...label: string[]): Event => ({ type: 'message', from, to, label });
const action = (at: number, ...label: string[]): Event => ({ type: 'action', at, label });
const response: Event = { type: 'response' };

function mtls(edge: Actor, mapping: string, note: string, title = `${edge.name.join(' ')} mTLS`): Sequence {
  return {
    title,
    actors: [caller, edge, litellm],
    events: [
      request(0, 1, 'TLS + client certificate'),
      action(1, 'Verify certificate'),
      request(0, 1, 'Request + key'),
      action(1, mapping),
      request(1, 2, 'Client ID + key'),
      action(2, 'Check key + policies', 'Record customer ID'),
      response,
    ],
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    note,
  };
}

function assertionSequence(edge: Actor, adapter: Actor, assertion: string, note: string): Sequence {
  return {
    title: edge.name.join(' '),
    actors: [caller, edge, adapter, litellm],
    events: [
      request(0, 1, 'Request + identity'),
      action(1, 'Check identity + policy'),
      request(1, 2, 'Signed assertion'),
      action(2, 'Add Bearer prefix'),
      request(2, 3, 'Bearer assertion'),
      action(3, 'Verify JWT', 'User/team permissions'),
      response,
    ],
    identity: `${assertion} → X-LiteLLM-IAP-Token`,
    note,
  };
}

const sequences: Record<Kind, Sequence> = {
  'mtls-aws': {
    title: 'AWS ALB mTLS',
    actors: [caller, alb, nginx, litellm],
    events: [
      request(0, 1, 'TLS + client certificate'),
      action(1, 'Verify certificate'),
      request(0, 1, 'Request + key'),
      request(1, 2, 'Certificate fields + key'),
      action(2, 'Map workload ID'),
      request(2, 3, 'Workload ID + key'),
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
    'Google Cloud ALB mTLS',
  ),
  'mtls-nginx': mtls(nginx, 'Map workload ID', 'NGINX maps the approved certificate to a workload ID. LiteLLM uses the key for permissions and the workload ID for customer policies.'),
  'mtls-haproxy': mtls(
    { name: ['HAProxy'], symbol: 'shield' },
    'Map workload ID',
    'HAProxy maps the approved certificate fingerprint to a workload ID. LiteLLM uses the key for permissions and the workload ID for customer policies.',
  ),
  'mtls-kong': {
    title: 'Kong Gateway mTLS',
    actors: [caller, { name: ['Kong Gateway'], symbol: 'shield' }, litellm],
    events: [
      request(0, 1, 'TLS + client certificate'),
      request(0, 1, 'Request + key'),
      action(1, 'Verify certificate', 'Resolve Consumer'),
      action(1, 'Set Consumer custom ID'),
      request(1, 2, 'Custom ID + key'),
      action(2, 'Check key + policies', 'Record customer ID'),
      response,
    ],
    identity: 'X-MTLS-Client-ID + LiteLLM key',
    note: 'The mTLS plugin validates the certificate and resolves the Consumer. Post-Function forwards its custom ID. LiteLLM still validates the key.',
  },
  'iap-aws': {
    title: 'AWS ALB identity',
    actors: [caller, alb, litellm],
    events: [
      request(0, 1, 'Request + bearer JWT'),
      action(1, 'Verify JWT', 'Audience + scope'),
      request(1, 2, 'Original bearer JWT'),
      action(2, 'Verify JWT', 'User/team permissions'),
      response,
    ],
    identity: 'Authorization: Bearer <JWT>',
    note: 'ALB validates the caller token and forwards it unchanged. LiteLLM verifies its claims and applies user and team permissions.',
  },
  'iap-azure': {
    title: 'Entra Application Proxy',
    actors: [caller, { name: ['Entra App', 'Proxy'], icon: 'cloud_icons/azure-enterprise-applications.svg' }, { name: ['Connectors', '+ NGINX'], icon: 'cloud_icons/azure-virtual-network.svg' }, litellm],
    events: [
      request(0, 1, 'Request + identity'),
      action(1, 'Check user + policy'),
      request(1, 2, 'Verified user headers'),
      action(2, 'Require user headers', 'Set approved team'),
      request(2, 3, 'User + team headers'),
      action(3, 'Check trusted peer', 'User/team permissions'),
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
  'iap-cloudflare': {
    title: 'Cloudflare Access',
    actors: [caller, { name: ['Cloudflare', 'Access'], icon: 'providers/cloudflare.svg' }, { name: ['cloudflared', '+ NGINX'], icon: 'providers/cloudflare.svg' }, litellm],
    events: [
      request(0, 1, 'Request + identity'),
      action(1, 'Check group + device'),
      request(1, 2, 'Signed assertion'),
      action(2, 'Add Bearer prefix'),
      request(2, 3, 'Bearer assertion'),
      action(3, 'Verify JWT', 'Apply team permissions'),
      response,
    ],
    identity: 'Cf-Access-Jwt-Assertion → X-LiteLLM-IAP-Token',
    note: 'Access checks the Okta group and corporate device. cloudflared validates the assertion. NGINX adds its Bearer prefix. LiteLLM verifies the JWT and maps users and teams.',
  },
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

function Participant({ actor, x }: { actor: Actor; x: number }) {
  const icon = useBaseUrl(`/img/${actor.icon ?? 'brand/litellm-monogram-blue.svg'}`);
  const darkIcon = useBaseUrl(`/img/${actor.darkIcon ?? actor.icon ?? 'brand/litellm-monogram-blue.svg'}`);
  return <g>
    {actor.symbol ? <Symbol kind={actor.symbol} x={x - 70} y={12} /> : <>
      <image href={icon} x={x - 70} y={12} width={28} height={28} className={actor.darkIcon ? styles.lightIcon : undefined} />
      {actor.darkIcon && <image href={darkIcon} x={x - 70} y={12} width={28} height={28} className={styles.darkIcon} />}
    </>}
    <Lines x={x + 10} y={actor.name.length > 1 ? 22 : 30} lines={actor.name} className={styles.actorText} />
  </g>;
}

function SequenceSvg({ sequence }: { sequence: Sequence }) {
  const id = useId().replace(/:/g, '');
  const width = 720;
  const gap = width / sequence.actors.length;
  const center = (index: number) => gap * (index + 0.5);
  const rowHeight = 36;
  const height = 64 + sequence.events.length * rowHeight;
  const describe = (event: Event) => event.type === 'response' ? 'Stream response back through each proxy to the client.'
    : event.type === 'action' ? `${sequence.actors[event.at].name.join(' ')}: ${event.label.join('. ')}.`
      : `${sequence.actors[event.from].name.join(' ')} to ${sequence.actors[event.to].name.join(' ')}: ${event.label.join(' ')}.`;
  return <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>{sequence.title}</title>
    <desc id={`${id}-desc`}>Successful request, read from top to bottom. {sequence.events.map(describe).join(' ')} LiteLLM accepts requests only through the private ingress.</desc>
    <defs><marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" className={styles.arrowhead} /></marker></defs>
    {sequence.actors.map((actor, index) => <g key={index}>
      <line x1={center(index)} y1={48} x2={center(index)} y2={height - 8} className={styles.lifeline} />
      <Participant actor={actor} x={center(index)} />
    </g>)}
    {sequence.events.map((event, index) => {
      const y = 56 + index * rowHeight;
      if (event.type === 'action') return <g key={index}>
        <rect x={center(event.at) - 82} y={y} width={164} height={30} rx={3} className={styles.actionBox} />
        <Lines x={center(event.at)} y={y + (event.label.length > 1 ? 11 : 19)} lines={event.label} className={styles.actionText} />
      </g>;
      if (event.type === 'response') return <g key={index}>
        <Lines x={width / 2} y={y + 12} lines={['Response stream']} className={styles.messageText} />
        {sequence.actors.slice(1).map((_, actorIndex) => <line key={actorIndex} x1={center(actorIndex + 1) - 5} y1={y + 22} x2={center(actorIndex) + 5} y2={y + 22} className={styles.responseLine} markerEnd={`url(#${id}-arrow)`} />)}
      </g>;
      return <g key={index}>
        <Lines x={(center(event.from) + center(event.to)) / 2} y={y + (event.label.length > 1 ? 0 : 12)} lines={event.label} className={styles.messageText} />
        <line x1={center(event.from) + 5} y1={y + 22} x2={center(event.to) - 5} y2={y + 22} className={styles.messageLine} markerEnd={`url(#${id}-arrow)`} />
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
    <div className={styles.identity}><span>Identity</span><code>{sequence.identity}</code></div>
    <details className={styles.details}>
      <summary>Details</summary>
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
