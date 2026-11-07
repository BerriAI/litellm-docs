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
  settingPaths,
  settingValue,
} from './configDoc';
import ConfigModal from './ConfigModal';
import {Overridden, TEAM_APPLIED, ViewAs, teamColour, teamFallbacks, teamLens, teamsOf} from './ConfigTeams';
import FallbackGraph from './FallbackGraph';
import ProfileEditor from './ProfileEditor';
import {PROFILE_PRESETS, profileSummary} from './profiles';
import {FALLBACK_MAPS, PYTHON_STRATEGIES, fallbackTargets, groupsOf, shares, validate} from './validate';
import {complete} from './yamlComplete';
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

function YamlView({text, onChange, error, marks, completion}) {
  const lines = text.split('\n');
  const area = useRef(null);
  const [menu, setMenu] = useState(null);
  const offer = (next, caret, force) => setMenu(completion ? complete(next, caret, completion, force) : null);
  const accept = item => {
    const next = text.slice(0, menu.from) + item.insert + text.slice(menu.to);
    const caret = menu.from + item.insert.length;
    setMenu(null);
    onChange(next);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(caret, caret);
    });
  };
  const onKeyDown = event => {
    if (event.key === ' ' && event.ctrlKey) {
      event.preventDefault();
      offer(text, event.currentTarget.selectionStart, true);
      return;
    }
    if (!menu) return;
    const pick = menu.pick ?? 0;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setMenu({...menu, pick: (pick + step + menu.items.length) % menu.items.length});
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      accept(menu.items[pick]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(null);
    }
  };
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
            ref={area}
            className={styles.textarea}
            spellCheck={false}
            wrap="off"
            value={text}
            style={{height: lines.length * 20 + 16, width: `max(100%, calc(${width}ch + 28px))`}}
            onChange={event => {
              onChange(event.target.value);
              offer(event.target.value, event.target.selectionStart, false);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setMenu(null), 150)}
            onClick={() => setMenu(null)}
            aria-label="Router config as YAML"
            aria-autocomplete="list"
          />
          {menu && (
            <ul
              className={styles.complete}
              role="listbox"
              style={{top: 8 + (menu.row + 1) * 20, left: `${menu.column}ch`}}>
              {menu.items.map((item, i) => (
                <li
                  key={item.label}
                  role="option"
                  aria-selected={i === (menu.pick ?? 0)}
                  className={i === (menu.pick ?? 0) ? styles.completeOn : undefined}
                  onMouseDown={event => {
                    event.preventDefault();
                    accept(item);
                  }}>
                  <span>{item.label}</span>
                  {item.detail && <small>{item.detail}</small>}
                </li>
              ))}
            </ul>
          )}
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

// A text input that keeps what is typed while focused, for values the YAML stores differently.
function DraftInput({value, onCommit, className, ...rest}) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      {...rest}
      className={className ?? styles.input}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={event => {
        setDraft(event.target.value);
        onCommit(event.target.value);
      }}
    />
  );
}

function Field({label, yamlKey, children}) {
  return (
    <label className={styles.field}>
      {label}
      {children}
      {yamlKey && <small>{yamlKey}</small>}
    </label>
  );
}

const worst = issues =>
  issues.some(issue => issue.level === 'err') ? 'err' : issues.some(issue => issue.level === 'warn') ? 'warn' : null;

const behaviourLabel = (profile, params) =>
  profile
    ? (PROFILE_PRESETS[profile.preset]?.label ?? 'Custom')
    : params.mock_response != null
      ? 'Fixed reply'
      : 'Healthy';

function SplitBar({share, skipped}) {
  if (skipped) return <span className={styles.skipped}>skipped</span>;
  const pct = share == null ? null : Math.round(share * 100);
  return (
    <span className={styles.weight}>
      <span className={styles.bar}>
        <span style={{width: `${pct ?? 0}%`}} />
      </span>
      <span className={styles.pct}>{pct == null ? '' : `${pct}%`}</span>
    </span>
  );
}

