import React, {useEffect, useMemo, useRef, useState} from 'react';
import {seconds} from './format';
import styles from './styles.module.css';

// A step-through view of one router call in the style of a Python environment diagram: the
// call's frames on the left (one per fallback level, like a call stack), the deployments it can
// reach on the right as objects, and pointer arrows from each frame to the deployment it picked.
// Every state shown is folded from the core's own trace; a dot runs along whatever the selected
// step moved between.

const field = (detail, name) => {
  const match = new RegExp(`${name}: (?:Some\\()?("([^"]*)"|[^,)}\\s]+)`).exec(detail ?? '');
  if (!match) return undefined;
  return match[2] ?? match[1];
};

// What happened at each step, folded into the state after it and the edge it travelled.
function fold(trace, request, before) {
  const frames = [{scope: '0', model: request, retry: 0, max: undefined, picked: null, note: null, status: 'running'}];
  const deployments = {};
  for (const [id, cooldown] of Object.entries(before ?? {})) deployments[id] = {state: 'cooling', note: cooldown};
  const states = [];
  const current = () => [...frames].reverse().find(frame => frame.status === 'running') ?? frames[frames.length - 1];
  const clone = () => ({
    frames: frames.map(frame => ({...frame})),
    deployments: JSON.parse(JSON.stringify(deployments)),
  });

  for (const step of trace) {
    let edge = null;
    let text = '';
    const frame = current();
    const at = `frame:${frame.scope}`;
    if (step.kind === 'host') {
      if (step.call === 'invoke') {
        const ok = step.answer === '200 OK';
        edge = {from: at, to: `dep:${step.deployment}`, tone: ok ? 'ok' : 'fail', back: true};
        text = `The host sends the attempt to ${step.deployment}, which answers ${step.answer}.`;
      } else if (step.call === 'sleep') {
        edge = {from: at, to: 'host', tone: 'neutral'};
        text = `The router asks the host to wait ${seconds(step.seconds)} before retrying.`;
      } else if (step.call === 'allow_fallback') {
        edge = {from: at, to: 'host', tone: 'hop'};
        text = `The router asks the host whether this request may fall back to ${step.target}. It may.`;
      } else {
        edge = {from: at, to: 'host', tone: 'neutral'};
        text = `The router asks the host to run ${step.stage}, a stage that still lives in Python. The playground leaves the candidates as they are.`;
      }
    } else {
      const detail = step.detail;
      switch (step.event) {
        case 'RetriesOpened': {
          const scope = field(detail, 'scope');
          const target = frames.find(item => item.scope === scope) ?? frame;
          target.max = Number(field(detail, 'max_retries'));
          edge = {pulse: `frame:${target.scope}`};
          text = `The router opens a retry budget of ${target.max} for ${target.model} (${field(detail, 'model_group_size')} deployments in the group).`;
          break;
        }
        case 'PickStarted':
          frame.picked = null;
          edge = {from: at, to: `group:${frame.model}`, tone: 'neutral'};
          text = `The router starts picking a deployment from ${field(detail, 'model')}.`;
          break;
        case 'Selected': {
          const id = field(detail, 'deployment_id');
          frame.picked = id;
          frame.group = field(detail, 'model_group');
          edge = {from: `group:${frame.group}`, to: `dep:${id}`, tone: 'pick'};
          text = `simple-shuffle picks ${id}. The frame now points at it.`;
          break;
        }
        case 'AttemptFailed': {
          const id = field(detail, 'deployment_id');
          frame.note = `${field(detail, 'kind')} ${field(detail, 'status') ?? ''}`.trim();
          deployments[id] = {state: 'failed', note: frame.note};
          edge = {from: `dep:${id}`, to: at, tone: 'fail'};
          text = `The attempt on ${id} failed with ${frame.note}. The router counts it against ${id}.`;
          break;
        }
        case 'CooldownSet': {
          const id = field(detail, 'deployment_id');
          const cooldown = field(detail, 'cooldown');
          deployments[id] = {state: 'cooling', note: cooldown};
          edge = {from: at, to: `dep:${id}`, tone: 'warn'};
          text = `${id} has failed too often, so the router cools it down for ${cooldown}. Picks skip it until then.`;
          break;
        }
        case 'Retry':
          frame.retry = Number(field(detail, 'retry'));
          frame.picked = null;
          edge = {pulse: at};
          text = `Retry ${frame.retry} of ${frame.max ?? '?'} in ${frame.model}.`;
          break;
        case 'Succeeded': {
          const id = field(detail, 'deployment_id');
          deployments[id] = {state: 'served', note: '200 OK'};
          frame.status = 'returned';
          frame.note = `served by ${id}`;
          edge = {from: `dep:${id}`, to: at, tone: 'ok'};
          text = `${id} answered, and the frame returns its response.`;
          break;
        }
        case 'FallingBack':
          frame.status = 'falling back';
          edge = {pulse: at};
          text = `${frame.model} has no retries left, so the router looks for a fallback.`;
          break;
        case 'Fallback': {
          const to = field(detail, 'to');
          const scope = field(detail, 'scope');
          frames.push({
            scope,
            model: to,
            retry: 0,
            max: undefined,
            picked: null,
            note: null,
            status: 'running',
            parent: field(detail, 'parent'),
          });
          edge = {from: at, to: `frame:${scope}`, tone: 'hop'};
          text = `The router falls back from ${field(detail, 'from')} to ${to}, opening a new frame for it.`;
          break;
        }
        case 'FallbackDone': {
          const scope = field(detail, 'scope');
          const parent = frames.find(item => item.scope === field(detail, 'parent'));
          const child = frames.find(item => item.scope === scope);
          const succeeded = field(detail, 'succeeded') === 'true';
          if (parent) {
            parent.status = succeeded ? 'returned' : 'failed';
            parent.note = succeeded ? `via ${child?.model}` : parent.note;
          }
          edge = {from: `frame:${scope}`, to: parent ? `frame:${parent.scope}` : at, tone: succeeded ? 'ok' : 'fail'};
          text = succeeded
            ? `The fallback to ${field(detail, 'to')} succeeded, and its response becomes the answer to the original call.`
            : `The fallback to ${field(detail, 'to')} failed too.`;
          break;
        }
        case 'PickFailed':
        case 'LevelFailed':
          frame.note = 'no deployment to pick';
          if (step.event === 'LevelFailed') frame.status = 'failed';
          edge = {pulse: at, tone: 'fail'};
          text =
            step.event === 'PickFailed'
              ? `No deployment in ${frame.model} could be picked.`
              : `${frame.model} failed and has nothing left to try.`;
          break;
        case 'FallbacksFailed':
          frames[0].status = 'failed';
          edge = {pulse: 'frame:0', tone: 'fail'};
          text = 'There is no fallback left, so the call raises its last error.';
          break;
        case 'RetryBudget':
          edge = {pulse: at};
          text = `The retry budget for ${frame.model} is ${field(detail, 'max_retries')}.`;
          break;
        case 'RetryLogged':
          edge = {pulse: at};
          text = `The router records the failure for the retry policy (${field(detail, 'cause')}).`;
          break;
        default:
          edge = {pulse: at};
          text = step.event;
      }
    }
    states.push({step, edge, text, ...clone()});
  }
  return states;
}

