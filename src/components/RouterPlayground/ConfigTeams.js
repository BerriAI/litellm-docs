import React from 'react';
import {fallbackTargets} from './validate';
import styles from './ConfigEditor.module.css';

// The config as one team's requests see it. The proxy forwards these keys of a team's
// router_settings into each request (the host's apply_team_settings mirrors it); any other key
// in a team's router_settings changes nothing.
export const TEAM_APPLIED = [
  'fallbacks',
  'context_window_fallbacks',
  'content_policy_fallbacks',
  'num_retries',
  'model_group_retry_policy',
  'model_group_alias',
  'weights',
];

const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

// `teams:` is a list of {team_id, router_settings} or a map from team id to its router_settings.
export function teamsOf(data) {
  const raw = data?.teams;
  if (Array.isArray(raw)) {
    return raw
      .filter(team => team && typeof team === 'object' && team.team_id != null)
      .map(team => ({id: String(team.team_id), settings: object(team.router_settings)}));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([id, team]) => ({id, settings: object(team?.router_settings ?? team)}));
  }
  return [];
}

const scoped = entry => entry?.model_info?.team_id != null && entry?.model_info?.team_public_model_name != null;

const aliasTarget = target => (typeof target === 'string' ? target : target?.model);

// Each group as the team gets it. A deployment scoped to the team (model_info.team_id and
// team_public_model_name) serves the team's calls to its public name instead of that group's
// shared deployments, so the shared ones read as unused. Groups made only of team-scoped
// deployments fold into their public names. `weights` replaces the split for the groups it names,
// and deployments it leaves out get none of the team's traffic.
export function teamLens(groups, team) {
  const own = new Map();
  for (const members of groups.values()) {
    for (const member of members) {
      const info = member.entry?.model_info;
      if (!scoped(member.entry) || String(info.team_id) !== team.id) continue;
      const name = String(info.team_public_model_name);
      own.set(name, [...(own.get(name) ?? []), member]);
    }
  }
  const shown = new Map();
  for (const [name, members] of groups) {
    if (members.length && members.every(member => scoped(member.entry))) continue;
    const mine = own.get(name);
    shown.set(
      name,
      mine
        ? [...mine.map(member => ({...member, lens: 'own'})), ...members.map(member => ({...member, lens: 'unused'}))]
        : members,
    );
  }
  for (const [name, mine] of own) {
    if (!shown.has(name)) shown.set(name, mine.map(member => ({...member, lens: 'own'})));
  }

  const weights = object(team.settings.weights);
  const aliases = Object.entries(object(team.settings.model_group_alias));
  const lens = new Map();
  for (const [name, members] of shown) {
    const scope = object(weights[name]);
    let split = null;
    if (Object.keys(scope).length) {
      const used = members.filter(member => member.lens !== 'unused');
      const values = used.map(member => Math.max(0, Number(scope[member.shown]) || 0));
      const total = values.reduce((sum, value) => sum + value, 0);
      if (total > 0) {
        split = {};
        used.forEach((member, i) => {
          split[member.index] = values[i] / total;
        });
      }
    }
    const alias = aliases.filter(([, target]) => aliasTarget(target) === name).map(([from]) => from);
    lens.set(name, {members, split, alias});
  }
  return lens;
}

// A group's fallback targets for a team: the team's list replaces the router's whole map when
// the team sets that key. `router` is the router's targets when the team overrides them.
export function teamFallbacks(data, team, key, name) {
  const router = fallbackTargets(data, key).find(entry => entry.from === name)?.to ?? [];
  if (!team || team.settings[key] == null) return {to: router, router: null};
  const mine =
    fallbackTargets({router_settings: {[key]: team.settings[key]}}, key).find(entry => entry.from === name)?.to ?? [];
  return {to: mine, router};
}

export const teamColour = index => `var(--ce-team-${index % 4})`;

export function ViewAs({teams, value, onChange}) {
  return (
    <div className={styles.viewAs}>
      <span className={styles.muted}>View as</span>
      <div className={styles.segment} role="tablist" aria-label="View the config as a team">
        <button type="button" role="tab" aria-selected={value == null} onClick={() => onChange(null)}>
          Router
        </button>
        {teams.map((team, index) => (
          <button
            key={team.id}
            type="button"
            role="tab"
            aria-selected={value === team.id}
            className={value === team.id ? styles.teamTab : undefined}
            style={{'--ce-team': teamColour(index)}}
            onClick={() => onChange(team.id)}>
            <i className={styles.teamDot} aria-hidden="true" />
            {team.id}
          </button>
        ))}
      </div>
    </div>
  );
}

// A value the team sets, with the router's struck through beside it.
export function Overridden({value, router}) {
  return (
    <span className={styles.overridden}>
      <span className={styles.teamValue}>{value}</span>
      {router != null && <s className={styles.routerValue}>{router}</s>}
    </span>
  );
}