function DeploymentPill({member, issues, share, single, actions, team, teamSplit}) {
  const {entry, index, shown, lens} = member;
  const model = entry.litellm_params?.model;
  const level = worst(issues);
  const skipped = issues.some(issue => issue.field === 'order');
  const pct = share == null || single || skipped ? null : `${Math.round(share * 100)}%`;
  const count = `${issues.length} issue${issues.length === 1 ? '' : 's'}`;
  const teamNote =
    lens === 'own'
      ? `serves ${team} instead of the shared deployments`
      : lens === 'unused'
        ? `${team} uses its own deployment instead`
        : null;
  const note = [teamNote, pct && `${pct} of traffic`, skipped && 'skipped', issues.length && count];
  const lensClass = lens === 'own' || teamSplit ? styles.pillTeam : lens === 'unused' ? styles.pillUnused : '';
  return (
    <button
      type="button"
      data-row={shown}
      className={`${styles.pill} ${skipped ? styles.pillSkipped : ''} ${lensClass}`}
      title={note.filter(Boolean).join(' · ') || undefined}
      aria-label={`Deployment settings for ${shown}${level ? `, ${count}` : ''}`}
      onClick={() => actions.openDeployment(index)}>
      {level && <i className={level === 'err' ? styles.dotErr : styles.dotWarn} aria-hidden="true" />}
      <b>{shown}</b>
      <span className={model ? styles.pillModel : styles.pillMissing}>{model || 'no model'}</span>
      {lens === 'own' && <span className={styles.teamTag}>{team} only</span>}
      {teamSplit && lens !== 'unused' && <span className={styles.teamTag}>{Math.round(share * 100)}%</span>}
    </button>
  );
}