const W_FRAME = 230;
const ROW = 19;
const PAD = 14;

function layout(state, deployments, width) {
  const nodes = {};
  let y = 30;
  const frameX = PAD;
  for (const frame of state.frames) {
    const rows = 4;
    const h = 26 + rows * ROW + 8;
    nodes[`frame:${frame.scope}`] = {x: frameX, y, w: W_FRAME, h};
    y += h + 14;
  }
  const hostY = Math.max(y, 30);
  nodes.host = {x: frameX, y: hostY, w: W_FRAME, h: 44};
  const left = hostY + 44;

  const objX = Math.max(W_FRAME + 120, width - 250);
  const objW = Math.min(230, width - objX - PAD);
  const groups = [];
  for (const deployment of deployments) {
    let group = groups.find(item => item.name === deployment.model_name);
    if (!group) groups.push((group = {name: deployment.model_name, members: []}));
    group.members.push(deployment);
  }
  let oy = 30;
  for (const group of groups) {
    const h = 24 + group.members.length * 40 + 4;
    nodes[`group:${group.name}`] = {x: objX, y: oy, w: objW, h, label: group.name};
    group.members.forEach((deployment, index) => {
      nodes[`dep:${deployment.id}`] = {x: objX + 8, y: oy + 24 + index * 40, w: objW - 16, h: 34};
    });
    oy += h + 12;
  }
  return {nodes, groups, height: Math.max(left, oy) + 12};
}

