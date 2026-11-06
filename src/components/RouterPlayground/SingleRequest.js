import React from 'react';
import {MOCKS, metadataOf, singleFromKind} from './requests';
import styles from './styles.module.css';

// What one sent request carries: the fields a simulator request kind has, with one session id.
export default function SingleRequest({value, onChange, model, onModel, kinds, info}) {
  const set = fields => onChange({...value, ...fields});
  const groups = [...new Set((info?.deployments ?? []).map(item => item.model_name))];
  const metadata = metadataOf(value);
  const number = event => (event.target.value === '' ? null : Number(event.target.value));
  return (
    <div className={styles.single}>
      <div className={styles.controls}>
        <label className={styles.inline}>
          model
          <input value={model} onChange={event => onModel(event.target.value)} />
        </label>
        <label className={styles.inline}>
          send to
          <select value={value.model} onChange={event => set({model: event.target.value})}>
            <option value="">{model || 'the model'}</option>
            {groups
              .filter(group => group !== model)
              .map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
          </select>
        </label>
        <label className={styles.inline}>
          session id
          <input
            value={value.session}
            placeholder="none"
            onChange={event => set({session: event.target.value.trim()})}
          />
        </label>
        <label className={styles.inline}>
          team id
          <input value={value.team_id} placeholder="none" onChange={event => set({team_id: event.target.value.trim()})} />
        </label>
        <label className={styles.inline}>
          tokens
          <input type="number" min={0} step={100} placeholder="1000" value={value.tokens ?? ''} onChange={event => set({tokens: number(event)})} />
        </label>
      </div>
      <div className={styles.controls}>
        <label className={styles.inline}>
          num_retries
          <input
            type="number"
            min={0}
            placeholder="router's"
            value={value.num_retries ?? ''}
            onChange={event => set({num_retries: number(event)})}
          />
        </label>
        <label className={styles.inline}>
          mock_testing
          <select value={value.mock} onChange={event => set({mock: event.target.value})}>
            {MOCKS.map(mock => (
              <option key={mock.value} value={mock.value}>
                {mock.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={!value.disable_fallbacks}
            onChange={event => set({disable_fallbacks: !event.target.checked})}
          />
          fallbacks
        </label>
        {kinds?.length > 0 && (
          <label className={styles.inline}>
            copy a simulator kind
            <select
              value=""
              onChange={event => {
                const kind = kinds.find(item => item.key === event.target.value);
                if (kind) onChange(singleFromKind(kind, value));
              }}>
              <option value="">choose</option>
              {kinds.map(kind => (
                <option key={kind.key} value={kind.key}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={styles.controls}>
        <label className={`${styles.inline} ${styles.grow}`}>
          metadata
          <input
            className={metadata.ok ? styles.wide : `${styles.wide} ${styles.bad}`}
            value={value.metadata}
            placeholder='none, or a JSON object such as {"tags": ["x"]}'
            onChange={event => set({metadata: event.target.value})}
          />
        </label>
        {!metadata.ok && <span className={styles.badText}>{metadata.error}; not sent until it parses</span>}
      </div>
    </div>
  );
}