function GroupCard({name, members, data, issues, actions, team, lens}) {
  const used = lens ? members.filter(member => member.lens !== 'unused') : members;
  const base = shares(used);
  const split = lens?.split ?? base.shares;
  const {metric, ordered} = base;
  const groups = groupsOf(data);
  const {to: fallbacks, router: routerFallbacks} = teamFallbacks(data, team, 'fallbacks', name);
  const picks = lens?.split
    ? `split by ${team.id}'s weights`
    : used.length === 1
      ? null
      : ordered
        ? 'order tiers'
        : metric
          ? `split by ${metric}`
          : 'even split';
  const scope = teamOf(members);
  const owned = lens && used.some(member => member.lens === 'own');
  const meta = [
    `${used.length} deployment${used.length === 1 ? '' : 's'}`,
    owned ? `${team.id}'s own deployment` : picks,
    !lens && scope && `team ${scope.team}`,
  ];
  const good = fallbacks.filter(target => groups.has(target));
  const fallbackChanged = routerFallbacks != null && routerFallbacks.join() !== fallbacks.join();
  return (
    <div className={styles.card}>
      <div className={styles.groupHead}>
        <span className={styles.groupName}>{name || '(no model_name)'}</span>
        <span className={styles.muted}>{meta.filter(Boolean).join(' · ')}</span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.settingsButton}
          aria-label={`Model group settings for ${name || 'unnamed group'}`}
          onClick={() => actions.openGroup(name)}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10.5" cy="4.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5.5" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Settings
        </button>
      </div>
      <div className={styles.pills}>
        {members.map(member => (
          <DeploymentPill
            key={member.index}
            member={member}
            issues={issues.filter(issue => issue.index === member.index && issue.field)}
            share={split[member.index]}
            single={used.length === 1}
            actions={actions}
            team={team?.id}
            teamSplit={!!lens?.split}
          />
        ))}
        <button
          type="button"
          className={styles.pillAdd}
          aria-label={`Add deployment to ${name}`}
          title={`Add deployment to ${name}`}
          onClick={() => actions.add(name)}>
          + Add
        </button>
      </div>
      {(good.length > 0 || fallbacks.length > good.length || fallbackChanged || lens?.alias.length > 0) && (
        <div className={styles.groupFoot}>
          {lens?.alias.map(alias => (
            <span key={alias} className={styles.teamChip}>
              alias {alias}
            </span>
          ))}
          {good.length > 0 && (
            <span className={fallbackChanged ? styles.teamChip : styles.hopChip}>falls back to {good.join(', ')}</span>
          )}
          {fallbackChanged && fallbacks.length === 0 && (
            <span className={styles.teamChip}>no fallback for {team.id}</span>
          )}
          {fallbackChanged && routerFallbacks.length > 0 && (
            <s className={styles.routerValue}>{routerFallbacks.join(', ')}</s>
          )}
          {fallbacks
            .filter(target => !groups.has(target))
            .map(target => (
              <span key={target} className={styles.badChip}>
                falls back to {target}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function teamOf(members) {
  const scoped = ({entry}) => entry?.model_info?.team_id && entry?.model_info?.team_public_model_name;
  const all = members.length && members.every(scoped);
  if (!all) return null;
  const info = members[0].entry.model_info;
  return {team: String(info.team_id), name: String(info.team_public_model_name)};
}

function DeploymentSettings({member, members, data, issues, profile, timeout, actions, onClose}) {
  const {entry, index, shown} = member;
  const params = entry.litellm_params ?? {};
  const modelInfo = entry.model_info ?? {};
  const {shares: split, metric} = shares(members);
  const rowIssues = issues.filter(issue => issue.index === index && issue.field);
  const skipped = rowIssues.some(issue => issue.field === 'order');
  const issueFor = field => rowIssues.some(issue => issue.field === field);
  const tags = Array.isArray(params.tags) ? params.tags.join(', ') : fmt(params.tags);
  const group = entry.model_name == null ? '' : String(entry.model_name);
  const num = (label, field, yamlKey, placeholder = 'none') => (
    <Field label={label} yamlKey={yamlKey}>
      <NumInput
        label={label}
        value={field === 'cooldown_time' ? modelInfo.cooldown_time : deploymentValue(entry, field)}
        placeholder={placeholder}
        invalid={issueFor(field)}
        onCommit={value =>
          field === 'cooldown_time'
            ? actions.path(['model_list', index, 'model_info', 'cooldown_time'], value)
            : actions.field(index, field, value)
        }
      />
    </Field>
  );
  return (
    <ConfigModal
      cap="Deployment settings"
      title={shown}
      sub={`in model group ${group || '(no model_name)'}`}
      label={`Deployment settings for ${shown}`}
      onClose={onClose}
      foot={
        <>
          <button type="button" className={styles.danger} onClick={() => actions.remove(index)}>
            Delete deployment
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.primary} onClick={onClose}>
            Done
          </button>
        </>
      }>
      {rowIssues.map(issue => (
        <Issue key={`${issue.field}-${issue.message}`} issue={issue}>
          {issue.field === 'order' && (
            <button type="button" className={styles.link} onClick={() => actions.field(index, 'order', issue.next)}>
              Set order {issue.next}
            </button>
          )}
        </Issue>
      ))}

      <div className={styles.fields2}>
        <Field label="id" yamlKey="model_info.id">
          <input
            className={`${styles.input} ${issueFor('id') ? styles.inputErr : ''}`}
            value={fmt(deploymentValue(entry, 'id'))}
            placeholder={shown ?? 'generated'}
            onChange={event => actions.field(index, 'id', event.target.value || undefined)}
          />
        </Field>
        <Field label="provider model" yamlKey="litellm_params.model">
          <input
            className={`${styles.input} ${issueFor('model') ? styles.inputErr : ''}`}
            value={fmt(params.model)}
            placeholder="openai/gpt-4o-mini"
            onChange={event => actions.field(index, 'model', event.target.value)}
          />
        </Field>
      </div>

      <div className={styles.modalSection}>
        <div className={styles.sectionHead}>
          <span className={styles.cap}>Load balancing</span>
          {members.length > 1 && (
            <span className={styles.sectionSplit}>
              <span className={styles.muted}>
                {skipped ? 'gets no traffic' : `share of ${group}${metric ? `, by ${metric}` : ''}`}
              </span>
              <SplitBar share={split[index]} skipped={skipped} />
            </span>
          )}
        </div>
        <div className={styles.fields4}>
          {num('weight', 'weight', null)}
          {num('order', 'order', null)}
          {num('rpm', 'rpm', null)}
          {num('tpm', 'tpm', null)}
        </div>
      </div>

      <div className={styles.modalSection}>
        <span className={styles.cap}>Limits</span>
        <div className={styles.fields2}>
          {num('timeout', 'timeout', 'litellm_params.timeout', timeout == null ? 'none' : `${timeout} s, router`)}
          {num('cooldown_time', 'cooldown_time', 'model_info.cooldown_time', 'router default')}
        </div>
        <Field label="tags" yamlKey="only matter when a request filters by tag">
          <DraftInput
            value={tags}
            placeholder="none, comma separated"
            onCommit={raw => {
              const list = raw
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
              actions.field(index, 'tags', list.length ? list : undefined);
            }}
          />
        </Field>
        {modelInfo.team_id != null && (
          <span className={styles.hint}>
            Serves team <code>{String(modelInfo.team_id)}</code>
            {modelInfo.team_public_model_name != null && (
              <>
                {' '}
                when it asks for <code>{String(modelInfo.team_public_model_name)}</code>
              </>
            )}
            , and nobody else. Edit it in the YAML view.
          </span>
        )}
      </div>

      <div className={styles.modalSection}>
        <div className={styles.sectionHead}>
          <span className={styles.cap}>In the simulator</span>
          <span className={styles.mono}>{profile ? profileSummary(profile) : 'no profile, answers at once'}</span>
        </div>
        <ProfileEditor
          value={profile}
          compact
          timeout={params.timeout ?? timeout}
          onChange={next => actions.profile(shown, next)}
        />
        <Field label="mock_response" yamlKey="litellm_params.mock_response, a fixed reply or an exception name">
          <input
            className={styles.input}
            value={typeof params.mock_response === 'string' ? params.mock_response : fmt(params.mock_response)}
            placeholder="none"
            onChange={event => actions.field(index, 'mock_response', event.target.value || undefined)}
          />
        </Field>
      </div>
    </ConfigModal>
  );
}

function GroupSettings({name, members, data, issues, profiles, actions, onClose}) {
  const groups = groupsOf(data);
  const others = [...groups.keys()].filter(group => group && group !== name);
  const {shares: split, metric, ordered} = shares(members);
  const team = teamOf(members);
  const [draftName, setDraftName] = useState(name);
  const sources = FALLBACK_MAPS.filter(map => map.key !== 'default_fallbacks')
    .flatMap(map => fallbackTargets(data, map.key).filter(entry => entry.to.includes(name) && entry.from !== name))
    .map(entry => (entry.from === '*' ? 'any' : entry.from));
  const defaults = fallbackTargets(data, 'default_fallbacks')[0]?.to ?? [];
  const aliasMap = settingValue(data, 'model_group_alias');
  const aliases =
    aliasMap && typeof aliasMap === 'object'
      ? Object.entries(aliasMap)
          .filter(([, target]) => (typeof target === 'string' ? target : target?.model) === name)
          .map(([alias]) => alias)
      : [];
  const rename = () => {
    const next = draftName.trim();
    if (next && next !== name) actions.renameGroup(name, next, members);
    else setDraftName(name);
  };
  const how =
    members.length === 1
      ? 'One deployment takes every request.'
      : ordered
        ? 'The lowest order tier with a healthy deployment takes the traffic, split by weight inside the tier.'
        : metric
          ? `simple-shuffle splits requests by ${metric}.`
          : 'simple-shuffle splits requests evenly, since no deployment sets weight, rpm or tpm.';
  return (
    <ConfigModal
      cap="Model group settings"
      title={name || '(no model_name)'}
      sub={[`${members.length} deployment${members.length === 1 ? '' : 's'}`, team && `team ${team.team}`]
        .filter(Boolean)
        .join(' · ')}
      label={`Model group settings for ${name}`}
      onClose={onClose}
      foot={
        <>
          <button type="button" className={styles.danger} onClick={() => actions.removeGroup(members)}>
            Delete group
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.primary} onClick={onClose}>
            Done
          </button>
        </>
      }>
      <Field label="name" yamlKey="model_name on every deployment in the group">
        <input
          className={styles.input}
          value={draftName}
          onChange={event => setDraftName(event.target.value)}
          onBlur={rename}
          onKeyDown={event => event.key === 'Enter' && (event.preventDefault(), rename())}
        />
      </Field>

      <div className={styles.modalSection}>
        <span className={styles.cap}>Deployments</span>
        <span className={styles.hint}>{how}</span>
        <div className={styles.splitList}>
          {members.map(member => {
            const skipped = issues.some(issue => issue.index === member.index && issue.field === 'order');
            const level = worst(issues.filter(issue => issue.index === member.index && issue.field));
            return (
              <button
                key={member.index}
                type="button"
                className={styles.splitRow}
                onClick={() => actions.openDeployment(member.index)}>
                <span className={styles.splitName}>
                  {level && <i className={level === 'err' ? styles.dotErr : styles.dotWarn} aria-hidden="true" />}
                  <b>{member.shown}</b>
                  <span className={styles.muted}>
                    {behaviourLabel(profiles[member.shown], member.entry.litellm_params ?? {})}
                  </span>
                </span>
                {members.length > 1 ? <SplitBar share={split[member.index]} skipped={skipped} /> : <span />}
                <span aria-hidden="true" className={styles.muted}>
                  ›
                </span>
              </button>
            );
          })}
        </div>
        <div>
          <button type="button" className={styles.ghost} onClick={() => actions.add(name)}>
            + Add deployment to {name}
          </button>
        </div>
      </div>

      <div className={styles.modalSection}>
        <div className={styles.sectionHead}>
          <span className={`${styles.cap} ${styles.titleHop}`}>Fallbacks</span>
          <button type="button" className={styles.link} onClick={() => actions.graph('fallbacks')}>
            edit as graph
          </button>
        </div>
        {FALLBACK_MAPS.filter(map => map.key !== 'default_fallbacks').map(map => {
          const targets = fallbackTargets(data, map.key).find(entry => entry.from === name)?.to ?? [];
          const set = next => actions.fallbacks(map.key, name, next);
          return (
            <div key={map.key} className={styles.mapRow}>
              <span className={styles.mapLabel}>{map.label}</span>
              {targets.map((target, i) => (
                <span key={target} className={groups.has(target) ? styles.hopChip : styles.badChip}>
                  {i + 1}. {target}
                  <button
                    type="button"
                    className={styles.chipX}
                    aria-label={`Remove ${target} from ${map.label} fallbacks`}
                    onClick={() => set(targets.filter(item => item !== target))}>
                    ×
                  </button>
                </span>
              ))}
              {others.some(group => !targets.includes(group)) && (
                <select
                  className={styles.addTarget}
                  value=""
                  aria-label={`Add a ${map.label} fallback for ${name}`}
                  onChange={event => event.target.value && set([...targets, event.target.value])}>
                  <option value="">+ add</option>
                  {others
                    .filter(group => !targets.includes(group))
                    .map(group => (
                      <option key={group}>{group}</option>
                    ))}
                </select>
              )}
            </div>
          );
        })}
        {(sources.length > 0 || defaults.length > 0) && (
          <span className={styles.hint}>
            {sources.length > 0 && <>Fallback target of {[...new Set(sources)].join(', ')}. </>}
            {defaults.length > 0 && <>default_fallbacks for every group: {defaults.join(', ')}.</>}
          </span>
        )}
      </div>

      {aliases.length > 0 && (
        <div className={styles.modalSection}>
          <span className={styles.cap}>Aliases</span>
          <div className={styles.chips}>
            {aliases.map(alias => (
              <span key={alias} className={styles.chip}>
                {alias} → {name}
              </span>
            ))}
          </div>
          <span className={styles.hint}>From model_group_alias. Edit them in the YAML view.</span>
        </div>
      )}
    </ConfigModal>
  );
}

const MORE_KEYS = ['retry_after', 'retry_policy', 'disable_cooldowns', 'max_fallbacks'];

function SettingsColumn({data, info, issues, actions, team}) {
  const [more, setMore] = useState(false);
  const value = key => settingValue(data, key);
  const effective = info?.settings ?? {};
  const strategy = value('routing_strategy') ?? 'simple-shuffle';
  const strategyIssue = issues.find(issue => issue.setting === 'routing_strategy');
  const fallbackIssues = issues.filter(issue => issue.map);
  const policy = value('retry_policy');
  const groups = groupsOf(data);
  const seconds = (key, fallback) => `${effective[key] ?? fallback} s`;
  const teams = (Array.isArray(data?.teams) ? data.teams : [])
    .filter(team => team && typeof team === 'object' && team.team_id != null)
    .map(team => ({
      id: String(team.team_id),
      keys: team.router_settings && typeof team.router_settings === 'object' ? Object.keys(team.router_settings) : [],
    }));
  const rules = FALLBACK_MAPS.flatMap(map =>
    fallbackTargets(data, map.key).map(entry => ({...entry, map, from: entry.from === '*' ? 'any' : entry.from})),
  );
  const extra = MORE_KEYS.filter(key => value(key) != null).length;
  const set = team?.settings ?? {};
  const teamRules = team
    ? ['fallbacks', 'context_window_fallbacks', 'content_policy_fallbacks'].reduce(
        (count, key) =>
          count + (set[key] == null ? rules.filter(rule => rule.map.key === key).length : fallbackTargets({router_settings: set}, key).length),
        0,
      )
    : null;
  const fallbacksChanged = team && ['fallbacks', 'context_window_fallbacks', 'content_policy_fallbacks'].some(key => set[key] != null);
  const ignored = team ? Object.keys(set).filter(key => !TEAM_APPLIED.includes(key)) : [];
  const overrides = team ? Object.keys(set).filter(key => TEAM_APPLIED.includes(key)).length : 0;
  return (
    <div className={styles.settings}>
      <span className={styles.cap}>{team ? `Router settings for ${team.id}` : 'Router settings · router_settings'}</span>
      <div className={styles.card}>
        <Setting name="routing_strategy">
          <select
            className={`${styles.input} ${styles.select}`}
            aria-label="routing_strategy"
            value={strategy}
            onChange={event => actions.setting('routing_strategy', event.target.value)}>
            <option value="simple-shuffle">simple-shuffle</option>
            {PYTHON_STRATEGIES.map(name => (
              <option key={name} value={name} disabled>
                {name} (Python only)
              </option>
            ))}
          </select>
        </Setting>
        {strategyIssue && <Issue issue={strategyIssue} />}
        <Setting name="num_retries">
          {team && set.num_retries != null ? (
            <Overridden value={fmt(set.num_retries)} router={fmt(value('num_retries') ?? effective.num_retries ?? 0)} />
          ) : (
            <NumInput
              label="num_retries"
              value={value('num_retries')}
              placeholder={fmt(effective.num_retries ?? 0)}
              onCommit={next => actions.setting('num_retries', next)}
            />
          )}
        </Setting>
        <Setting name="timeout">
          <NumInput
            label="timeout"
            value={value('timeout')}
            placeholder="none"
            onCommit={next => actions.setting('timeout', next)}
          />
        </Setting>
        <Setting name="allowed_fails">
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
        <Setting name="fallbacks">
          {fallbacksChanged && (
            <Overridden
              value={`${teamRules} rule${teamRules === 1 ? '' : 's'}`}
              router={`${rules.length} rule${rules.length === 1 ? '' : 's'}`}
            />
          )}
          {!fallbacksChanged && rules.length === 0 && <span className={styles.muted}>none</span>}
          {!fallbacksChanged && rules.length > 0 && (
            <span className={fallbackIssues.length ? styles.badChip : styles.hopChip}>
              {rules.length} rule{rules.length === 1 ? '' : 's'}
            </span>
          )}
          {!fallbacksChanged && (
            <button type="button" className={styles.link} onClick={() => actions.graph('fallbacks')}>
              {rules.length ? 'edit' : 'add'}
            </button>
          )}
        </Setting>
        {fallbackIssues.map(issue => (
          <Issue key={`${issue.map}-${issue.from}`} issue={issue} />
        ))}
        {teams.length > 0 && !team && (
          <Setting name="teams">
            <span className={styles.muted}>{teams.map(item => item.id).join(', ')}</span>
          </Setting>
        )}
        {team && (
          <p className={styles.teamNote}>
            {overrides === 0 ? (
              `${team.id} sets nothing the router reads, so its requests get the router's settings.`
            ) : (
              <>
                {team.id} overrides{' '}
                {Object.keys(set)
                  .filter(key => TEAM_APPLIED.includes(key))
                  .map(key => <code key={key}>{key}</code>)
                  .reduce((a, b) => [a, ', ', b])}
                .
              </>
            )}
            {ignored.length > 0 && <> The proxy does not forward {ignored.map(key => <code key={key}>{key}</code>).reduce((a, b) => [a, ', ', b])} from a team, so it changes nothing.</>}{' '}
            <button type="button" className={styles.link} onClick={actions.yaml}>
              Edit in YAML
            </button>
          </p>
        )}

        <button type="button" className={styles.disclosure} aria-expanded={more} onClick={() => setMore(!more)}>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          More settings
          {extra > 0 && <span className={styles.muted}>{extra} set</span>}
        </button>

        {more && (
          <div className={styles.more}>
            <span className={styles.cardTitle}>Retries</span>
            <Setting name="retry_after">
              <NumInput
                label="retry_after"
                value={value('retry_after')}
                placeholder={seconds('retry_after', 0)}
                onCommit={next => actions.setting('retry_after', next)}
              />
            </Setting>
            <Setting name="retry_policy" note={policy ? 'per error kind' : 'per error kind, off'}>
              <Toggle
                label="retry_policy"
                on={!!policy}
                onChange={on =>
                  actions.setting(
                    'retry_policy',
                    on
                      ? {RateLimitErrorRetries: Number(value('num_retries') ?? effective.num_retries ?? 0)}
                      : undefined,
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

            <span className={styles.cardTitle}>Cooldowns</span>
            <Setting name="disable_cooldowns">
              <Toggle
                label="disable_cooldowns"
                on={!!value('disable_cooldowns')}
                onChange={on => actions.setting('disable_cooldowns', on ? true : undefined)}
              />
            </Setting>

            <span className={styles.cardTitle}>Fallbacks</span>
            {FALLBACK_MAPS.map(map => {
              const entries = fallbackTargets(data, map.key);
              return (
                <div key={map.key} className={styles.mapRow}>
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

            {teams.length > 0 && (
              <>
                <span className={styles.cardTitle}>Teams</span>
                {teams.map(item => (
                  <div key={item.id} className={styles.mapRow}>
                    <span className={styles.mapLabel}>{item.id}</span>
                    <span className={styles.muted}>
                      {item.keys.length ? item.keys.join(', ') : 'no router_settings'}
                    </span>
                  </div>
                ))}
                <span className={styles.hint}>
                  <code>teams:</code> stands in for the team records a proxy keeps in its database. A request with
                  that <code>team_id</code> gets the team's router_settings, as the proxy forwards them. Edit them in
                  the YAML view.
                </span>
              </>
            )}
          </div>
        )}
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
  fields = [],
}) {
  const [mode, setMode] = useState('form');
  const [graphMap, setGraphMap] = useState('fallbacks');
  const [edited, setEdited] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [showKept, setShowKept] = useState(false);
  const [viewAs, setViewAs] = useState(null);
  const parsed = useMemo(() => parseYaml(text), [text]);
  const {data} = parsed;
  const issues = useMemo(() => validate(data), [data]);
  const completion = useMemo(
    () => ({settings: fields, groups: data ? [...groupsOf(data).keys()].filter(Boolean) : []}),
    [fields, data],
  );
  const kept = useMemo(() => (parsed.error ? [] : keptKeys(parsed.doc, parsed.lineCounter)), [parsed]);
  const typed = useRef(false);
  const root = useRef(null);

  const idAt = index => {
    const entry = data?.model_list?.[index];
    const id = deploymentValue(entry, 'id') ?? info?.deployments?.[index]?.id;
    return id == null ? null : String(id);
  };
  // Each group's deployments with the name the form shows for them: the id, else the core's, else a position.
  const groups = new Map(
    [...(data ? groupsOf(data) : new Map()).entries()].map(([name, members]) => [
      name,
      members.map(member => ({...member, shown: idAt(member.index) ?? `deployment ${member.index + 1}`})),
    ]),
  );

  // The team picked in "View as", while the YAML still has it. Without a teams: block there is no switch.
  const teams = useMemo(() => teamsOf(data), [data]);
  const teamIndex = teams.findIndex(item => item.id === viewAs);
  const team = teamIndex >= 0 ? teams[teamIndex] : null;
  const lens = team ? teamLens(groups, team) : null;

  // A lane elsewhere on the page asked to edit one deployment: open its settings.
  useEffect(() => {
    if (!focus?.id) return;
    setMode('form');
    const list = data?.model_list ?? [];
    const index = list.findIndex((entry, i) => {
      const id = deploymentValue(entry, 'id') ?? info?.deployments?.[i]?.id;
      return id != null && String(id) === String(focus.id);
    });
    if (index >= 0) setModal({kind: 'deployment', index});
    // Wait for the config pane to unfold, since a folded pane cannot scroll to its pills.
    const timer = setTimeout(() => {
      const row = root.current?.querySelector(`[data-row="${CSS.escape(focus.id)}"]`);
      (row ?? root.current)?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 100);
    return () => clearTimeout(timer);
    // Only a new ask opens the dialog, not every config edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const dropProfiles = indices => {
    const next = {...profiles};
    let changed = false;
    for (const index of indices) {
      const id = idAt(index);
      if (id != null && next[id]) {
        delete next[id];
        changed = true;
      }
    }
    if (changed) onProfilesChange(next);
  };

  const actions = {
    yaml: () => setMode('yaml'),
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
    path: (path, value) => patch(setIn(text, path, value)),
    remove: index => {
      dropProfiles([index]);
      setModal(null);
      patch(setIn(text, ['model_list', index], undefined));
    },
    removeGroup: members => {
      dropProfiles(members.map(member => member.index));
      setModal(null);
      const indices = members.map(member => member.index).sort((a, b) => b - a);
      patch(indices.reduce((next, index) => setIn(next, ['model_list', index], undefined), text));
    },
    // Renames the group on each deployment and wherever a fallback rule names it.
    renameGroup: (from, to, members) => {
      setModal({kind: 'group', name: to});
      let next = members.reduce((acc, member) => setIn(acc, ['model_list', member.index, 'model_name'], to), text);
      for (const map of FALLBACK_MAPS) {
        const now = parseYaml(next).data;
        for (const entry of fallbackTargets(now, map.key)) {
          const targets = entry.to.map(target => (target === from ? to : target));
          if (targets.some((target, i) => target !== entry.to[i])) {
            next = setFallbacks(next, now, map.key, entry.from, targets);
          }
          if (entry.from === from && map.key !== 'default_fallbacks') {
            const path = settingPaths(now, map.key).at(-1);
            next = setIn(next, [...path, entry.index], {[to]: targets});
          }
        }
      }
      patch(next);
    },
    openDeployment: index => setModal({kind: 'deployment', index}),
    openGroup: name => setModal({kind: 'group', name}),
    profile: (id, profile) => {
      const next = {...profiles};
      if (profile) next[id] = profile;
      else delete next[id];
      onProfilesChange(next);
    },
    add: group => {
      setModal(null);
      setDrawer({group});
    },
    setting: (key, value) => patch(setSetting(text, data, key, value)),
    fallbacks: (key, from, targets) => patch(setFallbacks(text, data, key, from, targets)),
    graph: key => {
      setModal(null);
      setGraphMap(key);
      setMode('graph');
    },
  };

  const addEntry = (entry, profile) => {
    patch(appendIn(text, ['model_list'], entry));
    if (profile) onProfilesChange({...profiles, [entry.model_info.id]: profile});
    setDrawer(null);
  };

  const closeModal = () => setModal(null);
  const groupOfIndex = index => [...groups.values()].find(members => members.some(member => member.index === index));
  const modalMembers =
    view !== 'form' || !modal
      ? null
      : modal.kind === 'deployment'
        ? groupOfIndex(modal.index)
        : groups.get(modal.name);
  const modalMember = modal?.kind === 'deployment' ? modalMembers?.find(member => member.index === modal.index) : null;
  const routerTimeout = data?.router_settings?.timeout ?? data?.litellm_settings?.request_timeout;
  const showError = error && !parsed.error && !(view !== 'yaml' && issues.some(issue => issue.setting));

  return (
    <div className={styles.root} ref={root} style={team ? {'--ce-team': teamColour(teamIndex)} : undefined}>
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
        {view === 'form' && teams.length > 0 && <ViewAs teams={teams} value={team?.id ?? null} onChange={setViewAs} />}
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
          completion={completion}
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
            <span className={styles.cap}>{team ? `Model groups as ${team.id} sees them` : 'Model groups · model_list'}</span>
            {(lens ? [...lens.entries()].map(([name, entry]) => [name, entry.members, entry]) : [...groups.entries()]).map(
              ([name, members, entry]) => (
                <GroupCard
                  key={name}
                  name={name}
                  members={members}
                  data={data}
                  issues={issues.filter(issue => issue.index != null && members.some(m => m.index === issue.index))}
                  actions={actions}
                  team={team}
                  lens={entry}
                />
              ),
            )}
            <div className={styles.addGroup}>
              <button type="button" className={styles.ghost} onClick={() => setDrawer({group: '', newGroup: true})}>
                + Add model group
              </button>
            </div>
          </div>
          <SettingsColumn data={data} info={info} issues={issues} actions={actions} team={team} />
        </div>
      )}

      {modalMember && (
        <DeploymentSettings
          key={`d-${modal.index}`}
          member={modalMember}
          members={modalMembers}
          data={data}
          issues={issues}
          profile={profiles[modalMember.shown] ?? null}
          timeout={routerTimeout}
          actions={actions}
          onClose={closeModal}
        />
      )}
      {modal?.kind === 'group' && modalMembers && (
        <GroupSettings
          key={`g-${modal.name}`}
          name={modal.name}
          members={modalMembers}
          data={data}
          issues={issues}
          profiles={profiles}
          actions={actions}
          onClose={closeModal}
        />
      )}

      {drawer && data && <AddDrawer start={drawer} data={data} onCancel={() => setDrawer(null)} onAdd={addEntry} />}
    </div>
  );
}
