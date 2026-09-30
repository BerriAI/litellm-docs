import React from 'react';
import {MAIN_VERSION, PLAN_RELEASES, progressAt} from '../data';
import {StageBadge} from './StageBadge';

// Every row leads with the same ring. Its arc is the node's progress, a group
// draws its chevron inside, and once a node is complete the ring fills solid
// with the glyph cut out of it: the chevron for a group, a check otherwise.
function ProgressMarker({percent, expandable}) {
  const complete = percent === 100;
  return (
    <svg className={`rm-marker ${complete ? 'rm-markerComplete' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
      <circle className="rm-markerTrack" cx="8" cy="8" r="6.5" />
      {percent > 0 && !complete && (
        <circle className="rm-markerArc" cx="8" cy="8" r="6.5" pathLength="100" strokeDasharray={`${percent} 100`} />
      )}
      {expandable && <path className="rm-markerGlyph" d="M7 5.5 9.5 8 7 10.5" />}
      {!expandable && complete && <path className="rm-markerGlyph" d="M5.3 8.2 7.2 10 10.7 6.2" />}
    </svg>
  );
}

function GraphNode({node}) {
  if (!node.rollout) {
    return <GroupNode group={node} />;
  }
  return (
    <li>
      <div className="rm-node">
        <ProgressMarker percent={progressAt(node, MAIN_VERSION)} />
        <span className="rm-nodeText">{node.text}</span>
        <span className="rm-nodeMeta"><StageBadge feature={node} /></span>
      </div>
    </li>
  );
}

// Groups start collapsed so the list stays scannable; opening one shows what it holds.
export function GroupNode({group}) {
  const percent = progressAt(group, MAIN_VERSION);
  // What the plan adds on top, shown only when it moves this group.
  const plannedPercent = progressAt(group, PLAN_RELEASES.at(-1)?.version ?? MAIN_VERSION, {planned: true});
  return (
    <li>
      <details className="rm-group">
        <summary className="rm-node">
          <ProgressMarker percent={percent} expandable />
          <span className="rm-nodeText">{group.text}</span>
          <span className={`rm-nodeMeta ${percent > 0 ? 'rm-onRust' : ''}`}>
            {plannedPercent > percent && <span className="rm-plannedPercent" title="If the projections hold">→ {plannedPercent}%</span>}
            {percent}%
          </span>
        </summary>
        <ul>
          {group.children.map(child => <GraphNode node={child} key={child.id} />)}
        </ul>
      </details>
    </li>
  );
}
