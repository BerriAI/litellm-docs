import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# Grant MCP Server Access to Keys and Teams

This guide walks through granting an MCP server to a virtual key and to a team, first in the Admin UI and then through the management API, and shows how the resulting access resolves when the key and the team both carry a grant. The rules themselves (six-level intersection, `no-mcp-servers`, `require_key_mcp_access_defined`, access groups, per-entity tool permissions) live in [MCP Permission Management](./mcp_control); this page is the procedure that applies them.

## Before you start

Register the MCP server first, either in `config.yaml` under `mcp_servers` or from **MCP Servers** in the Admin UI (see [MCP Gateway](./mcp#adding-your-mcp)). Every grant below refers to the server by its `server_id` (a UUID for servers added in the UI) or by its `server_name` alias (the config key, for example `deepwiki`). Both forms are accepted by the API and resolve to the same server.

If several servers should always be granted together, put them in an [access group](./mcp_control#grouping-mcps-access-groups) and grant the group instead. If a key or team should see a hand-picked subset of tools across servers, create a [toolset](./mcp_toolsets) and grant that.

## The grant fields

MCP access is stored in the `object_permission` block of the key or team. The same four fields work on both, and they map one to one onto the controls in the Admin UI **MCP Settings** section.

| Field | Type | What it grants |
|-------|------|----------------|
| `mcp_servers` | `list[str]` | Server IDs or aliases the entity may reach. The sentinel `no-mcp-servers` blocks all MCP access, see [Opting a key out](./mcp_control#opting-a-key-out-of-all-mcp-servers-no-mcp-servers) |
| `mcp_access_groups` | `list[str]` | Access group names. Every server in the group is granted |
| `mcp_toolsets` | `list[str]` | Toolset IDs. Grants the servers the toolset draws from, limited to the tools it names |
| `mcp_tool_permissions` | `dict[str, list[str]]` | Per-server tool allowlist, keyed by server ID or alias. Omit a server to allow all of its tools. A server named here counts as granted even if it is missing from `mcp_servers` |

A key or team with none of these fields set has no MCP restriction of its own; what that means at runtime depends on the other levels, see [How key and team grants resolve](#how-key-and-team-grants-resolve).

## Grant an MCP server to a virtual key

### Admin UI

Open **Virtual Keys** in the left sidebar (`http://localhost:4000/ui/api-keys`) and click **+ Create New Key**. Fill in the owner, key name and models as usual, then scroll down and expand the **MCP Settings** accordion. The **Allowed MCP Servers** selector lists every registered server, access group and toolset, plus a **No MCP Servers** entry that blocks all MCP access for the key.

<Image
  img={require('../img/mcp_grant_key_selector.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
  alt="Allowed MCP Servers selector on the Create New Key form listing No MCP Servers, an access group, an MCP server and a toolset"
/>

Pick one or more entries. Each selected server (including servers resolved from an access group) expands into its tool list underneath, with every tool on by default. Untick a tool to remove it from the key; the header shows how many tools remain allowed. Click **Create Key** and copy the key from the confirmation dialog.

<Image
  img={require('../img/mcp_grant_key_tools.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
  alt="MCP Settings on the Create New Key form with the deepwiki server selected and two of three tools allowed"
/>

The selection is saved as `object_permission.mcp_servers` (or `mcp_access_groups` / `mcp_toolsets`, depending on what you picked) and the tool toggles as `object_permission.mcp_tool_permissions`. Read it back with `GET /key/info?key=<key>`.

To change an existing key, click the key in the **Virtual Keys** table, open its **Settings** tab, click **Edit Settings**, change **MCP Servers / Access Groups** and the tool toggles, then click **Save Changes**.

### API

`POST /key/generate` takes the grant inline. The example below grants one server and restricts the key to two of its tools:

```bash title="Create a key with an MCP grant" showLineNumbers
curl -X POST "http://localhost:4000/key/generate" \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "wiki-reader",
    "team_id": "<team-id>",
    "object_permission": {
      "mcp_servers": ["deepwiki"],
      "mcp_tool_permissions": {
        "deepwiki": ["read_wiki_structure", "read_wiki_contents"]
      }
    }
  }'
```

`POST /key/update` takes the same block plus the `key` to change. Fields you send replace the stored value for that field and fields you omit are kept, so adding a toolset to the key above leaves `mcp_servers` and `mcp_tool_permissions` in place:

```bash title="Add a toolset to an existing key" showLineNumbers
curl -X POST "http://localhost:4000/key/update" \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "sk-...",
    "object_permission": {
      "mcp_toolsets": ["<toolset-id>"]
    }
  }'
```

To grant every server in an access group, send `"mcp_access_groups": ["research"]` instead of `mcp_servers`. To block all MCP access, send `"mcp_servers": ["no-mcp-servers"]`.

Confirm what the key sees by listing tools with the key itself:

```bash showLineNumbers
curl -s "http://localhost:4000/mcp-rest/tools/list" \
  -H "Authorization: Bearer sk-..." | jq '[.tools[] | .name]'
```

```json
["read_wiki_contents", "read_wiki_structure"]
```

## Grant an MCP server to a team

### Admin UI

Open **Teams** in the left sidebar (`http://localhost:4000/ui/teams`) and click **Create Team**. Fill in the team name and models, then expand the **MCP Settings** accordion. The **Allowed MCP Servers** selector offers the same servers, access groups and toolsets as the key form. Selecting an access group shows each server it resolves to, tagged with the group name, so you can still toggle tools per server. Click **Create Team**.

<Image
  img={require('../img/mcp_grant_team_access_group.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
  alt="MCP Settings on the Create Team form with the research access group selected and the deepwiki server resolved through it"
/>

To change an existing team, click the team in the **Teams** table, open its **Settings** tab, click **Edit Settings**, change **MCP Servers / Access Groups** and the tool toggles, then click **Save Changes**. Keys that belong to the team inherit the new grant; nothing on the keys needs to be edited.

### API

`POST /team/new` and `POST /team/update` take the same `object_permission` block as the key endpoints, with `team_id` identifying the team on update:

<Tabs>
<TabItem value="new" label="/team/new">

```bash title="Create a team with an MCP grant" showLineNumbers
curl -X POST "http://localhost:4000/team/new" \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "team_alias": "research-team",
    "object_permission": {
      "mcp_servers": ["deepwiki"],
      "mcp_access_groups": ["research"],
      "mcp_toolsets": ["<toolset-id>"],
      "mcp_tool_permissions": {
        "deepwiki": ["read_wiki_structure", "read_wiki_contents"]
      }
    }
  }'
```

</TabItem>
<TabItem value="update" label="/team/update">

```bash title="Replace the team's server list, keep everything else" showLineNumbers
curl -X POST "http://localhost:4000/team/update" \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "<team-id>",
    "object_permission": {
      "mcp_servers": ["deepwiki"]
    }
  }'
```

</TabItem>
</Tabs>

`/team/update` merges the same way `/key/update` does: only the fields you send are replaced. Read the stored grant back with `GET /team/info?team_id=<team-id>`; it is returned under `team_info.object_permission`.

## How key and team grants resolve

The full rule set is in [Permission Hierarchy](./mcp_control#permission-hierarchy) and [Per-entity Tool-Level Permissions](./mcp_control#per-entity-tool-level-permissions). The cases below are the ones you hit when only a key and its team carry grants, in the order LiteLLM applies them.

A key with no MCP grant of its own inherits the team's grant. Every server and every tool the team allows is available to the key, and nothing else. With `require_key_mcp_access_defined: true` in `general_settings` the same key gets no MCP servers at all until it is granted some explicitly, see [Require keys to define their own MCP access](./mcp_control#require-keys-to-define-their-own-mcp-access).

When both the key and the team list servers, the key reaches the intersection. Tool permissions intersect too, per server: a team that allows two tools on `deepwiki` and a key that allows one of them yields that one tool. If only one side sets `mcp_tool_permissions` for a server, that side's list applies unchanged.

Within a single level, a toolset and a direct `mcp_tool_permissions` entry are unioned before the levels are intersected. A key granted the toolset `wiki_readonly` (two read tools) plus `mcp_tool_permissions: {"deepwiki": ["read_wiki_structure"]}` sees both read tools, not just the one named directly.

`no-mcp-servers` on the key wins over any team grant. `tools/list` returns an empty list and `tools/call` is refused, even though the team allows the server.

A key inside a team can only be granted servers the team already allows (or servers marked `allow_all_keys`). `/key/generate` and `/key/update` enforce this at write time (the Admin UI saves through the same endpoints) and answer `403`:

```text
Key requests MCP servers not allowed by team '<team-id>': ['<server-id>']. Team allows: ['<server-id>']. Global (allow_all_keys) servers: [].
```

A key that is not in a team can be granted any server by a proxy admin; a non-admin caller can only grant `allow_all_keys` servers to such a key. Servers the key already holds are grandfathered on `/key/update`, so shrinking the team's list does not break existing keys until you try to add a new server.

Organization, internal user, end user and agent grants sit above the key and team and only ever narrow the result further. Narrowing happens at `tools/list` time and again at `tools/call` time, so a tool outside the effective set is neither advertised nor callable.

### Worked example

Team `research-team` allows `deepwiki` with `mcp_tool_permissions: {"deepwiki": ["read_wiki_structure", "read_wiki_contents"]}` and the toolset `wiki_readonly` (the same two tools).

| Key grant | Effective tools on `deepwiki` |
|-----------|-------------------------------|
| none | `read_wiki_structure`, `read_wiki_contents` (inherited from the team) |
| `mcp_servers: ["deepwiki"]`, `mcp_tool_permissions: {"deepwiki": ["read_wiki_structure"]}` | `read_wiki_structure` (intersection) |
| the row above plus `mcp_toolsets: ["wiki_readonly"]` | `read_wiki_structure`, `read_wiki_contents` (key-level union, then intersected with the team) |
| `mcp_servers: ["no-mcp-servers"]` | none, `tools/list` is empty |
| `mcp_servers: ["deepwiki_backup"]` (not allowed by the team) | write rejected with `403` |

## Related

[MCP Permission Management](./mcp_control) for the rules and the remaining levels (organization, internal user, end user, agent), [MCP Toolsets](./mcp_toolsets) for creating toolsets, [Agent Permission Management](./a2a_agent_permissions) for agent grants, and [MCP Gateway](./mcp) for registering servers.
