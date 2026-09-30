import React, {useId, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import SalesButton from './SalesButton';
import {IconAudit, IconBudget, IconEnterprise, IconGateway, IconRegions, IconRoles, IconSdk, IconSpend, IconSso, IconSupport} from './icons';
import PromptButton from './PromptButton';
import {GatewayMap, GatewayMapTall, TransitDiagram, TransitTall} from './Transit';
import {track} from './shared';
import styles from './styles.module.css';

// One line over the map, saying what the drawing shows for each answer.
const CAPTIONS = {
  sdk: 'Your app calls every provider itself, through the SDK.',
  gateway: 'One gateway for models, MCP tools, and agents, with the same keys, budgets, guardrails, and spend logs.',
  enterprise: 'The same gateway for models, MCP tools, and agents, inside a zone your identity provider controls.',
};

const PATHS = [
  {
    id: 'sdk',
    Icon: IconSdk,
    label: 'Just my code',
    hint: 'One Python app, provider keys in your own environment',
  },
  {
    id: 'gateway',
    Icon: IconGateway,
    label: 'My team or several apps',
    hint: 'More than one app or person, any language, and you need to know who spent what',
  },
  {
    id: 'enterprise',
    Icon: IconEnterprise,
    label: 'My whole organization',
    hint: 'Hundreds of users, an identity provider, and a security review',
  },
];

// ---------------------------------------------------------------------------

function Benefits({items}) {
  return (
    <ul className={styles.pfList}>
      {items.map(([Icon, text]) => (
        <li key={text}>
          <Icon size={20} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

// The picker explains what each path gives you (side) and hands off with one
// button (main). Commands and agent prompts live on the page it links to, so
// a reader never sees two different install commands at once.
function actionFor(path, source, links) {
  if (path === 'sdk') {
    return {
      side: (
        <>
          <p className={styles.pfLead}>A Python library you import. Nothing to deploy; it runs inside your app.</p>
          <Benefits
            items={[
              [IconSdk, 'One completion() call for 100+ providers, answers in the OpenAI format'],
              [IconGateway, 'Retries and fallbacks across providers and deployments'],
              [IconSpend, 'Cost per call, and logging to Langfuse, OpenTelemetry, and more'],
            ]}
          />
        </>
      ),
      main: (
        <div className={styles.pfLinks}>
          <Link className={styles.btnPrimary} to={links.sdk} onClick={() => track('docs_path_cta', {path, source})}>
            Install the SDK
          </Link>
          <PromptButton id={path} source={`${source}-pathfinder`} size="md" />
          <span className={styles.pfNote}>One command, then your first call.</span>
        </div>
      ),
    };
  }
  if (path === 'gateway') {
    return {
      side: (
        <>
          <p className={styles.pfLead}>A self-hosted service every app and teammate calls, in any language.</p>
          <Benefits
            items={[
              [IconGateway, 'One OpenAI-compatible endpoint for every model; existing SDKs keep working'],
              [IconBudget, 'Virtual keys with budgets and rate limits per team, user, or app'],
              [IconSpend, 'Spend tracking, logs, and guardrails in one place, plus an admin UI'],
            ]}
          />
        </>
      ),
      main: (
        <div className={styles.pfLinks}>
          <Link className={styles.btnPrimary} to={links.gateway} onClick={() => track('docs_path_cta', {path, source})}>
            Start the Gateway
          </Link>
          <PromptButton id={path} source={`${source}-pathfinder`} size="md" />
          <span className={styles.pfNote}>Runs on your machine with Docker in about five minutes.</span>
        </div>
      ),
    };
  }
  const items = [
    [IconSso, 'Sign in with Okta, Entra ID, Google, or any OIDC and SAML provider'],
    [IconAudit, 'Audit logs of every admin action and key change'],
    [IconRoles, 'Delegated admins, so no one shares the master key'],
    [IconRegions, 'Multi-region deployment under one license'],
    [IconSupport, 'A support channel with the engineers, 24/7 SLAs available'],
  ];
  return {
    side: (
      <>
        <p className={styles.pfLead}>The same Gateway, plus what a security review asks for. Self-hosted, so prompts never leave your environment.</p>
        <Benefits items={items} />
      </>
    ),
    main: (
      <div className={styles.pfLinks}>
        <SalesButton source={`${source}-pathfinder`} />
        <span className={styles.salesNote}>Includes a free 30-day trial</span>
        <Link className={styles.textLink} to="/docs/enterprise">
          Compare open source and Enterprise
        </Link>
      </div>
    ),
  };
}

export default function PathFinder({
  initial = 'gateway',
  question = 'Who is calling the models?',
  source = 'docs',
  sdkHref = '/docs/#installation',
  gatewayHref = '/docs/proxy/docker_quick_start',
}) {
  const [path, setPath] = useState(initial);
  const action = actionFor(path, source, {sdk: sdkHref, gateway: gatewayHref});
  const baseId = useId();
  const refs = useRef([]);

  const choose = (id) => {
    setPath(id);
    track('docs_path_selected', {path: id, source});
  };
  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + PATHS.length) % PATHS.length;
    choose(PATHS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <section className={styles.pf} aria-labelledby={`${baseId}-q`}>
      <p id={`${baseId}-q`} className={styles.pfQuestion}>
        {question}
      </p>
      <div className={styles.pfOptions} role="radiogroup" aria-labelledby={`${baseId}-q`}>
        {PATHS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={path === p.id}
            tabIndex={path === p.id ? 0 : -1}
            className={clsx(styles.pfOption, path === p.id && styles.pfOptionOn)}
            onClick={() => choose(p.id)}
            onKeyDown={(e) => onKey(e, i)}>
            <span className={styles.pfOptionIcon}>
              <p.Icon size={26} />
            </span>
            <span className={styles.pfOptionLabel}>{p.label}</span>
            <span className={styles.pfOptionHint}>{p.hint}</span>
          </button>
        ))}
      </div>
      <div className={styles.pfStage}>
        <div className={styles.pfDiagram}>
          <div className={styles.pfDiagramHead}>
            <span className={styles.pfDiagramCaption}>{CAPTIONS[path]}</span>
          </div>
          <div className={styles.pfDiagramWide}>
            {path === 'sdk' ? <TransitDiagram path="sdk" /> : <GatewayMap path={path} />}
          </div>
          <div className={styles.pfDiagramTall}>
            {path === 'sdk' ? <TransitTall path="sdk" /> : <GatewayMapTall path={path} />}
          </div>
        </div>
        <div key={`${path}-side`} className={clsx(styles.pfPanel, styles.pfSide)}>
          {action.side}
        </div>
        <div key={`${path}-main`} className={clsx(styles.pfPanel, styles.pfMain)}>
          {action.main}
        </div>
      </div>
      <p className={styles.pfFoot}>
        You can switch paths later: the SDK can call a Gateway as one more provider, and Enterprise is a license key on the same Gateway image.
      </p>
    </section>
  );
}
