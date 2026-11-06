import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  appendIn,
  changedLines,
  deploymentPath,
  deploymentValue,
  keptKeys,
  parseYaml,
  setFallbacks,
  setIn,
  setSetting,
  settingValue,
} from './configDoc';
import FallbackGraph from './FallbackGraph';
import ProfileEditor from './ProfileEditor';
import {PROFILE_PRESETS, profileSummary} from './profiles';
import {FALLBACK_MAPS, PYTHON_STRATEGIES, fallbackTargets, groupsOf, shares, validate} from './validate';
import {yamlTokens} from './yamlTokens';
import styles from './ConfigEditor.module.css';

// The router config as a form over the YAML, which stays the source of truth: every form edit
// patches one node of the YAML document. Behaviour profiles live beside it, keyed by deployment id.

const RETRY_KINDS = [
  'RateLimitErrorRetries',
  'InternalServerErrorRetries',
  'ServiceUnavailableErrorRetries',
  'TimeoutErrorRetries',
  'ContentPolicyViolationErrorRetries',
  'BadRequestErrorRetries',
  'AuthenticationErrorRetries',
];

const fmt = value => (value == null ? '' : String(value));
const toNumber = raw => (raw === '' ? undefined : Number(raw));

// A number input that keeps what is typed ("0.", "1e") while focused and writes only valid numbers.
function NumInput({value, onCommit, placeholder, className, label, invalid}) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      className={`${className ?? styles.input} ${invalid ? styles.inputWarn : ''}`}
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? fmt(value)}
      onFocus={() => setDraft(fmt(value))}
      onBlur={() => setDraft(null)}
      onChange={event => {
        const raw = event.target.value.trim();
        setDraft(event.target.value);
        if (raw === '' || Number.isFinite(Number(raw))) onCommit(toNumber(raw));
      }}
    />
  );
}