// A path from one box to another: out of the side facing the target, curving in.
function route(a, b) {
  if (!a || !b) return null;
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  if (Math.abs(ax - bx) < 40) {
    const x1 = a.x + a.w;
    const x2 = b.x + b.w;
    const bulge = Math.max(x1, x2) + 46;
    return `M ${x1} ${ay} C ${bulge} ${ay}, ${bulge} ${by}, ${x2} ${by}`;
  }
  const leftToRight = ax < bx;
  const x1 = leftToRight ? a.x + a.w : a.x;
  const x2 = leftToRight ? b.x : b.x + b.w;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${x2} ${by}`;
}

const TONE_CLASS = {
  ok: 'dotOk',
  fail: 'dotFail',
  warn: 'dotWarn',
  hop: 'dotHop',
  pick: 'dotPick',
  neutral: 'dotNeutral',
};

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(480, entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Frame({frame, box, active}) {
  const rows = [
    ['model', frame.model],
    ['retry', `${frame.retry} of ${Number.isFinite(frame.max) ? frame.max : '?'}`],
    ['picked', frame.picked ? '' : 'None'],
    [frame.status === 'returned' ? 'returned' : 'last error', frame.note ?? 'None'],
  ];
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        className={active ? styles.frameActive : styles.frame}
      />
      <text x={box.x + 10} y={box.y + 17} className={styles.frameTitle}>
        {frame.scope === '0' ? 'router.call' : `fallback, level ${frame.scope}`}
      </text>
      <text x={box.x + box.w - 10} y={box.y + 17} textAnchor="end" className={styles.frameStatus}>
        {frame.status}
      </text>
      {rows.map(([name, value], index) => {
        const y = box.y + 26 + index * ROW;
        return (
          <g key={name}>
            <text x={box.x + 76} y={y + 13} textAnchor="end" className={styles.varName}>
              {name}
            </text>
            <rect x={box.x + 84} y={y + 1} width={box.w - 94} height={ROW - 3} className={styles.varCell} />
            <text x={box.x + 90} y={y + 13} className={styles.varValue}>
              {value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function StateDiagram({run, deployments}) {
  const states = useMemo(() => fold(run.trace, run.model, run.before), [run]);
  const [index, setIndex] = useState(0);
  const [ref, width] = useWidth();
  const listRef = useRef(null);
  const state = states[index];
  const {nodes, groups, height} = useMemo(() => layout(state, deployments, width), [state, deployments, width]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-step="${index}"]`)?.scrollIntoView({block: 'nearest'});
  }, [index]);

  if (!state) return <p className={styles.muted}>This call has no steps.</p>;

  const go = next => setIndex(Math.max(0, Math.min(states.length - 1, next)));
  const onKey = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      go(index + 1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      go(index - 1);
      event.preventDefault();
    }
  };

  const edge = state.edge ?? {};
  const path = edge.from ? route(nodes[edge.from], nodes[edge.to]) : null;
  const pulse = edge.pulse ? nodes[edge.pulse] : null;
  const activeFrame = state.frames.find(frame => frame.status === 'running') ?? state.frames[state.frames.length - 1];

  return (
    <div className={styles.stepper} tabIndex={0} onKeyDown={onKey} aria-label="Step through this router call">
      <div className={styles.stepBar}>
        <button type="button" onClick={() => go(0)} disabled={index === 0} aria-label="First step">
          ⏮
        </button>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>
          ◀ Back
        </button>
        <span className={styles.stepCount}>
          Step {index + 1} of {states.length}
        </span>
        <button type="button" onClick={() => go(index + 1)} disabled={index === states.length - 1}>
          Forward ▶
        </button>
        <button
          type="button"
          onClick={() => go(states.length - 1)}
          disabled={index === states.length - 1}
          aria-label="Last step">
          ⏭
        </button>
        <input
          className={styles.stepSlider}
          type="range"
          min={0}
          max={states.length - 1}
          value={index}
          onChange={event => go(Number(event.target.value))}
          aria-label="Step"
        />
      </div>
      <p className={styles.stepText}>{state.text}</p>

      <div className={styles.stepLayout}>
        <ol className={styles.stepList} ref={listRef}>
          {states.map((item, i) => (
            <li
              key={i}
              data-step={i}
              className={i === index ? styles.stepCurrent : i < index ? styles.stepDone : styles.stepTodo}
              onClick={() => go(i)}>
              <span className={styles.stepArrow}>{i === index ? '➜' : ''}</span>
              {item.step.kind === 'host' ? `host.${item.step.call}` : item.step.event}
            </li>
          ))}
        </ol>

        <div ref={ref} className={styles.diagramWrap}>
          <svg width={width} height={height} className={styles.diagram} role="img" aria-label={state.text}>
            <defs>
              <marker
                id="rp-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
              </marker>
            </defs>
            <text x={PAD} y={18} className={styles.columnHead}>
              Frames
            </text>
            <text x={nodes[`group:${groups[0]?.name}`]?.x ?? width - 250} y={18} className={styles.columnHead}>
              Deployments
            </text>

            {groups.map(group => {
              const box = nodes[`group:${group.name}`];
              return (
                <g key={group.name}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} className={styles.groupBox} />
                  <text x={box.x + 10} y={box.y + 16} className={styles.groupTitle}>
                    model group {group.name}
                  </text>
                  {group.members.map(deployment => {
                    const dep = nodes[`dep:${deployment.id}`];
                    const status = state.deployments[deployment.id];
                    return (
                      <g key={deployment.id}>
                        <rect
                          x={dep.x}
                          y={dep.y}
                          width={dep.w}
                          height={dep.h}
                          rx={4}
                          className={`${styles.depBox} ${status ? styles[`dep_${status.state}`] : ''}`}
                        />
                        <text x={dep.x + 8} y={dep.y + 14} className={styles.depId}>
                          {deployment.id}
                        </text>
                        <text x={dep.x + 8} y={dep.y + 27} className={styles.depModel}>
                          {deployment.model.length > (dep.w - 16) / 5.4
                            ? `${deployment.model.slice(0, Math.floor((dep.w - 16) / 5.4) - 1)}…`
                            : deployment.model}
                        </text>
                        <text x={dep.x + dep.w - 8} y={dep.y + 14} textAnchor="end" className={styles.depState}>
                          {status
                            ? `${status.state === 'cooling' ? 'cooldown' : status.state} ${status.note ?? ''}`
                            : 'healthy'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {state.frames.map(frame => (
              <Frame
                key={frame.scope}
                frame={frame}
                box={nodes[`frame:${frame.scope}`]}
                active={frame === activeFrame}
              />
            ))}

            <g>
              <rect
                x={nodes.host.x}
                y={nodes.host.y}
                width={nodes.host.w}
                height={nodes.host.h}
                rx={4}
                className={styles.hostBox}
              />
              <text x={nodes.host.x + 10} y={nodes.host.y + 17} className={styles.frameTitle}>
                host
              </text>
              <text x={nodes.host.x + 10} y={nodes.host.y + 34} className={styles.varValue}>
                clock {seconds(state.step.t)}
                {state.step.kind === 'host' ? `, last call ${state.step.call}` : ''}
              </text>
            </g>

            {state.frames
              .filter(frame => frame.picked && nodes[`dep:${frame.picked}`])
              .map(frame => {
                const box = nodes[`frame:${frame.scope}`];
                const target = nodes[`dep:${frame.picked}`];
                const sx = box.x + box.w - 18;
                const sy = box.y + 26 + 2 * ROW + 9;
                const tx = target.x;
                const ty = target.y + target.h / 2;
                const mid = (sx + tx) / 2;
                return (
                  <g key={`ptr-${frame.scope}`}>
                    <circle cx={sx} cy={sy} r={3.5} className={styles.pointerDot} />
                    <path
                      d={`M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`}
                      className={styles.pointer}
                      markerEnd="url(#rp-arrow)"
                    />
                  </g>
                );
              })}

            {path && (
              <g key={`edge-${index}`}>
                <path d={path} className={`${styles.edge} ${styles[TONE_CLASS[edge.tone] ?? 'dotNeutral']}`} />
                <circle r={6} className={`${styles.dot} ${styles[TONE_CLASS[edge.tone] ?? 'dotNeutral']}`}>
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path={path}
                    keyPoints={edge.back ? '0;1;0' : '0;1'}
                    keyTimes={edge.back ? '0;0.5;1' : '0;1'}
                    calcMode="linear"
                  />
                </circle>
              </g>
            )}
            {pulse && (
              // A step that stays inside one frame: the dot runs once around its border.
              <g key={`pulse-${index}`}>
                <circle r={5} className={`${styles.dot} ${styles[TONE_CLASS[edge.tone] ?? 'dotNeutral']}`}>
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={`M ${pulse.x} ${pulse.y} h ${pulse.w} v ${pulse.h} h ${-pulse.w} Z`}
                  />
                </circle>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
