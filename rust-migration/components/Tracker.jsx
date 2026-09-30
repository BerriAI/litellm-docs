import React, {useState} from 'react';
import {Select} from '@base-ui/react/select';
import {GOALS, MAIN_VERSION, progressAt} from '../data';
import {FULL_DATE, formatDate} from './format';
import {GroupNode} from './Breakdown';
import {SectionHeading} from './SectionHeading';
import {MigrationTimeline} from './Timeline';

const GOAL_ITEMS = GOALS.map(goal => ({value: goal.id, label: goal.text}));

function GoalSelect({goal, onChange}) {
  return (
    <Select.Root
      items={GOAL_ITEMS}
      value={goal.id}
      onValueChange={id => onChange(GOALS.find(item => item.id === id))}
    >
      <Select.Trigger className="rm-picker-sentenceControl" aria-label="Migration goal">
        <Select.Value />
        <Select.Icon className="rm-picker-selectIcon">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="rm-picker-selectPositioner" sideOffset={8} align="start" alignItemWithTrigger={false}>
          <Select.Popup className="rm-picker-selectPopup">
            <Select.List>
              {GOALS.map(item => (
                <Select.Item className="rm-picker-selectItem" value={item.id} key={item.id}>
                  <Select.ItemText className="rm-picker-selectLabel">{item.text}</Select.ItemText>
                  <span className="rm-picker-selectMeta">by {formatDate(FULL_DATE, item.endsOn)}</span>
                  {/* Answers "what is in this goal" right where it is picked. */}
                  <span className="rm-picker-selectScope">
                    {item.summary ?? item.children.map(child => child.text).join(', ')}
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// Icons mirror the views they open: a stepped progress line and a dependency tree.
const VIEW_ICONS = {
  timeline: <path d="M2 13h3V9h4V6h5" />,
  breakdown: (
    <>
      <path d="M4 5v8h5M4 8.5h5" />
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="11" cy="8.5" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </>
  ),
};

export function Tracker() {
  const [goal, setGoal] = useState(GOALS[0]);
  const [view, setView] = useState('timeline');
  const otherView = view === 'timeline' ? 'breakdown' : 'timeline';

  return (
    <section className="rm-section" aria-labelledby="migration-tracker-title">
      <SectionHeading id="migration-tracker-title" kicker="Migration tracker" title="Where we are today" />
      <div className="rm-chartCard">
        <p className="rm-goalSentence">
          <strong className="rm-progressSummary" title={`Across ${goal.features.length} features`}>
            {progressAt(goal, MAIN_VERSION)}%
          </strong>
          {' of '}
          <GoalSelect goal={goal} onChange={setGoal} />
          {' migrated to Rust, '}
          <span className="rm-keepTogether">
            {'shown as a '}
            <button
              className="rm-picker-sentenceControl"
              type="button"
              title={`Show the ${otherView}`}
              onClick={() => setView(otherView)}
            >
              {/* Keyed so the word pops each time it flips. */}
              <span className="rm-viewWord" key={view}>
                {view}
                <svg viewBox="0 0 16 16" aria-hidden="true">{VIEW_ICONS[view]}</svg>
              </span>
            </button>
            .
          </span>
        </p>
        {/* The chart stays mounted so it keeps its measured width. */}
        <div hidden={view !== 'timeline'}>
          <MigrationTimeline goal={goal} />
        </div>
        {/* The sentence above already names the goal, so the tree starts at its children. */}
        <ul className="rm-tree" hidden={view !== 'breakdown'}>
          {goal.children.map(area => <GroupNode group={area} key={area.id} />)}
        </ul>
      </div>
    </section>
  );
}
