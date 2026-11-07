import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {ArrowRight, FileCode2, GitCompareArrows, LoaderCircle, ThumbsUp, ThumbsDown} from 'lucide-react';
import styles from './upgrade.module.css';

const sections = [
  ['breakingChanges', 'Breaking changes', 'No breaking changes identified in the supplied sources. This is not a compatibility guarantee.'],
  ['databaseMigrations', 'Database migrations', 'No migration risks identified in the supplied sources. Check the migration files before deployment.'],
  ['upgradeSteps', 'Upgrade checklist', 'No specific upgrade steps documented for this range. Validate the upgrade in staging.'],
  ['otherChanges', 'Other changes', 'No other changes identified in the supplied sources.'],
];

export default function UpgradeAssistant({versions}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(null);
  const [ratingState, setRatingState] = useState('');
  const request = useRef(null);
  const feedbackRequest = useRef(null);
  useEffect(() => () => {request.current?.abort(); feedbackRequest.current?.abort();}, []);

  function change(setter, value) {
    request.current?.abort();
    feedbackRequest.current?.abort();
    setter(value);
    setResult(null);
    setError('');
    setLoading(false);
    setRating(null); setRatingState('');
  }

  async function rate(value) {
    const id = result.feedbackId;
    const controller = new AbortController();
    feedbackRequest.current = controller;
    setRatingState('saving');
    try {
      const response = await fetch('/api/docs/upgrade-feedback', {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, rating: value}),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])});
      if (!response.ok) throw new Error('Could not save feedback. Please retry.');
      if (!controller.signal.aborted) {setRating(value); setRatingState('saved');}
    } catch { if (!controller.signal.aborted) setRatingState('error'); }
  }

  async function compare(event) {
    event.preventDefault();
    request.current?.abort();
    feedbackRequest.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(''); setResult(null); setRating(null); setRatingState('');
    try {
      const response = await fetch('/api/docs/upgrade', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({from: from.trim(), to: to.trim()}),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not compare these versions. Please retry.');
      if (!controller.signal.aborted) setResult(data);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.name === 'TimeoutError'
        ? 'The comparison timed out. Try a smaller version range.' : failure.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="upgrade-title">
      <div className={styles.heading}>
        <GitCompareArrows size={20} aria-hidden="true" />
        <h2 id="upgrade-title">Plan your upgrade</h2>
        <span className={styles.badge}>AI preview</span>
      </div>
      <p className={styles.description}>Compare two release tags. Get breaking changes, database migration risks and an upgrade checklist from the source diff.</p>
      <form onSubmit={compare} className={styles.form}>
        <label>Current version
          <input list="upgrade-versions" value={from} onChange={event => change(setFrom, event.target.value)}
            placeholder={versions[1] || 'v1.105.0'} required maxLength={48} autoComplete="off" />
        </label>
        <ArrowRight size={18} className={styles.arrow} aria-hidden="true" />
        <label>Target version
          <input list="upgrade-versions" value={to} onChange={event => change(setTo, event.target.value)}
            placeholder={versions[0] || 'v1.106.0'} required maxLength={48} autoComplete="off" />
        </label>
        <datalist id="upgrade-versions">{versions.map(version => <option key={version} value={version} />)}</datalist>
        <button type="submit" disabled={loading || !from.trim() || !to.trim()}
          title={!from.trim() || !to.trim() ? 'Enter both versions to compare' : undefined}>
          {loading && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />}
          {loading ? 'Comparing...' : 'Compare versions'}
        </button>
      </form>
      <p className={styles.hint}>Uses the exact tag-to-tag migration and schema diff plus published changelog Markdown. No deployment data is sent.</p>
      <div aria-live="polite" aria-atomic="true">
        {loading && <p className={styles.progress} role="status">Reading release tags and migration files, then generating guidance. This can take up to a minute.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      {result && <div className={styles.results}>
        <div className={styles.resultHeader}>
          <strong>{result.from} to {result.to}</strong>
          <span>{result.migrationFiles} migration / schema files changed</span>
        </div>
        <p className={styles.notice}>AI-generated guidance. Verify the linked sources and test in staging before production. No migration or upgrade commands are executed.</p>
        {result.warnings.map(warning => <p className={styles.notice} key={warning}>{warning}</p>)}
        {sections.map(([key, title, empty]) => <section key={key} className={key === 'breakingChanges' ? styles.breaking : styles.section}>
          <h3>{title}</h3>
          {result.guide[key].length ? <ul>{result.guide[key].map((item, i) => <li key={i}>
            {item.text}{' '}{item.sources.map(id => <a key={id} href={result.sources[id - 1].url}
              target="_blank" rel="noopener noreferrer" aria-label={`Source ${id}: ${result.sources[id - 1].title}`}>[{id}]</a>)}
          </li>)}</ul> : <p>{empty}</p>}
        </section>)}
        <details className={styles.evidence}>
          <summary><FileCode2 size={16} aria-hidden="true" /> Sources and coverage ({result.sources.length})</summary>
          <p>Code snapshots: <a href={`https://github.com/BerriAI/litellm/tree/${result.base}`}>{result.base.slice(0, 7)}</a>{' to '}
            <a href={`https://github.com/BerriAI/litellm/tree/${result.head}`}>{result.head.slice(0, 7)}</a></p>
          {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
          <ol>{result.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
            {source.previousUrl && <> (<a href={source.previousUrl} target="_blank" rel="noopener noreferrer">before</a>)</>}
          </li>)}</ol>
        </details>
        <Link className={styles.fullDiff} to={`https://github.com/BerriAI/litellm/compare/${encodeURIComponent(result.from)}...${encodeURIComponent(result.to)}`}>Open full GitHub comparison</Link>
        <div className={styles.feedback}>
          <span>Was this guide helpful?</span>
          {[[ThumbsUp, 'good', 'Thumbs up'], [ThumbsDown, 'bad', 'Thumbs down']].map(([Icon, value, label]) =>
            <button key={value} type="button" aria-label={label} aria-pressed={rating === value}
              disabled={!result.feedbackId || ratingState === 'saving'} onClick={() => rate(value)}
              title={!result.feedbackId ? 'Feedback storage is currently unavailable' : label}>
              <Icon size={17} aria-hidden="true" />
            </button>)}
          <span role="status">{ratingState === 'saved' ? 'Feedback saved. It helps improve future guides.' : ratingState === 'error' ? 'Could not save feedback. Please retry.' : ratingState === 'saving' ? 'Saving...' : ''}</span>
        </div>
      </div>}
    </section>
  );
}
