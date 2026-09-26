import React from 'react';
import {STAGES} from '../data';
import {StageIcon} from './StageBadge';
import {stageAnchor} from './format';

// The cards' anchor ids, so the host can register them with its link checker.
export const STAGE_ANCHORS = [...STAGES.slice(1).map(stage => stage.id), 'done'].map(stageAnchor);

// Explains each rollout stage once, so the tracker's badges can stay terse and
// link here instead.
export function RolloutStages() {
  const stages = [
    ...STAGES.slice(1).map(stage => ({kind: stage.id, ...stage})),
    {
      kind: 'done',
      label: 'Done',
      description: 'Shared work like cloud auth has no rollout of its own. It is done once every Rust path can use it.',
    },
  ];
  return (
    <>
      <p className="rm-sectionLead">
        Each feature starts on Python and moves through these stages one release at a time. For the two middle stages,
        the <code>LITELLM_RUST</code> environment variable flips the default for the whole process.
      </p>
      <ul className="rm-stages">
        {stages.map(stage => (
          <li className="rm-stage" id={stageAnchor(stage.kind)} key={stage.kind}>
            <p className="rm-stageName">
              <StageIcon kind={stage.kind} className="rm-stageIcon" />
              {stage.label}
            </p>
            <p className="rm-stageDescription">{stage.description}</p>
            {stage.switch && (
              <p className="rm-stageSwitch">
                <code>LITELLM_RUST={stage.switch.value}</code>
                <span>{stage.switch.effect}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
