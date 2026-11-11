import React from 'react';
import {OUTCOMES} from './RequestPresets';
import styles from './Request.module.css';

// How each provider answers this one request. "as configured" leaves the deployment to its
// mock_response; anything else replaces it for this request only.
export default function RequestResponses({info, responses, onChange}) {
  const set = (id, fields) => {
    const next = {...responses, [id]: {...responses[id], ...fields}};
    if (!next[id].outcome) delete next[id];
    onChange(next);
  };
  return (
    <table className={styles.responses}>
      <thead>
        <tr>
          <th>deployment</th>
          <th>model group</th>
          <th>answers this request with</th>
          <th>first attempt only</th>
        </tr>
      </thead>
      <tbody>
        {(info?.deployments ?? []).map(deployment => {
          const response = responses[deployment.id] ?? {};
          const fails = OUTCOMES.find(item => item.value === response.outcome)?.fail;
          return (
            <tr key={deployment.id} className={response.outcome ? styles.changed : undefined}>
              <td>
                <code>{deployment.id}</code>
              </td>
              <td>{deployment.model_name}</td>
              <td>
                <select
                  aria-label={`${deployment.id} answers with`}
                  value={response.outcome ?? ''}
                  onChange={event => set(deployment.id, {outcome: event.target.value})}>
                  {OUTCOMES.map(outcome => (
                    <option key={outcome.value} value={outcome.value}>
                      {outcome.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${deployment.id} fails on its first attempt only`}
                  disabled={!fails}
                  checked={Boolean(fails && response.once)}
                  onChange={event => set(deployment.id, {once: event.target.checked})}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
