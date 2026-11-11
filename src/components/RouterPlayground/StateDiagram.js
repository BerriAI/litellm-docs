import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {fold} from './diagramModel';
import {seconds} from './format';
import styles from './StateDiagram.module.css';

// One router call, step by step, laid out like a Python environment diagram: the router's
// settings across the top, the call's frames on the left (the call, one level per fallback hop,
// the current pick and attempt), the deployments it can reach on the right as objects, and the
// host along the bottom. Arrows point from each attempt to its deployment, and a dot runs along
// whatever the selected step moved between.

// Past this many deployments, groups the call never reaches fold into chips.
const FOLD_REGISTRY_ABOVE = 12;
// Past this many deployments in an open group, rows go dense and the quiet ones fold.
const DENSE_GROUP_ABOVE = 8;
const DENSE_ROWS = 6;
// Rows in the strategy panel before the tail folds into "others".
const SHARE_ROWS = 5;

const percent = value => `${Math.round(value * 100)}%`;

function Chip({children, tone, anchor}) {
  return (
    <span className={`${styles.chip} ${tone ? styles[`chip_${tone}`] : ''}`} data-anchor={anchor}>
      {children}
    </span>
  );
}

function Row({name, children, anchor, tone}) {
  return (
    <div className={styles.row}>
      <span className={styles.key}>{name}</span>
      <span className={`${styles.value} ${tone ? styles[`text_${tone}`] : ''}`} data-anchor={anchor}>
        {children}
      </span>
    </div>
  );
}

function Globals({settings, state}) {
  const hops = new Set(state.levels.filter(level => level.hop).map(level => level.hop));
  const edges = [];
  for (const [kind, label] of [
    ['fallbacks', null],
    ['context_window_fallbacks', 'context window'],
    ['content_policy_fallbacks', 'content policy'],
  ]) {
    for (const entry of settings[kind] ?? []) {
      for (const [from, targets] of Object.entries(entry)) {
        for (const to of [].concat(targets))
          edges.push({key: `${kind}:${from}:${to}`, text: `${from} → ${to}`, label, hop: `${from} → ${to}`});
      }
    }
  }
  for (const to of settings.default_fallbacks ?? [])
    edges.push({key: `default:${to}`, text: `* → ${to}`, label: 'default', hop: null});
  return (
    <div className={styles.globals}>
      <Chip>routing_strategy {settings.routing_strategy}</Chip>
      <Chip>num_retries {settings.num_retries}</Chip>
      <Chip>
        {settings.allowed_fails == null
          ? 'allowed_fails unset (failure ratio)'
          : `allowed_fails ${settings.allowed_fails}`}
      </Chip>
      <Chip>cooldown_time {settings.disable_cooldowns ? 'off' : `${settings.cooldown_time}s`}</Chip>
      <Chip>max_fallbacks {settings.max_fallbacks}</Chip>
      <span className={styles.globalsLabel}>fallbacks</span>
      {edges.length === 0 ? (
        <Chip>none</Chip>
      ) : (
        edges.map(edge => (
          <Chip key={edge.key} tone={hops.has(edge.hop) ? 'hop' : null}>
            {edge.label ? `${edge.label}: ` : ''}
            {edge.text}
          </Chip>
        ))
      )}
    </div>
  );
}

function LevelFrame({level, active, settings}) {
  const finished = level.attempts.map(attempt => `${attempt.id} ${attempt.answer === '200 OK' ? '✓' : '✗'}`).join(', ');
  const status = level.status === 'falling back' ? 'fell back' : level.status;
  return (
    <div className={`${styles.panel} ${active ? styles.active : styles.done}`} data-anchor={`level:${level.scope}`}>
      <div className={styles.head}>
        <span>
          level {level.scope} · {level.group}
        </span>
        <span className={`${styles.status} ${level.status === 'falling back' ? styles.text_hop : ''}`}>{status}</span>
      </div>
      <Row name="retry">
        {level.retry} of {level.max}
        {level.status !== 'running' && level.retry >= level.max ? ' (used up)' : ''}
      </Row>
      <Row name="fallback depth">
        {level.depth} of {level.maxFallbacks ?? settings.max_fallbacks}
      </Row>
      {level.cause && <Row name="why">{level.cause}</Row>}
      <Row name="last error" tone={level.error ? 'fail' : null}>
        {level.error ?? 'None'}
      </Row>
      {!active && finished && <Row name="attempts">{finished}</Row>}
    </div>
  );
}

