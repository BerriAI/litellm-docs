import React, {useRef} from 'react';
import styles from './SimKinds.module.css';

// A colour per kind of request, so the live run can show which kind each bar and failure belongs to.
// Slots follow the kind, not its position: removing one kind does not repaint the others. The hues
// live on the simulator panel in Simulator.module.css as --sim-kind-0 to --sim-kind-7, stepped for dark mode.

export const KIND_SLOTS = 8;

export const kindColour = slot =>
  slot == null || slot >= KIND_SLOTS ? 'var(--sim-kind-other)' : `var(--sim-kind-${slot})`;

// Label to slot for the current mix. A kind keeps its slot while it stays in the mix; a new one takes
// the lowest free slot.
export function useKindSlots(kinds) {
  const byKey = useRef(new Map());
  const keys = new Set(kinds.map(kind => kind.key));
  for (const key of [...byKey.current.keys()]) if (!keys.has(key)) byKey.current.delete(key);
  const used = new Set(byKey.current.values());
  const slots = new Map();
  for (const kind of kinds) {
    if (!byKey.current.has(kind.key)) {
      let slot = 0;
      while (used.has(slot)) slot += 1;
      used.add(slot);
      byKey.current.set(kind.key, slot);
    }
    const label = kind.label || 'request';
    if (!slots.has(label)) slots.set(label, byKey.current.get(kind.key));
  }
  return slots;
}

// Whether a kind is drawn at full strength: every kind is when nothing is picked.
export const kindActive = (active, label) => !active.size || active.has(label);

export function KindSwatch({slot}) {
  return <i className={styles.swatch} style={{background: kindColour(slot)}} aria-hidden="true" />;
}

// The kinds as a legend that doubles as a filter: picking kinds dims the rest everywhere they show.
export function KindLegend({kinds, slots, active, onToggle, onClear}) {
  const labels = [...new Set(kinds.filter(kind => Number(kind.share) > 0).map(kind => kind.label || 'request'))];
  if (labels.length < 2) return null;
  return (
    <div className={styles.legend} role="group" aria-label="Request kinds: pick some to highlight them">
      <span className={styles.cap}>Kinds</span>
      {labels.map(label => (
        <button
          key={label}
          type="button"
          aria-pressed={active.has(label)}
          className={kindActive(active, label) ? styles.kind : `${styles.kind} ${styles.kindDim}`}
          onClick={() => onToggle(label)}>
          <KindSwatch slot={slots.get(label)} />
          {label}
        </button>
      ))}
      {active.size > 0 ? (
        <button type="button" className={styles.clear} onClick={onClear}>
          Show all
        </button>
      ) : (
        <span className={styles.hint}>click a kind to highlight it</span>
      )}
    </div>
  );
}