function Toggle({on, onChange, label}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={on ? styles.toggleOn : styles.toggle}
      onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Issue({issue, children}) {
  const cls = issue.level === 'err' ? styles.err : issue.level === 'warn' ? styles.warn : styles.info;
  return (
    <div className={cls} role={issue.level === 'err' ? 'alert' : undefined}>
      <b>{issue.level === 'info' ? 'i' : '!'}</b>
      <span>
        {issue.message} {children}
      </span>
    </div>
  );
}

function YamlView({text, onChange, error, marks}) {
  const lines = text.split('\n');
  const width = Math.max(...lines.map(line => line.length));
  return (
    <div className={error ? styles.codeBad : styles.code}>
      <div className={styles.codeScroll}>
        <div className={styles.gutter} aria-hidden="true">
          {lines.map((_, i) => {
            const kind = marks[i + 1];
            return (
              <div key={i} className={kind ? styles[`line_${kind}`] : undefined}>
                <span>{i + 1}</span>
                <i>{kind === 'edit' ? '~' : kind === 'err' ? '!' : ''}</i>
              </div>
            );
          })}
        </div>
        <div className={styles.codeBody}>
          <div className={styles.backdrop} aria-hidden="true">
            {lines.map((line, i) => (
              <div key={i} className={marks[i + 1] ? styles[`line_${marks[i + 1]}`] : undefined}>
                {line
                  ? yamlTokens(line).map((token, j) =>
                      token.kind ? (
                        <span key={j} className={styles[`y_${token.kind}`]}>
                          {token.text}
                        </span>
                      ) : (
                        token.text
                      ),
                    )
                  : ' '}
              </div>
            ))}
          </div>
          <textarea
            className={styles.textarea}
            spellCheck={false}
            wrap="off"
            value={text}
            style={{height: lines.length * 20 + 16, width: `max(100%, calc(${width}ch + 28px))`}}
            onChange={event => onChange(event.target.value)}
            aria-label="Router config as YAML"
          />
        </div>
      </div>
      {error && (
        <p className={styles.parseError} role="alert">
          Line {error.line}: {error.message}. Fix it to switch back to the form; the router keeps running the last
          config that parsed.
        </p>
      )}
    </div>
  );
}

function DeploymentRow({entry, index, shown, share, metric, single, skipped, issues, profile, open, timeout, actions}) {
  const params = entry.litellm_params ?? {};
  const idIssue = issues.find(issue => issue.field === 'id');
  const orderIssue = issues.find(issue => issue.field === 'order');
  const label = profile
    ? (PROFILE_PRESETS[profile.preset]?.label ?? 'Custom')
    : params.mock_response != null
      ? 'Fixed reply'
      : 'Instant OK';
  const pct = share == null ? null : Math.round(share * 100);
  return (
    <>
      <div
        data-row={shown}
        className={`${styles.row} ${open ? styles.rowOpen : ''} ${skipped ? styles.rowSkipped : ''}`}>
        <input
          className={`${styles.input} ${styles.idInput} ${idIssue ? styles.inputErr : ''}`}
          aria-label={`id of deployment ${index + 1}`}
          value={fmt(deploymentValue(entry, 'id'))}
          placeholder={shown ?? 'generated'}
          onChange={event => actions.field(index, 'id', event.target.value || undefined)}
        />
        <input
          className={styles.input}
          aria-label={`model of ${shown}`}
          value={fmt(params.model)}
          onChange={event => actions.field(index, 'model', event.target.value)}
        />
        <span className={styles.weight}>
          {single ? (
            <span className={styles.muted}>only deployment</span>
          ) : (
            <>
              <NumInput
                className={`${styles.input} ${styles.small}`}
                label={`weight of ${shown}`}
                value={params.weight}
                placeholder="none"
                onCommit={value => actions.field(index, 'weight', value)}
              />
              {skipped ? (
                <span className={styles.skipped}>skipped</span>
              ) : (
                <>
                  <span className={styles.bar} title={metric ? `split by ${metric}` : 'even split'}>
                    <span style={{width: `${pct ?? 0}%`}} />
                  </span>
                  <span className={styles.pct}>{pct == null ? '' : `${pct}%`}</span>
                </>
              )}
            </>
          )}
        </span>
        <NumInput
          className={`${styles.input} ${styles.small}`}
          label={`order of ${shown}`}
          value={deploymentValue(entry, 'order')}
          placeholder="none"
          invalid={!!orderIssue}
          onCommit={value => actions.field(index, 'order', value)}
        />
        <NumInput
          className={`${styles.input} ${styles.small}`}
          label={`rpm of ${shown}`}
          value={params.rpm}
          placeholder="none"
          onCommit={value => actions.field(index, 'rpm', value)}
        />
        <NumInput
          className={`${styles.input} ${styles.small}`}
          label={`tpm of ${shown}`}
          value={params.tpm}
          placeholder="none"
          onCommit={value => actions.field(index, 'tpm', value)}
        />
        <button
          type="button"
          className={`${profile ? styles.chipOn : styles.chip} ${styles.behaviourChip}`}
          aria-expanded={open}
          aria-label={`Behaviour of ${shown}: ${label}`}
          onClick={() => actions.toggle(shown)}>
          {label} <span aria-hidden="true">▾</span>
        </button>
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${shown}`}
          title="Remove deployment"
          onClick={() => actions.remove(index)}>
          ×
        </button>
      </div>
      {open && (
        <div className={styles.behaviour}>
          <div className={styles.behaviourHead}>
            <span className={styles.muted}>in the simulator</span>
            <span className={styles.mono}>{profile ? profileSummary(profile) : 'no profile, answers at once'}</span>
          </div>
          <ProfileEditor
            value={profile}
            compact
            timeout={params.timeout ?? timeout}
            onChange={next => actions.profile(shown, next)}
          />
          <label className={styles.inlineField}>
            <span className={styles.key}>mock_response</span>
            <input
              className={styles.input}
              value={typeof params.mock_response === 'string' ? params.mock_response : fmt(params.mock_response)}
              placeholder="none"
              onChange={event => actions.field(index, 'mock_response', event.target.value || undefined)}
            />
          </label>
        </div>
      )}
      {issues.map(issue => (
        <div key={`${issue.field}-${issue.message}`} className={styles.rowIssue}>
          <Issue issue={issue}>
            {issue.field === 'order' && (
              <button type="button" className={styles.link} onClick={() => actions.field(index, 'order', issue.next)}>
                Set order {issue.next}
              </button>
            )}
          </Issue>
        </div>
      ))}
    </>
  );
}

function GroupCard({name, members, info, data, issues, profiles, openRow, actions}) {
  const {shares: split, metric, ordered} = shares(members);
  const groups = groupsOf(data);
  const fallbacks = fallbackTargets(data, 'fallbacks').find(entry => entry.from === name)?.to ?? [];
  const target = FALLBACK_MAPS.some(map => fallbackTargets(data, map.key).some(entry => entry.to.includes(name)));
  const picks = members.length === 1 ? null : ordered ? 'order tiers' : metric ? `picks by ${metric}` : 'even split';
  const meta = [`${members.length} deployment${members.length === 1 ? '' : 's'}`, picks, target && 'fallback target'];
  return (
    <div className={styles.card}>
      <div className={styles.groupHead}>
        <span className={styles.groupName}>{name || '(no model_name)'}</span>
        <span className={styles.muted}>{meta.filter(Boolean).join(' · ')}</span>
        <span className={styles.spacer} />
        {fallbacks.some(target => groups.has(target)) && (
          <span className={styles.hopChip}>
            falls back to {fallbacks.filter(target => groups.has(target)).join(', ')}
          </span>
        )}
        {fallbacks
          .filter(target => !groups.has(target))
          .map(target => (
            <span key={target} className={styles.badChip}>
              falls back to {target}
            </span>
          ))}
      </div>
      <div
        className={`${styles.row} ${styles.rowHead} ${members.length === 1 ? styles.rowHeadSingle : ''}`}
        aria-hidden="true">
        <span>id</span>
        <span>model</span>
        <span>weight · share</span>
        <span>order</span>
        <span>rpm</span>
        <span>tpm</span>
        <span>behaviour</span>
        <span />
      </div>
      {members.map(({entry, index}) => {
        const id = deploymentValue(entry, 'id') ?? info?.deployments?.[index]?.id;
        const shown = id == null ? `deployment ${index + 1}` : String(id);
        const rowIssues = issues.filter(issue => issue.index === index && issue.field);
        return (
          <DeploymentRow
            key={index}
            entry={entry}
            index={index}
            shown={shown}
            share={split[index]}
            metric={metric}
            single={members.length === 1}
            skipped={rowIssues.some(issue => issue.field === 'order')}
            issues={rowIssues}
            profile={id == null ? null : profiles[shown]}
            open={openRow === shown}
            timeout={data?.router_settings?.timeout ?? data?.litellm_settings?.request_timeout}
            actions={actions}
          />
        );
      })}
      <div className={styles.cardFoot}>
        <button type="button" className={styles.ghost} onClick={() => actions.add(name)}>
          + Add deployment to {name}
        </button>
      </div>
    </div>
  );
}

function Setting({name, children, note}) {
  return (
    <div className={styles.setting}>
      <span className={styles.key}>{name}</span>
      <span className={styles.settingValue}>
        {children}
        {note && <span className={styles.muted}>{note}</span>}
      </span>
    </div>
  );
}

function SettingsColumn({data, info, issues, error, actions}) {
  const value = key => settingValue(data, key);
  const effective = info?.settings ?? {};
  const strategy = value('routing_strategy') ?? 'simple-shuffle';
  const strategyIssue = issues.find(issue => issue.setting === 'routing_strategy');
  const policy = value('retry_policy');
  const groups = groupsOf(data);
  const seconds = (key, fallback) => `${effective[key] ?? fallback} s`;
  return (
    <div className={styles.settings}>
      <span className={styles.cap}>Router settings · router_settings</span>
      <div className={styles.card}>
        <span className={styles.cardTitle}>Strategy</span>
        <div className={styles.chips}>
          <button
            type="button"
            className={strategy === 'simple-shuffle' ? styles.chipOn : styles.chip}
            aria-pressed={strategy === 'simple-shuffle'}
            onClick={() => strategy !== 'simple-shuffle' && actions.setting('routing_strategy', 'simple-shuffle')}>
            simple-shuffle
          </button>
          {PYTHON_STRATEGIES.map(name => (
            <button
              key={name}
              type="button"
              disabled
              className={strategy === name ? styles.chipRefused : styles.chipOff}
              title="runs in Python">
              {name}
            </button>
          ))}
        </div>
        <span className={styles.hint}>
          Greyed strategies still run in Python, so the playground does not offer them yet.
        </span>
        {strategyIssue && <Issue issue={strategyIssue} />}
      </div>

      <div className={styles.card}>
        <span className={styles.cardTitle}>Retries</span>
        <Setting name="num_retries">
          <NumInput
            label="num_retries"
            value={value('num_retries')}
            placeholder={fmt(effective.num_retries ?? 0)}
            onCommit={next => actions.setting('num_retries', next)}
          />
        </Setting>
        <Setting name="retry_after">
          <NumInput
            label="retry_after"
            value={value('retry_after')}
            placeholder={seconds('retry_after', 0)}
            onCommit={next => actions.setting('retry_after', next)}
          />
        </Setting>
        <Setting name="retry_policy" note={policy ? 'retries per error kind' : 'per error kind, off'}>
          <Toggle
            label="retry_policy"
            on={!!policy}
            onChange={on =>
              actions.setting(
                'retry_policy',
                on ? {RateLimitErrorRetries: Number(value('num_retries') ?? effective.num_retries ?? 0)} : undefined,
              )
            }
          />
        </Setting>
        {policy && typeof policy === 'object' && (
          <div className={styles.policy}>
            {RETRY_KINDS.map(kind => (
              <label key={kind} className={styles.policyRow}>
                <span className={styles.key}>{kind.replace(/Retries$/, '')}</span>
                <NumInput
                  label={kind}
                  value={policy[kind]}
                  placeholder="num_retries"
                  onCommit={next => actions.setting('retry_policy', {...policy, [kind]: next})}
                />
              </label>
            ))}
          </div>
        )}
        <Setting name="timeout">
          <NumInput
            label="timeout"
            value={value('timeout')}
            placeholder="none"
            onCommit={next => actions.setting('timeout', next)}
          />
        </Setting>
      </div>

      <div className={styles.card}>
        <span className={`${styles.cardTitle} ${styles.titleWarn}`}>Cooldowns</span>
        <Setting
          name="allowed_fails"
          note={value('allowed_fails') == null ? 'failure ratio per minute' : 'per minute, then a cooldown'}>
          <NumInput
            label="allowed_fails"
            value={value('allowed_fails')}
            placeholder="unset"
            onCommit={next => actions.setting('allowed_fails', next)}
          />
        </Setting>
        <Setting name="cooldown_time">
          <NumInput
            label="cooldown_time"
            value={value('cooldown_time')}
            placeholder={seconds('cooldown_time', 5)}
            onCommit={next => actions.setting('cooldown_time', next)}
          />
        </Setting>
        <Setting name="disable_cooldowns">
          <Toggle
            label="disable_cooldowns"
            on={!!value('disable_cooldowns')}
            onChange={on => actions.setting('disable_cooldowns', on ? true : undefined)}
          />
        </Setting>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={`${styles.cardTitle} ${styles.titleHop}`}>Fallbacks</span>
          <button type="button" className={styles.link} onClick={() => actions.graph('fallbacks')}>
            edit as graph
          </button>
        </div>
        {FALLBACK_MAPS.map(map => {
          const entries = fallbackTargets(data, map.key);
          const mapIssues = issues.filter(issue => issue.map === map.key);
          return (
            <div key={map.key}>
              <div className={styles.mapRow}>
                <button type="button" className={styles.mapLabel} onClick={() => actions.graph(map.key)}>
                  {map.label}
                </button>
                {entries.length === 0 && <span className={styles.muted}>none</span>}
                {entries.map(entry => {
                  const good = entry.to.filter(target => groups.has(target));
                  const from = entry.from === '*' ? 'any' : entry.from;
                  return (
                    <React.Fragment key={entry.from}>
                      {good.length > 0 && (
                        <span className={styles.hopChip}>
                          {from} → {good.join(', ')}
                        </span>
                      )}
                      {entry.to
                        .filter(target => !groups.has(target))
                        .map(target => (
                          <span key={target} className={styles.badChip}>
                            {from} → {target}
                          </span>
                        ))}
                    </React.Fragment>
                  );
                })}
              </div>
              {mapIssues.map(issue => (
                <Issue key={issue.from} issue={issue} />
              ))}
            </div>
          );
        })}
        <Setting name="max_fallbacks">
          <NumInput
            label="max_fallbacks"
            value={value('max_fallbacks')}
            placeholder={fmt(effective.max_fallbacks ?? 5)}
            onCommit={next => actions.setting('max_fallbacks', next)}
          />
        </Setting>
      </div>
    </div>
  );
}

function AddDrawer({start, data, onCancel, onAdd}) {
  const groups = [...groupsOf(data).keys()].filter(Boolean);
  const [form, setForm] = useState(() => {
    const group = start.group ?? '';
    const taken = new Set((data.model_list ?? []).map(entry => String(deploymentValue(entry, 'id'))));
    let n = (groupsOf(data).get(group)?.length ?? 0) + 1;
    while (taken.has(`${group || 'deployment'}-${n}`)) n += 1;
    return {
      group,
      id: group ? `${group}-${n}` : '',
      model: '',
      order: '',
      weight: '',
      rpm: '',
      tpm: '',
      tags: '',
      answer: 'healthy',
      reply: '',
    };
  });
  const set = (key, value) => setForm(previous => ({...previous, [key]: value}));
  const siblings = groupsOf(data).get(form.group) ?? [];
  const orderedSiblings = siblings.filter(member => deploymentValue(member.entry, 'order') != null);
  const needsOrder = orderedSiblings.length > 0 && form.order === '';
  const nextOrder =
    Math.max(0, ...orderedSiblings.map(member => Number(deploymentValue(member.entry, 'order')) || 0)) + 1;
  const duplicate = (data.model_list ?? []).some(entry => String(deploymentValue(entry, 'id')) === form.id.trim());
  const ready = form.group.trim() && form.id.trim() && form.model.trim() && !duplicate;
  const numbers = ['order', 'weight', 'rpm', 'tpm'];

  useEffect(() => {
    const close = event => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onCancel]);

  const submit = event => {
    event.preventDefault();
    if (!ready) return;
    const params = {model: form.model.trim()};
    for (const key of numbers) if (form[key].trim() !== '') params[key] = Number(form[key]);
    const tags = form.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    if (tags.length) params.tags = tags;
    if (form.answer === 'reply') params.mock_response = form.reply || 'hi';
    const entry = {model_name: form.group.trim(), litellm_params: params, model_info: {id: form.id.trim()}};
    const profile = form.answer === 'reply' ? null : {preset: form.answer, ...PROFILE_PRESETS[form.answer]};
    if (profile) delete profile.label;
    onAdd(entry, profile);
  };

  const field = (label, key, yamlKey, extra = {}) => (
    <label className={styles.field}>
      {label}
      <input
        className={`${styles.input} ${extra.className ?? ''}`}
        value={form[key]}
        placeholder={extra.placeholder ?? 'none'}
        inputMode={numbers.includes(key) ? 'decimal' : undefined}
        list={extra.list}
        onChange={event => set(key, event.target.value)}
      />
      {yamlKey && <small>{yamlKey}</small>}
    </label>
  );

  return (
    <div className={styles.scrim} onMouseDown={event => event.target === event.currentTarget && onCancel()}>
      <form className={styles.drawer} onSubmit={submit} aria-label="Add deployment">
        <span className={styles.cap}>
          {start.newGroup ? 'Add model group' : 'Add deployment'}
          {form.group ? ` · ${form.group}` : ''}
        </span>
        <div className={styles.fields2}>
          {start.newGroup ? (
            field('model group', 'group', 'model_name', {placeholder: 'gpt-4o-mini'})
          ) : (
            <label className={styles.field}>
              model group
              <select className={styles.input} value={form.group} onChange={event => set('group', event.target.value)}>
                {groups.map(name => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <small>model_name</small>
            </label>
          )}
          {field('id', 'id', 'model_info.id', {className: duplicate ? styles.inputErr : ''})}
        </div>
        {duplicate && <span className={styles.fieldErr}>Another deployment already uses this id.</span>}
        {field('provider model', 'model', 'litellm_params.model', {placeholder: 'openai/gpt-4o-mini'})}
        <div className={styles.fields4}>
          {field('order', 'order', null, {className: needsOrder ? styles.inputWarn : ''})}
          {field('weight', 'weight')}
          {field('rpm', 'rpm')}
          {field('tpm', 'tpm')}
        </div>
        {needsOrder && (
          <div className={styles.warn}>
            <b>!</b>
            <span>
              Other deployments in {form.group} set <code>order</code>. Without one, this deployment is skipped while
              any of them is healthy.{' '}
              <button type="button" className={styles.link} onClick={() => set('order', String(nextOrder))}>
                Set order {nextOrder}
              </button>
            </span>
          </div>
        )}
        {field('tags', 'tags', 'only matter when a request filters by tag', {placeholder: 'none, comma separated'})}
        <div className={styles.answers}>
          <span className={styles.cap}>How it answers in the playground</span>
          <div className={styles.chips}>
            {Object.entries(PROFILE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.answer === key}
                className={form.answer === key ? styles.chipOn : styles.chip}
                onClick={() => set('answer', key)}>
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={form.answer === 'reply'}
              className={form.answer === 'reply' ? styles.chipOn : styles.chip}
              onClick={() => set('answer', 'reply')}>
              Fixed reply (mock_response)
            </button>
          </div>
          {form.answer === 'reply' &&
            field('reply', 'reply', 'litellm_params.mock_response', {placeholder: 'hi, or an exception name'})}
          <span className={styles.hint}>
            A fixed reply writes mock_response into the YAML; a profile lives beside it in the playground and is not
            part of the proxy config.
          </span>
        </div>
        <div className={styles.drawerFoot}>
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={!ready}>
            {start.newGroup ? 'Add model group' : 'Add deployment'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ConfigEditor({
  text,
  onChange,
  info,
  error,
  profiles = {},
  onProfilesChange = () => {},
  focus = null,
}) {
  const [mode, setMode] = useState('form');
  const [graphMap, setGraphMap] = useState('fallbacks');
  const [edited, setEdited] = useState([]);
  const [openRow, setOpenRow] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [showKept, setShowKept] = useState(false);
  const parsed = useMemo(() => parseYaml(text), [text]);
  const {data} = parsed;
  const issues = useMemo(() => validate(data), [data]);
  const kept = useMemo(() => (parsed.error ? [] : keptKeys(parsed.doc, parsed.lineCounter)), [parsed]);
  const typed = useRef(false);
  const root = useRef(null);

  // A lane elsewhere on the page asked to edit one deployment's behaviour: open its row.
  useEffect(() => {
    if (!focus?.id) return;
    setMode('form');
    setOpenRow(focus.id);
    // Wait for the config pane to unfold, since a folded pane cannot scroll to its rows.
    const timer = setTimeout(() => {
      const row = root.current?.querySelector(`[data-row="${CSS.escape(focus.id)}"]`);
      (row ?? root.current)?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 100);
    return () => clearTimeout(timer);
  }, [focus]);
  const view = parsed.error ? 'yaml' : mode;

  const patch = next => {
    if (next === text) return;
    setEdited(changedLines(text, next));
    onChange(next);
  };

  const marks = {};
  for (const item of kept) for (const line of item.lines) marks[line] = 'kept';
  for (const line of edited) marks[line] = 'edit';
  if (parsed.error) marks[parsed.error.line] = 'err';

  const idAt = index => {
    const entry = data?.model_list?.[index];
    const id = deploymentValue(entry, 'id') ?? info?.deployments?.[index]?.id;
    return id == null ? null : String(id);
  };

  const actions = {
    field: (index, field, value) => {
      const entry = data.model_list[index];
      if (field === 'id') {
        const before = idAt(index);
        if (before != null && profiles[before] && value != null) {
          const next = {...profiles, [value]: profiles[before]};
          delete next[before];
          onProfilesChange(next);
        }
      }
      patch(setIn(text, deploymentPath(entry, index, field), value));
    },
    remove: index => {
      const id = idAt(index);
      if (id != null && profiles[id]) {
        const next = {...profiles};
        delete next[id];
        onProfilesChange(next);
      }
      setOpenRow(null);
      patch(setIn(text, ['model_list', index], undefined));
    },
    toggle: key => setOpenRow(openRow === key ? null : key),
    profile: (id, profile) => {
      const next = {...profiles};
      if (profile) next[id] = profile;
      else delete next[id];
      onProfilesChange(next);
    },
    add: group => setDrawer({group}),
    setting: (key, value) => patch(setSetting(text, data, key, value)),
    graph: key => {
      setGraphMap(key);
      setMode('graph');
    },
  };

  const addEntry = (entry, profile) => {
    patch(appendIn(text, ['model_list'], entry));
    if (profile) onProfilesChange({...profiles, [entry.model_info.id]: profile});
    setDrawer(null);
  };

  const groups = data ? groupsOf(data) : new Map();
  const showError = error && !parsed.error && !(view !== 'yaml' && issues.some(issue => issue.setting));

  return (
    <div className={styles.root} ref={root}>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="tablist" aria-label="Config view">
          <button
            type="button"
            role="tab"
            aria-selected={view !== 'yaml'}
            disabled={!!parsed.error}
            title={parsed.error ? 'Fix the YAML to switch back to the form' : undefined}
            onClick={() => setMode('form')}>
            Form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'yaml'}
            onClick={() => {
              typed.current = false;
              setMode('yaml');
            }}>
            YAML
          </button>
        </div>
        {view === 'graph' && (
          <button type="button" className={styles.link} onClick={() => setMode('form')}>
            back to the form
          </button>
        )}
        <span className={styles.spacer} />
        {kept.length > 0 && (
          <button
            type="button"
            className={styles.keptChip}
            aria-expanded={showKept}
            onClick={() => setShowKept(!showKept)}>
            {kept.length} key{kept.length === 1 ? '' : 's'} kept as written
          </button>
        )}
      </div>

      {showKept && kept.length > 0 && (
        <div className={styles.keptList}>
          {kept.map(item => (
            <span key={item.label} className={styles.keptChip}>
              {item.label}: {item.value} · kept as written
            </span>
          ))}
          <span className={styles.hint}>
            The form lists these and leaves them as written. The playground ignores what the router core does not read,
            such as Redis, callbacks and keys.
          </span>
        </div>
      )}

      {showError && <p className={styles.configError}>{error}</p>}

      {view === 'yaml' && (
        <YamlView
          text={text}
          error={parsed.error}
          marks={marks}
          onChange={next => {
            if (!typed.current) setEdited([]);
            typed.current = true;
            onChange(next);
          }}
        />
      )}

      {view === 'graph' && (
        <FallbackGraph
          data={data}
          map={graphMap}
          onMap={setGraphMap}
          issues={issues}
          onTargets={(key, from, targets) => patch(setFallbacks(text, data, key, from, targets))}
        />
      )}

      {view === 'form' && (
        <div className={styles.form}>
          <div className={styles.groups}>
            <span className={styles.cap}>Model groups · model_list</span>
            {[...groups.entries()].map(([name, members]) => (
              <GroupCard
                key={name}
                name={name}
                members={members}
                info={info}
                data={data}
                issues={issues.filter(issue => issue.index != null && members.some(m => m.index === issue.index))}
                profiles={profiles}
                openRow={openRow}
                actions={actions}
              />
            ))}
            <div className={styles.addGroup}>
              <button type="button" className={styles.ghost} onClick={() => setDrawer({group: '', newGroup: true})}>
                + Add model group
              </button>
              <span className={styles.hint}>
                weights fill in from rpm, then tpm, when no deployment in the group sets one, matching simple-shuffle
              </span>
            </div>
          </div>
          <SettingsColumn data={data} info={info} issues={issues} error={error} actions={actions} />
        </div>
      )}

      {drawer && data && <AddDrawer start={drawer} data={data} onCancel={() => setDrawer(null)} onAdd={addEntry} />}
    </div>
  );
}
