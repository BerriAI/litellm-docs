import React, {useEffect, useMemo, useRef, useState} from 'react';
import {settingValue, snippet} from './configDoc';
import {FALLBACK_MAPS, fallbackTargets, groupsOf, shares} from './validate';
import styles from './ConfigEditor.module.css';

// The fallback maps as boxes and purple arrows, one tab per map. The graph shows chains and groups
// no request reaches; the side panel edits the selected group's list, where order matters.

const NODE_W = 168;
const NODE_H = 58;
const COL = 236;
const ROW = 86;
const PAD = 24;
const TOP = 44;
const ANY = '*';

const ordinal = n => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

function layout(names, entries) {
  const edges = entries.flatMap(entry => entry.to.map((to, rank) => ({from: entry.from, to, rank})));
  const linked = new Set(edges.flatMap(edge => [edge.from, edge.to]));
  const targets = new Set(edges.map(edge => edge.to));
  const depth = {};
  for (const name of names) if (linked.has(name) && !targets.has(name)) depth[name] = 0;
  // Longest path from a source, capped so a cycle settles.
  for (let pass = 0; pass < names.length; pass += 1) {
    let moved = false;
    for (const edge of edges) {
      if (depth[edge.from] == null) continue;
      const next = depth[edge.from] + 1;
      if (next < names.length && (depth[edge.to] == null || depth[edge.to] < next)) {
        depth[edge.to] = next;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const name of names) if (linked.has(name) && depth[name] == null) depth[name] = 0;
  const columns = [];
  for (const name of names) {
    if (depth[name] == null) continue;
    (columns[depth[name]] ??= []).push(name);
  }
  // Inside a column, a 1st target sits above a 2nd, so arrows from one group fan out downwards.
  const rank = name => Math.min(...edges.filter(edge => edge.to === name).map(edge => edge.rank), 99);
  columns.forEach(column => column?.sort((a, b) => rank(a) - rank(b)));
  const position = {};
  let rows = 0;
  columns.forEach((column, c) => {
    (column ?? []).forEach((name, r) => {
      position[name] = {x: PAD + c * COL, y: TOP + r * ROW};
      rows = Math.max(rows, r + 1);
    });
  });
  const loose = names.filter(name => depth[name] == null);
  const perRow = Math.max(1, columns.length, 3);
  loose.forEach((name, i) => {
    position[name] = {x: PAD + (i % perRow) * COL, y: TOP + (rows + Math.floor(i / perRow)) * ROW + (rows ? 20 : 0)};
  });
  const bottom = Math.max(...Object.values(position).map(p => p.y + NODE_H), 160);
  // Arrows that skip a column or point back run in lanes under the boxes.
  let lanes = 0;
  for (const edge of edges) {
    const a = position[edge.from];
    const b = position[edge.to];
    edge.lane = b.x - a.x > COL || b.x <= a.x ? bottom + 22 + 16 * lanes++ : null;
  }
  const height = bottom + PAD + 16 * lanes + (lanes ? 14 : 0);
  const width = Math.max(...Object.values(position).map(p => p.x + NODE_W), 300) + PAD;
  return {edges, position, loose: new Set(loose), width, height};
}

function edgePath(a, b, lane) {
  const sx = a.x + NODE_W;
  const sy = a.y + NODE_H / 2;
  const tx = b.x;
  const ty = b.y + NODE_H / 2;
  if (lane == null) {
    const mid = sx + Math.min(40, (tx - sx) / 2);
    return {d: `M ${sx} ${sy} H ${mid} V ${ty} H ${tx - 4}`, lx: mid + 8, ly: ty - 6};
  }
  const out = sx + 20;
  const back = tx - 24;
  return {d: `M ${sx} ${sy} H ${out} V ${lane} H ${back} V ${ty} H ${tx - 4}`, lx: back - 34, ly: lane - 5};
}

function RankedList({from, targets, groups, onChange}) {
  const [dragging, setDragging] = useState(null);
  const options = [...groups.keys()].filter(name => name && name !== from && !targets.includes(name));
  const move = (index, to) => {
    if (to < 0 || to >= targets.length || to === index) return;
    const next = [...targets];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return (
    <div className={styles.ranked}>
      {targets.map((target, index) => (
        <div
          key={target}
          className={`${styles.rankRow} ${dragging === index ? styles.rankDragging : ''}`}
          draggable
          tabIndex={0}
          aria-label={`${ordinal(index + 1)}: ${target}. Alt and the arrow keys move it.`}
          onDragStart={event => {
            setDragging(index);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            move(Number(event.dataTransfer.getData('text/plain')), index);
            setDragging(null);
          }}
          onKeyDown={event => {
            if (!event.altKey) return;
            if (event.key === 'ArrowUp') move(index, index - 1);
            if (event.key === 'ArrowDown') move(index, index + 1);
          }}>
          <span className={styles.grip} aria-hidden="true">
            ⋮⋮
          </span>
          <span className={styles.rank}>{ordinal(index + 1)}</span>
          <span className={groups.has(target) ? styles.mono : styles.missing}>{target}</span>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${target}`}
            onClick={() => onChange(targets.filter(item => item !== target))}>
            ×
          </button>
        </div>
      ))}
      {options.length > 0 && (
        <select
          className={styles.addTarget}
          value=""
          aria-label="Add a fallback group"
          onChange={event => event.target.value && onChange([...targets, event.target.value])}>
          <option value="">+ add a group</option>
          {options.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function FallbackGraph({data, map, onMap, issues, onTargets}) {
  const groups = useMemo(() => groupsOf(data), [data]);
  const entries = fallbackTargets(data, map);
  const names = useMemo(() => {
    const list = [...groups.keys()].filter(Boolean);
    for (const entry of entries)
      for (const name of [entry.from, ...entry.to]) if (!list.includes(name)) list.push(name);
    if (map === 'default_fallbacks' && !list.includes(ANY)) list.unshift(ANY);
    return list;
  }, [groups, entries, map]);
  const [selected, setSelected] = useState(null);
  const [link, setLink] = useState(null);
  const canvas = useRef(null);
  const {edges, position, loose, width, height} = layout(names, entries);

  const current =
    map === 'default_fallbacks'
      ? ANY
      : selected && names.includes(selected) && selected !== ANY
        ? selected
        : (entries[0]?.from ?? names.find(name => groups.has(name)));
  const targets = entries.find(entry => entry.from === current)?.to ?? [];
  const setTargets = next => onTargets(map, current === ANY ? ANY : current, next);

  useEffect(() => {
    if (!link) return undefined;
    const point = event => {
      const box = canvas.current.getBoundingClientRect();
      return {x: event.clientX - box.left + canvas.current.scrollLeft, y: event.clientY - box.top};
    };
    const moveTo = event => setLink(previous => previous && {...previous, ...point(event)});
    const drop = event => {
      const node = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-group]');
      const to = node?.getAttribute('data-group');
      const list = entries.find(entry => entry.from === link.from)?.to ?? [];
      if (to && to !== link.from && to !== ANY && !list.includes(to)) onTargets(map, link.from, [...list, to]);
      setSelected(link.from);
      setLink(null);
    };
    window.addEventListener('pointermove', moveTo);
    window.addEventListener('pointerup', drop);
    return () => {
      window.removeEventListener('pointermove', moveTo);
      window.removeEventListener('pointerup', drop);
    };
  }, [link, entries, map, onTargets]);

  const count = name => groups.get(name)?.length ?? 0;
  const sub = name => {
    if (name === ANY) return 'every group without its own entry';
    if (!groups.has(name)) return 'no such model group';
    const n = count(name);
    const ordered = shares(groups.get(name)).ordered;
    const parts = [`${n} deployment${n === 1 ? '' : 's'}`];
    if (ordered) parts.push('order tiers');
    if (loose.has(name)) parts.push('no fallbacks');
    return parts.join(' · ');
  };
  const maxFallbacks = settingValue(data, 'max_fallbacks') ?? 5;
  const shownAs = entries.filter(entry => entry.to.length);
  const missing = issues.filter(issue => issue.map === map);

  return (
    <div className={styles.graphWrap}>
      <div className={styles.tabs} role="tablist" aria-label="Fallback map">
        {FALLBACK_MAPS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === map}
            className={item.key === map ? styles.tabOn : styles.tab}
            onClick={() => onMap(item.key)}>
            {item.tab}
          </button>
        ))}
        <span className={styles.spacer} />
        <span className={styles.muted}>max_fallbacks {maxFallbacks}</span>
      </div>
      <div className={styles.graphBody}>
        <div className={styles.canvas} ref={canvas}>
          <span className={styles.canvasCap}>Model groups · drag from a group's right edge to add a fallback</span>
          <div style={{position: 'relative', width, height}}>
            <svg className={styles.edges} width={width} height={height} aria-hidden="true">
              <defs>
                <marker id="fg-arrow" orient="auto" markerWidth="6" markerHeight="6" refX="3" refY="3">
                  <path d="M0 0 L6 3 L0 6 Z" className={styles.arrowHead} />
                </marker>
              </defs>
              {edges.map(edge => {
                const {d, lx, ly} = edgePath(position[edge.from], position[edge.to], edge.lane);
                const own = edge.from === current;
                return (
                  <g key={`${edge.from}-${edge.to}`} className={own ? styles.edgeOwn : styles.edgeThen}>
                    <path d={d} markerEnd="url(#fg-arrow)" />
                    <text x={lx} y={ly}>
                      {ordinal(edge.rank + 1)}
                    </text>
                  </g>
                );
              })}
              {link && (
                <path
                  className={styles.edgeDraft}
                  d={`M ${position[link.from].x + NODE_W} ${position[link.from].y + NODE_H / 2} L ${link.x} ${link.y}`}
                />
              )}
            </svg>
            {names.map(name => {
              const p = position[name];
              const cls = [
                styles.node,
                name === current ? styles.nodeOn : '',
                !groups.has(name) && name !== ANY ? styles.nodeMissing : '',
                loose.has(name) || name === ANY ? styles.nodeLoose : '',
              ].join(' ');
              return (
                <div
                  key={name}
                  data-group={name}
                  className={cls}
                  style={{left: p.x, top: p.y, width: NODE_W, height: NODE_H}}>
                  <button
                    type="button"
                    className={styles.nodeButton}
                    aria-pressed={name === current}
                    disabled={map === 'default_fallbacks' && name !== ANY}
                    onClick={() => setSelected(name)}>
                    <span className={styles.nodeTitle}>{name === ANY ? 'any group' : name}</span>
                    <span className={styles.nodeSub}>{sub(name)}</span>
                  </button>
                  {groups.has(name) && map !== 'default_fallbacks' && (
                    <span
                      className={styles.handle}
                      title={`Drag to another group to add a fallback for ${name}`}
                      onPointerDown={event => {
                        event.preventDefault();
                        const box = canvas.current.getBoundingClientRect();
                        setLink({
                          from: name,
                          x: event.clientX - box.left + canvas.current.scrollLeft,
                          y: event.clientY - box.top,
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.side}>
          <span className={styles.cap}>Selected · {current === ANY ? 'any group' : current}</span>
          <div className={styles.card}>
            <span className={styles.muted}>
              {current === ANY
                ? 'When a group has no entry of its own in fallbacks, try in this order:'
                : `When every ${current} deployment has failed or is cooling down, try in this order:`}
            </span>
            <RankedList from={current} targets={targets} groups={groups} onChange={setTargets} />
            {missing.map(issue => (
              <div key={issue.from} className={styles.err}>
                <b>!</b>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
          <span className={styles.cap}>As the state diagram shows it</span>
          <div className={styles.diagramChips}>
            <span className={styles.muted}>{map}</span>
            {shownAs.length === 0 && <span className={styles.muted}>none</span>}
            {shownAs.map(entry => (
              <span key={entry.from} className={styles.hopChip}>
                {entry.from === ANY ? 'any' : entry.from} → {entry.to.join(', ')}
              </span>
            ))}
          </div>
          <span className={styles.cap}>In the YAML</span>
          <pre className={styles.snippet}>{snippet(map, settingValue(data, map))}</pre>
        </div>
      </div>
    </div>
  );
}