function FoldedAttempt({attempt}) {
  const ok = attempt.answer === '200 OK';
  return (
    <div className={`${styles.panel} ${styles.done} ${styles.folded}`} data-anchor={`attempt:${attempt.n}`}>
      <div className={styles.head}>
        <span>
          attempt {attempt.n} · {attempt.id}
        </span>
        <span className={`${styles.status} ${ok ? styles.text_ok : styles.text_fail}`}>
          {attempt.error ?? attempt.answer}
        </span>
      </div>
    </div>
  );
}

function PickFrame({pick, open}) {
  const left = pick.candidates.length;
  if (!open) {
    return (
      <div className={`${styles.panel} ${styles.done} ${styles.folded}`} data-anchor="pick">
        <div className={styles.head}>
          <span>pick · {pick.group}</span>
          <span className={styles.status}>
            {left} candidate{left === 1 ? '' : 's'} left
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={`${styles.panel} ${styles.active}`} data-anchor="pick">
      <div className={styles.head}>
        <span>pick · {pick.group}</span>
        <span className={styles.status}>
          {left} candidate{left === 1 ? '' : 's'} left
        </span>
      </div>
      {pick.stages.map(stage => {
        const ids = stage.left.map(deployment => deployment.id);
        const removed = stage.removed;
        return (
          <div key={stage.name} className={`${styles.stage} ${removed.length ? styles.text_warn : ''}`}>
            <span>
              {stage.name}
              {stage.tier != null ? ` (${stage.tier})` : ''}
            </span>
            <span className={styles.mono}>
              {removed.length > 0 && removed.length <= 4
                ? removed.map(id => (
                    <s key={id} style={{marginLeft: 6}}>
                      {id}
                    </s>
                  ))
                : removed.length > 4
                  ? `${ids.length} (−${removed.length})`
                  : ids.length <= 3
                    ? ids.join(', ') || 'none'
                    : ids.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Strategy({strategy, open}) {
  const {shares, source, roll, picked} = strategy;
  if (!open) {
    return (
      <div className={styles.strategyLine}>
        simple-shuffle · {shares.length} candidate
        {shares.length === 1 ? ', no roll' : `s, roll ${roll?.toFixed(2) ?? '?'}`}
      </div>
    );
  }
  const largest = Math.max(...shares.map(share => share.share));
  const ranked = [...shares].sort((a, b) => b.share - a.share);
  const shown = ranked.length > SHARE_ROWS + 1 ? ranked.slice(0, SHARE_ROWS) : ranked;
  const rest = ranked.slice(shown.length);
  return (
    <div className={styles.strategy}>
      <div className={styles.strategyHead}>
        <span>simple-shuffle</span>
        <span className={styles.status}>
          weights from: {source} · {shares.length} candidate{shares.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className={styles.shares}>
        {shown.map(share => (
          <React.Fragment key={share.id}>
            <span className={share.id === picked ? styles.bold : ''}>{share.id}</span>
            <span>{source === 'uniform' ? '–' : share.weight}</span>
            <span className={styles.track}>
              <span
                className={share.id === picked ? styles.fill : styles.fillQuiet}
                style={{width: `${(100 * share.share) / largest}%`}}
              />
            </span>
            <span>{percent(share.share)}</span>
          </React.Fragment>
        ))}
        {rest.length > 0 && (
          <>
            <span className={styles.muted}>{rest.length} others</span>
            <span />
            <span className={styles.track}>
              <span
                className={styles.fillQuiet}
                style={{width: `${(100 * rest.reduce((sum, share) => sum + share.share, 0)) / largest}%`}}
              />
            </span>
            <span>{percent(rest.reduce((sum, share) => sum + share.share, 0))}</span>
          </>
        )}
      </div>
      {roll != null && (
        <>
          <div className={styles.rollBar}>
            {
              shares.reduce(
                (acc, share) => {
                  acc.parts.push(
                    <span
                      key={share.id}
                      className={share.id === picked ? styles.rollPicked : styles.rollOther}
                      style={{left: `${acc.at * 100}%`, width: `${share.share * 100}%`}}
                    />,
                  );
                  acc.at += share.share;
                  return acc;
                },
                {at: 0, parts: []},
              ).parts
            }
            <span className={styles.rollMark} style={{left: `${roll * 100}%`}} />
          </div>
          <div className={styles.small}>
            roll {roll.toFixed(2)} of 1.00 lands in {picked}
          </div>
        </>
      )}
      {!strategy.agrees && (
        <div className={styles.small}>
          The core picked {picked}, which this view's candidate list does not hold: a filter here is missing.
        </div>
      )}
    </div>
  );
}

function AttemptFrame({attempt, expanded}) {
  const ok = attempt.answer === '200 OK';
  return (
    <div className={`${styles.panel} ${styles.active}`} data-anchor="attempt">
      <div className={styles.head}>
        <span>attempt {attempt.n}</span>
        <span className={`${styles.status} ${attempt.answer ? (ok ? styles.text_ok : styles.text_fail) : ''}`}>
          {attempt.answer ? (attempt.error ?? attempt.answer) : expanded ? 'strategy expanded' : ''}
        </span>
      </div>
      <Row name="deployment" anchor="attempt-dep">
        <span className={styles.pointerSource}>
          <span>{attempt.id}</span>
          <span className={styles.pointerDot} />
        </span>
      </Row>
      <Strategy strategy={attempt.strategy} open={expanded} />
    </div>
  );
}

function deploymentTone(id, state) {
  const health = state.health[id];
  if (health?.cooldown) return 'cooling';
  if (state.served[id]) return 'served';
  if (state.attempt?.id === id) return state.attempt.error ? 'failed' : 'picked';
  return null;
}

function DeploymentBox({deployment, state, faded, dense, allowedFails}) {
  const health = state.health[deployment.id];
  const tone = deploymentTone(deployment.id, state);
  const status = health?.cooldown
    ? `cooldown ${Math.round(health.cooldown.left ?? 0)}s left · ${health.cooldown.status}`
    : state.served[deployment.id]
      ? 'served 200 OK'
      : 'healthy';
  const params = [
    deployment.weight != null ? `weight ${deployment.weight}` : null,
    deployment.order != null ? `order ${deployment.order}` : null,
    deployment.rpm != null ? `rpm limit ${deployment.rpm}` : null,
  ].filter(Boolean);
  // With allowed_fails set the router counts fails over a cooldown_time window; without it, it
  // compares this minute's fails with its successes.
  const fails =
    allowedFails == null
      ? `this minute: ${health?.minuteFails ?? 0} fails, ${health?.minuteSuccesses ?? 0} ok`
      : `fails ${health?.fails ?? 0} of ${allowedFails} allowed`;
  if (dense) {
    return (
      <div className={`${styles.line} ${tone ? styles[`dep_${tone}`] : ''}`} data-anchor={`dep:${deployment.id}`}>
        <span className={styles.depId}>{deployment.id}</span>
        <span className={styles.muted}>{params[0] ?? ''}</span>
        <span className={styles.lineRight}>{health?.cooldown ? status : `${fails} · rpm ${health?.rpm ?? 0}`}</span>
      </div>
    );
  }
  return (
    <div
      className={`${styles.dep} ${tone ? styles[`dep_${tone}`] : ''} ${faded ? styles.faded : ''}`}
      data-anchor={`dep:${deployment.id}`}>
      <span className={styles.depId}>{deployment.id}</span>
      <span className={styles.depStatus}>{status}</span>
      <span className={styles.muted}>{[deployment.model, ...params].join(' · ')}</span>
      <span className={styles.muted}>{fails}</span>
      <span className={styles.muted}>rpm used {health?.rpm ?? 0}</span>
      <span className={styles.muted}>tpm used {health?.tpm ?? 0}</span>
    </div>
  );
}

function Group({name, members, state, touched, allowedFails}) {
  const [expanded, setExpanded] = useState(false);
  const dense = members.length > DENSE_GROUP_ABOVE;
  let shown = members;
  if (dense && !expanded) {
    const involved = new Set([
      ...(state.attempt ? [state.attempt.id] : []),
      ...state.levels.flatMap(level => level.attempts.map(attempt => attempt.id)),
      ...members
        .filter(deployment => state.health[deployment.id]?.cooldown || state.served[deployment.id])
        .map(d => d.id),
    ]);
    const byWeight = [...members].sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
    const keep = new Set(members.filter(deployment => involved.has(deployment.id)).map(deployment => deployment.id));
    for (const deployment of byWeight) {
      if (keep.size >= DENSE_ROWS) break;
      keep.add(deployment.id);
    }
    shown = members.filter(deployment => keep.has(deployment.id));
  }
  const hidden = members.length - shown.length;
  return (
    <div className={`${styles.group} ${touched ? '' : styles.faded}`} data-anchor={`group:${name}`}>
      <div className={styles.head}>
        <span>model group {name}</span>
        <span className={styles.status}>
          {touched ? `${members.length} deployment${members.length === 1 ? '' : 's'}` : "not on this call's path"}
          {dense ? ' · dense rows' : ''}
        </span>
      </div>
      {shown.map(deployment => (
        <DeploymentBox
          key={deployment.id}
          deployment={deployment}
          state={state}
          dense={dense}
          faded={!touched}
          allowedFails={allowedFails}
        />
      ))}
      {dense && (hidden > 0 || expanded) && (
        <button type="button" className={styles.more} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'show fewer' : `+${hidden} more · show`}
        </button>
      )}
    </div>
  );
}

function Objects({info, state}) {
  const groups = [];
  for (const deployment of info.deployments) {
    let group = groups.find(item => item.name === deployment.model_name);
    if (!group) groups.push((group = {name: deployment.model_name, members: []}));
    group.members.push(deployment);
  }
  const touched = new Set(state.touched);
  const foldUntouched = info.deployments.length > FOLD_REGISTRY_ABOVE;
  const open = groups.filter(group => touched.has(group.name) || !foldUntouched);
  const folded = groups.filter(group => !open.includes(group));
  return (
    <>
      {open.map(group => (
        <Group
          key={group.name}
          name={group.name}
          members={group.members}
          state={state}
          touched={touched.has(group.name)}
          allowedFails={info.settings.allowed_fails}
        />
      ))}
      {folded.length > 0 && (
        <div className={styles.group} data-anchor="folded-groups">
          <div className={styles.head}>
            <span>
              {folded.length} other group{folded.length === 1 ? '' : 's'}
            </span>
            <span className={styles.status}>folded, not on this call's path</span>
          </div>
          <div className={styles.chips}>
            {folded
              .sort((a, b) => b.members.length - a.members.length)
              .map(group => (
                <Chip key={group.name} anchor={`group:${group.name}`}>
                  {group.name} {group.members.length}
                </Chip>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

// An orthogonal route between two boxes: out of the side facing the other box, along a gutter,
// and in. Boxes in the same column route round their right edges.
function route(a, b, gutter) {
  const ay = a.top + a.height / 2;
  const by = b.top + b.height / 2;
  const sameColumn = a.left < b.right && b.left < a.right;
  const contains = (outer, inner) => outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top;
  if (contains(a, b) || contains(b, a)) {
    const [outer, inner] = contains(a, b) ? [a, b] : [b, a];
    const x = inner.left - 6;
    const iy = inner.top + inner.height / 2;
    const path = `M ${x} ${outer.top + 16} V ${iy} H ${inner.left}`;
    return contains(a, b) ? path : `M ${inner.left} ${iy} H ${x} V ${outer.top + 16}`;
  }
  if (b.top >= a.bottom + 8 && sameColumn && Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) < 40) {
    const x = a.left + a.width / 2;
    return `M ${x} ${a.bottom} V ${b.top}`;
  }
  if (sameColumn) {
    const x = Math.max(a.right, b.right) + 22;
    return `M ${a.right} ${ay} H ${x} V ${by} H ${b.right}`;
  }
  if (a.left + a.width / 2 < b.left + b.width / 2) return `M ${a.right} ${ay} H ${gutter} V ${by} H ${b.left}`;
  return `M ${a.left} ${ay} H ${gutter} V ${by} H ${b.right}`;
}

const orbitPath = r => `M ${r.left} ${r.top} H ${r.right} V ${r.bottom} H ${r.left} Z`;

function Overlay({container, state, index}) {
  const [shapes, setShapes] = useState(null);

  const measure = useCallback(() => {
    const root = container.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const rect = name => {
      const element = root.querySelector(`[data-anchor="${CSS.escape(name)}"]`);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: box.left - origin.left,
        top: box.top - origin.top,
        right: box.right - origin.left,
        bottom: box.bottom - origin.top,
        width: box.width,
        height: box.height,
      };
    };
    const frames = rect('column:frames');
    const objects = rect('column:objects');
    if (!frames || !objects || objects.left < frames.right) {
      setShapes({width: origin.width, height: origin.height, stacked: true});
      return;
    }
    const gutter = Math.round((frames.right + objects.left) / 2);
    const pointers = [];
    const target = id => rect(`dep:${id}`) ?? rect(`group:${state.byId[id]?.model_name}`) ?? rect('folded-groups');
    if (state.attempt) {
      const from = rect('attempt-dep');
      const to = target(state.attempt.id);
      if (from && to) pointers.push({d: route(from, to, gutter), current: true});
    }
    const active = state.levels.find(level => level.status === 'running');
    for (const attempt of active?.attempts ?? []) {
      const from = rect(`attempt:${attempt.n}`);
      const to = target(attempt.id);
      if (from && to) pointers.push({d: route(from, to, gutter - 14), current: false});
    }
    let motion = null;
    const edge = state.edge ?? {};
    if (edge.orbit) {
      const box = rect(edge.orbit);
      if (box) motion = {d: orbitPath(box), orbit: true};
    } else if (edge.from) {
      const resolve = name =>
        rect(name) ??
        (name === 'attempt-dep' ? rect('attempt') : null) ??
        (name.startsWith('dep:') ? target(name.slice(4)) : null) ??
        (name.startsWith('group:') ? rect('folded-groups') : null);
      const a = resolve(edge.from);
      const b = resolve(edge.to);
      if (a && b) motion = {d: route(a, b, gutter + 12), back: edge.back};
    }
    setShapes({width: origin.width, height: origin.height, pointers, motion, tone: edge.tone ?? 'neutral'});
  }, [container, state]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const root = container.current;
    if (!root) return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    return () => observer.disconnect();
  }, [container, measure]);

  if (!shapes) return null;
  return (
    <svg className={styles.overlay} width={shapes.width} height={shapes.height} aria-hidden="true">
      <defs>
        <marker
          id="sd-head"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className={styles.head_fill} />
        </marker>
        <marker
          id="sd-head-faint"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className={styles.head_faint} />
        </marker>
      </defs>
      {!shapes.stacked &&
        shapes.pointers.map((pointer, i) => (
          <path
            key={i}
            d={pointer.d}
            className={pointer.current ? styles.pointer : styles.pointerFaint}
            markerEnd={pointer.current ? 'url(#sd-head)' : 'url(#sd-head-faint)'}
          />
        ))}
      {shapes.motion && (
        <g key={`motion-${index}`}>
          {!shapes.motion.orbit && (
            <path d={shapes.motion.d} className={`${styles.edge} ${styles[`tone_${shapes.tone}`]}`} />
          )}
          <circle r={10} className={`${styles.halo} ${styles[`tone_${shapes.tone}`]}`}>
            <animateMotion
              dur={shapes.motion.orbit ? '2.4s' : '1.4s'}
              repeatCount="indefinite"
              path={shapes.motion.d}
              keyPoints={shapes.motion.back ? '0;1;0' : '0;1'}
              keyTimes={shapes.motion.back ? '0;0.5;1' : '0;1'}
              calcMode="linear"
            />
          </circle>
          <circle r={6} className={`${styles.dot} ${styles[`tone_${shapes.tone}`]}`}>
            <animateMotion
              dur={shapes.motion.orbit ? '2.4s' : '1.4s'}
              repeatCount="indefinite"
              path={shapes.motion.d}
              keyPoints={shapes.motion.back ? '0;1;0' : '0;1'}
              keyTimes={shapes.motion.back ? '0;0.5;1' : '0;1'}
              calcMode="linear"
            />
          </circle>
        </g>
      )}
    </svg>
  );
}

export default function StateDiagram({run, info}) {
  const states = useMemo(() => fold(run, info), [run, info]);
  const [index, setIndex] = useState(0);
  const container = useRef(null);
  const state = states[index];

  if (!state) return <p className={styles.muted}>This call has no steps.</p>;

  const go = next => setIndex(Math.max(0, Math.min(states.length - 1, next)));
  const onKey = event => {
    if (event.key === 'ArrowRight') {
      go(index + 1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      go(index - 1);
      event.preventDefault();
    }
  };

  const active = state.levels.find(level => level.status === 'running') ?? state.levels[state.levels.length - 1];
  const expanded = state.label === 'Selected';
  const hostCalls = ['invoke', 'sleep', 'allow_fallback', 'select'];
  const hostTone = {invoke: state.edge?.tone, sleep: 'neutral', allow_fallback: 'hop', select: 'neutral'};

  return (
    <div
      className={styles.diagram}
      tabIndex={0}
      onKeyDown={onKey}
      data-step={state.label}
      aria-label="Step through this router call">
      <div className={styles.stepBar}>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>
          Back
        </button>
        <span className={styles.mono}>
          step {index + 1} of {states.length}
        </span>
        <button type="button" onClick={() => go(index + 1)} disabled={index === states.length - 1}>
          Forward
        </button>
        <span className={styles.stepText}>{state.text}</span>
      </div>

      <div ref={container} className={styles.stage_area}>
        <div className={styles.caption}>GLOBALS · ROUTER SETTINGS</div>
        <Globals settings={info.settings} state={state} />

        <div className={styles.columns}>
          <div className={styles.frames} data-anchor="column:frames">
            <div className={styles.caption}>FRAMES · THIS CALL</div>
            <div className={`${styles.panel} ${styles.done}`} data-anchor="call">
              <div className={styles.head}>
                <span>router.call</span>
                <span className={styles.status}>
                  {state.call.status === 'running' ? `waiting on level ${active.scope}` : state.call.status}
                </span>
              </div>
              <Row name="model">"{run.model}"</Row>
              {run.request?.team_id && <Row name="team">"{run.request.team_id}"</Row>}
            </div>
            {state.levels.map(level => (
              <React.Fragment key={level.scope}>
                <LevelFrame
                  level={level}
                  active={level === active && level.status === 'running'}
                  settings={info.settings}
                />
                {level === active &&
                  level.status === 'running' &&
                  level.attempts.map(attempt => <FoldedAttempt key={attempt.n} attempt={attempt} />)}
                {level === active && state.pick && <PickFrame pick={state.pick} open={state.pick.open} />}
                {level === active && state.attempt && <AttemptFrame attempt={state.attempt} expanded={expanded} />}
              </React.Fragment>
            ))}
          </div>
          <div className={styles.gutter} />
          <div className={styles.objects} data-anchor="column:objects">
            <div className={styles.caption}>OBJECTS · SHARED ACROSS CALLS</div>
            <Objects info={info} state={state} />
          </div>
        </div>

        <div className={styles.caption}>HOST EDGE</div>
        <div className={styles.host} data-anchor="host">
          {hostCalls.map(call => (
            <Chip key={call} anchor={`host:${call}`} tone={state.host === call ? (hostTone[call] ?? 'neutral') : null}>
              {call}
            </Chip>
          ))}
          <span className={styles.clock}>
            clock {seconds(state.t)} · seed {info.seed}
          </span>
        </div>
        <Overlay container={container} state={state} index={index} />
      </div>
    </div>
  );
}
