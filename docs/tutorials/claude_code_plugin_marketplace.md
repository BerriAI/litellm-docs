import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Code Plugin Marketplace (Managed Skills)

LiteLLM AI Gateway acts as a central registry for Claude Code plugins. Admins can govern which plugins are available across the organization, and engineers can discover and install approved plugins from a single source.

## Prerequisites

- LiteLLM Proxy running with database connected
- Admin access to LiteLLM UI
- Plugins hosted on GitHub, GitLab, any git-accessible URL, or as a zip archive on an HTTPS host

## Admin Guide: Managing the Marketplace

### Step 1: Navigate to Skills

In the LiteLLM Admin UI, click on **Skills** in the left navigation menu. Only proxy admins can add, edit, enable, disable, or delete plugins.

<Image img={require('../../img/claude_code_marketplace/step1_navigate_plugins.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 2: View the Plugins List

You'll see the list of all registered plugins. From here you can add, enable, disable, or delete plugins.

<Image img={require('../../img/claude_code_marketplace/step3_plugins_list.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 3: Add a New Plugin

Click **+ Add Skill** to register a plugin in your marketplace.

<Image img={require('../../img/claude_code_marketplace/step4_add_plugin.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 4: Fill in Plugin Details

Paste the source URL first. It can be a GitHub URL, a git clone URL over HTTPS or SSH, a `tree/<branch>/<path>` link to a subdirectory, or an HTTPS link to a zip file. LiteLLM detects the source type and suggests a name. Then fill in the name (kebab-case, e.g. `my-plugin`) and any optional fields: domain, namespace, description, category, keywords, version, and author.

The **Host for Claude Desktop** switch controls whether LiteLLM stores the plugin as a zip and serves it from this proxy, which is how Claude Desktop installs plugins from a marketplace URL. It is on by default for zip archives and off for git sources. See [Host plugins for Claude Desktop](#host-plugins-for-claude-desktop).

<Image img={require('../../img/claude_code_marketplace/step5_plugin_form.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 5: Submit the Plugin

After filling in the details, click **Add Skill** to register it.

<Image img={require('../../img/claude_code_marketplace/step9_submit.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 6: Enable/Disable Plugins

New plugins are enabled as soon as they are added. Toggle plugins on or off to control what appears in the public marketplace. Enabled plugins are visible to everyone. A disabled plugin is only visible to keys or teams granted it through **Allowed Skills** (`object_permission.skills`), as described in [Private skills](../skills_gateway.md#private-skills).

<Image img={require('../../img/claude_code_marketplace/step11_enable_plugin.jpeg')} style={{ width: '800px', height: 'auto' }} />

## Engineer Guide: Installing Plugins

### Step 1: Add the LiteLLM Marketplace

Add your company's LiteLLM marketplace to Claude Code:

```bash
claude plugin marketplace add http://your-litellm-proxy:4000/claude-code/marketplace.json
```

If you were granted private plugins, add your key so they appear too:

```bash
claude plugin marketplace add "http://your-litellm-proxy:4000/claude-code/marketplace.json?key=sk-..."
```

<Image img={require('../../img/claude_code_marketplace/step12_cli_marketplace.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 2: Browse Available Plugins

Run `/plugin` inside Claude Code to browse plugins from the `litellm` marketplace, or list them from the proxy:

```bash
curl http://your-litellm-proxy:4000/claude-code/marketplace.json
```

### Step 3: Install a Plugin

Install any plugin from the marketplace:

```bash
claude plugin install my-plugin@litellm
```

<Image img={require('../../img/claude_code_marketplace/step15_cli_paste.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 4: Verify Installation

The plugin is now installed and ready to use:

<Image img={require('../../img/claude_code_marketplace/step16_cli_complete.jpeg')} style={{ width: '800px', height: 'auto' }} />

## API Reference

### Public Endpoint (No Auth Required)

#### GET `/claude-code/marketplace.json`

Returns the marketplace catalog for Claude Code discovery. Without a key it lists enabled plugins. With `?key=sk-...` it also lists the disabled plugins granted to that key or its team.

```bash
curl http://localhost:4000/claude-code/marketplace.json
```

**Response:**
```json
{
  "name": "litellm",
  "owner": {
    "name": "LiteLLM",
    "email": "support@litellm.ai"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": {
        "source": "github",
        "repo": "org/my-plugin"
      },
      "version": "1.0.0",
      "description": "My awesome plugin",
      "category": "productivity",
      "keywords": ["automation", "tools"]
    }
  ]
}
```

#### GET `/claude-code/plugins/{name}/archive.zip`

Downloads a plugin that LiteLLM [hosts for Claude Desktop](#host-plugins-for-claude-desktop) as a zip. Like `marketplace.json`, it needs no key for an enabled plugin, and `?key=sk-...` unlocks a disabled plugin granted to that key. It returns `404` for a plugin that does not exist, is not hosted, or is disabled and not granted to the caller.

```bash
curl -O http://localhost:4000/claude-code/plugins/my-plugin/archive.zip
```

### Management Endpoints (Auth Required)

Every write endpoint below requires a proxy admin key and rejects any other key with a `401` or `403`. The read endpoints accept any key and only return plugins visible to it.

#### POST `/claude-code/plugins`

Register a new plugin. This only creates; a name that already exists returns `409`.

```bash
curl -X POST http://localhost:4000/claude-code/plugins \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-plugin",
    "source": {"source": "github", "repo": "org/my-plugin"},
    "version": "1.0.0",
    "description": "My awesome plugin",
    "category": "productivity",
    "keywords": ["automation", "tools"]
  }'
```

`installation_preference` is optional and takes `available`, `auto_install`, or `required`. It needs an `archive` source or `serve_archive: true`, so adding it to the github example above returns `400`. See [Auto-install plugins in Claude Desktop](#auto-install-plugins-in-claude-desktop).

`serve_archive` is optional. It makes LiteLLM host the plugin as a zip for Claude Desktop, and it defaults to `true` for `archive` sources and `false` for git sources. See [Host plugins for Claude Desktop](#host-plugins-for-claude-desktop).

#### GET `/claude-code/plugins`

List the plugins visible to the caller: everything for a proxy admin, otherwise enabled plugins plus the ones granted to the key. Add `?enabled_only=true` to return only enabled plugins.

```bash
curl http://localhost:4000/claude-code/plugins \
  -H "Authorization: Bearer sk-..."
```

#### GET `/claude-code/plugins/{name}`

Get one plugin. Returns `403` for a disabled plugin that is not granted to the caller.

```bash
curl http://localhost:4000/claude-code/plugins/my-plugin \
  -H "Authorization: Bearer sk-..."
```

#### PUT `/claude-code/plugins/{name}`

Replace an existing plugin. The name comes from the path and cannot change. This is a full replace, so omitted fields reset to their defaults, and `version` and `installation_preference` are cleared if omitted.

```bash
curl -X PUT http://localhost:4000/claude-code/plugins/my-plugin \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "source": {"source": "github", "repo": "org/my-plugin"},
    "version": "1.1.0",
    "description": "My awesome plugin, now with more tools",
    "category": "productivity",
    "keywords": ["automation", "tools"]
  }'
```

#### POST `/claude-code/plugins/{name}/enable`

Enable a plugin.

```bash
curl -X POST http://localhost:4000/claude-code/plugins/my-plugin/enable \
  -H "Authorization: Bearer sk-..."
```

#### POST `/claude-code/plugins/{name}/disable`

Disable a plugin.

```bash
curl -X POST http://localhost:4000/claude-code/plugins/my-plugin/disable \
  -H "Authorization: Bearer sk-..."
```

#### DELETE `/claude-code/plugins/{name}`

Delete a plugin.

```bash
curl -X DELETE http://localhost:4000/claude-code/plugins/my-plugin \
  -H "Authorization: Bearer sk-..."
```

## Auto-install plugins in Claude Desktop

Available from v1.107.0.

Claude Desktop on third-party can install a plugin for every user without each one opting in, when your LiteLLM proxy is also its inference gateway. Set `installation_preference` on the plugin and LiteLLM serves it as `installationPreference` on that plugin's `marketplace.json` entry. The field is API only, since the Admin UI has no control for it yet. `GET /claude-code/plugins`, `GET /claude-code/plugins/{name}`, and `GET /public/skill_hub` return it as `installation_preference`. If LiteLLM [hosts the zip](#host-plugins-for-claude-desktop) with `serve_archive: true`, it computes the digest and the same-origin URL for you and you can skip the rest of this paragraph and the example below, using `"serve_archive": true` with any `source` instead. For an archive you host yourself, the `sha256` must be the zip's 64-character hex SHA-256 digest. The digest below is only an example, so replace it with the output of `shasum -a 256 my-plugin-1.0.0.zip`. LiteLLM checks only that the digest is 64 hex characters, not that it matches the zip, and Anthropic's [Claude Desktop extensions docs](https://claude.com/docs/third-party/claude-desktop/extensions) say Desktop installs nothing from a sync when any archive in it fails to download or fails its digest check, so one wrong digest blocks every auto-install from this marketplace:

```bash
curl -X POST http://localhost:4000/claude-code/plugins \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-plugin",
    "source": {
      "source": "archive",
      "url": "https://litellm.example.com/plugins/my-plugin-1.0.0.zip",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "installation_preference": "auto_install"
  }'
```

The plugin's entry in `marketplace.json` then looks like this:

```json
{
  "name": "my-plugin",
  "source": {
    "source": "archive",
    "url": "https://litellm.example.com/plugins/my-plugin-1.0.0.zip",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "version": "1.0.0",
  "installationPreference": "auto_install"
}
```

Claude Desktop honors a per-plugin `installationPreference` only when `marketplace.json` is served from its `inferenceGatewayBaseUrl` or `bootstrapUrl` origin, and only for an `archive` source with a `sha256` whose zip sits on that same origin. Per the same Anthropic docs, it does not list other source types from a `marketplace.json` URL at all, so LiteLLM answers 400 when `installation_preference` is set on a plugin that is neither an `archive` source nor hosted with `serve_archive: true`, or when `auto_install` or `required` is set on an external archive without a `sha256`. LiteLLM does not check the origin of an archive you supply yourself, so a path like `/plugins/` in the example returns `404` until you route it to your own file server at your ingress, on the same origin as the proxy. To skip that file server, let LiteLLM [host the zip itself](#host-plugins-for-claude-desktop), which serves it from the same origin as `marketplace.json` and fills in the `sha256` for you. LiteLLM also accepts the request key as `installationPreference`, the name Claude Desktop reads, and answers 422 when one request sends both spellings with values.

Claude Desktop 2.31226.1 treats a per-plugin `required` the same as `auto_install`. It installs the plugin on its own, but the user can still turn it off or remove it, and a removed plugin stays removed on the next sync. A whole-marketplace `required` setting in Claude Desktop is the one that stops users from removing plugins.

Claude Desktop sends the marketplace URL without `?key=`, and LiteLLM does not read the bearer token Desktop sends with it, so Desktop sees only enabled plugins. Enable an auto-install plugin instead of granting it to a key or team. Enabling makes the plugin public, so its name, description, archive URL, and `sha256` show up without auth in `marketplace.json` and `GET /public/skill_hub`. In Claude Desktop's own marketplace configuration, leave the entry's `installationPreference` at `available` and let the per-plugin values decide. See [Per-plugin auto-install from a trusted origin](https://claude.com/docs/third-party/claude-desktop/extensions#per-plugin-auto-install-from-a-trusted-origin) for the Desktop side of the setup.

:::warning Older Claude Code releases

Claude Code 2.1.119 and earlier reject a `marketplace.json` that lists any `archive` plugin, so `claude plugin marketplace add` and `claude plugin marketplace update` fail for every plugin in it. Releases 2.1.120 through 2.1.223 add the marketplace but fail `claude plugin install` on an `archive` plugin. Claude Code 2.1.224 is the first release that installs `archive` plugins, per the [plugin marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference). LiteLLM serves `installationPreference` only on `archive` plugins, so the field adds no new break. A plugin hosted with `serve_archive` is also listed as an `archive` plugin, so turning it on for a git plugin has the same effect. Upgrade every Claude Code user of this marketplace to 2.1.224 or later before you add an `archive` plugin or host one. Claude Code ignores `installationPreference`, so those users still install the plugin with `/plugin install`.

:::

## Host plugins for Claude Desktop

Claude Desktop installs plugins from a `marketplace.json` URL only when the source is an `archive` zip on the same origin as the marketplace. It does not fetch `github` or `git-subdir` sources from that kind of marketplace, so a catalog of git plugins lists them but cannot install them.

With `serve_archive`, LiteLLM builds the zip itself and serves it from the proxy, so you do not need a separate file server. When the plugin is registered or updated, LiteLLM fetches the source, repackages it with the plugin at the root of the zip, stores it on the proxy's disk, and records its SHA-256. `marketplace.json` then lists the plugin as an `archive` source on your proxy's own origin, with that digest:

```json
{
  "name": "my-plugin",
  "source": {
    "source": "archive",
    "url": "https://litellm.example.com/claude-code/plugins/my-plugin/archive.zip",
    "sha256": "<64-character hex digest computed by LiteLLM>"
  },
  "version": "1.0.0"
}
```

`serve_archive` defaults to `true` for `archive` sources and `false` for `github`, `url`, and `git-subdir` sources. Set it explicitly on a git source to host it, or set it to `false` on an archive source to keep pointing at the external file:

```bash
curl -X POST http://localhost:4000/claude-code/plugins \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-plugin",
    "source": {
      "source": "git-subdir",
      "url": "https://github.com/org/plugins.git",
      "path": "plugins/my-plugin"
    },
    "serve_archive": true
  }'
```

In the Admin UI, the **Host for Claude Desktop** switch in the Add Skill form sets the same field. The Skills list has a **Hosted for Desktop** column and a skill's detail page has a **Hosted for Claude Desktop** row, and both show Yes only when LiteLLM actually built and stored a zip for the plugin. Plugins with `serve_archive` off keep the source you registered, so Claude Code behaves exactly as before. `GET /claude-code/plugins` and `GET /claude-code/plugins/{name}` return `serve_archive` as `true` only for plugins LiteLLM hosts.

Because LiteLLM supplies the digest, `installation_preference` accepts `serve_archive: true` in place of an `archive` source, and `auto_install` and `required` no longer need you to compute a `sha256`. See [Auto-install plugins in Claude Desktop](#auto-install-plugins-in-claude-desktop).

### What a hosted zip contains

For an `archive` source, LiteLLM downloads your zip and repackages it before serving it, with sorted entries, fixed timestamps, and normalized file modes. The `sha256` in `marketplace.json` is computed from that repackaged zip, so it does not equal the `shasum` of your original file. A `sha256` you set on the source is still checked against the file as downloaded.

LiteLLM serves the zip at `GET /claude-code/plugins/{name}/archive.zip` as `application/zip`. It must contain `.claude-plugin/plugin.json` at its root, with skills, MCP configuration, and other files in their usual plugin locations. For a `git-subdir` source, LiteLLM keeps only that subdirectory. For any source, a single wrapper folder around the plugin, like the one GitHub adds, is removed.

If LiteLLM cannot build the zip, the plugin is not created or updated, and the Admin UI shows the error from the `400` response, so a plugin never ends up in the catalog without a zip behind it. This applies to archive sources too, since they are hosted by default; turn **Host for Claude Desktop** off, or send `"serve_archive": false`, to register a zip LiteLLM cannot download and keep serving your own URL. LiteLLM rejects the plugin with a `400` that names the cause when the zip has no `.claude-plugin/plugin.json` at its root, contains a symlink, an absolute path, or a `..` path, or is larger than 10 MB uncompressed. It also rejects an `archive` source whose `sha256` does not match the downloaded file, and any URL that fails the SSRF protection LiteLLM applies to other user-supplied URLs, which refuses private and internal addresses.

The route follows the same visibility rules as `marketplace.json`. An enabled plugin is public. A disabled plugin returns `404` unless you pass a `?key=` that is granted it, and the `url` in a catalog fetched with `?key=` carries that key.

### Internal hosts

If your archive lives on an internal host, such as an Artifactory or file server on a private network, registration fails with `If this is a legitimate internal service, add the host to user_url_allowed_hosts in litellm_settings`. LiteLLM downloads the zip from the proxy, so the host must be reachable from the proxy and listed under `litellm_settings` in `config.yaml`. The setting does not work under `general_settings`, and the proxy needs a restart to pick it up:

```yaml
litellm_settings:
  user_url_allowed_hosts:
    - artifacts.corp.internal
    - git.corp.internal:8443
```

Write each entry as the hostname appears in the plugin's `url`, with an optional port. A bare hostname allows any port, and `host:port` allows only that one. For split-horizon DNS, list the public hostname and not the private address it resolves to. LiteLLM runs the same check when it refetches a missing zip, so the entry has to stay in place after registration. See [`user_url_allowed_hosts`](../proxy/config_settings.md) for the full setting, and note that it also covers other user-supplied URLs on the proxy.

### Git sources must be on GitHub

LiteLLM downloads git sources as a repository archive from GitHub and does not run `git clone`. A `github` source, or a `url` or `git-subdir` source on `github.com`, can be hosted. For GitLab, Bitbucket, or a self-hosted git server, build a zip yourself and register it as an `archive` source, which LiteLLM downloads and hosts the same way.

An `archive` source has no commit to pin, so it depends on the URL returning the same file each time. A link that follows a branch, such as a GitLab `raw/main` URL, changes when the branch changes, and the next refetch then fails with a `502` until you update the plugin. Link to a tag or a commit instead.

LiteLLM resolves the repository's default branch to a commit when it builds the zip and stores that commit, so later rebuilds fetch the same files. A new push to the repository does not change a registered plugin. To publish it, update the plugin with `PUT /claude-code/plugins/{name}`.

For a private repository, set `GITHUB_TOKEN` on the proxy to a token that can read it.

### Where the zip is stored

LiteLLM keeps each zip as a file in `LITELLM_PLUGIN_ARCHIVE_DIR`. Without it, the files go to a `litellm_plugin_archives` folder in the system temp directory, which does not survive a restart or a new container. Set it to a persistent path in production.

The database holds the digest and the source, but not the zip. When the file is missing, for example on a new container or on a replica that did not handle the registration, LiteLLM fetches the source again, checks that the result matches the recorded digest, and writes the file back. That refetch needs the same outbound access as registration. A failed refetch is not cached, so every request for the zip tries the source again. If the source no longer produces the same zip, the route returns `502` instead of serving a file that does not match the catalog, because Claude Desktop installs nothing from a sync when a digest fails. Update the plugin to publish the new content and digest.

:::tip

On more than one replica, point `LITELLM_PLUGIN_ARCHIVE_DIR` at shared storage to avoid refetching the zip on each replica.

:::

## Plugin Source Formats

<Tabs>
<TabItem value="github" label="GitHub">

```json
{
  "name": "my-plugin",
  "source": {
    "source": "github",
    "repo": "organization/repository"
  }
}
```

</TabItem>
<TabItem value="url" label="Git URL">

```json
{
  "name": "my-plugin",
  "source": {
    "source": "url",
    "url": "https://github.com/org/repo.git"
  }
}
```

Use this format for GitLab, Bitbucket, or self-hosted git repositories.

</TabItem>
<TabItem value="git-subdir" label="Git Subdir">

```json
{
  "name": "my-plugin",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/org/repo.git",
    "path": "plugins/my-plugin"
  }
}
```

Use this format when your plugin lives in a subdirectory of a git repository. The `path` field must be a relative path of slash-separated segments (alphanumeric, dots, hyphens, underscores only).

</TabItem>
<TabItem value="archive" label="Zip Archive">

```json
{
  "name": "my-plugin",
  "source": {
    "source": "archive",
    "url": "https://bucket.s3.amazonaws.com/plugins/my-plugin.zip",
    "sha256": "<optional 64-character hex digest>"
  }
}
```

Use this format for a plugin packaged as a zip file on any HTTPS host, such as S3. The `url` must use HTTPS, and `sha256`, when set, must be a 64-character hex digest of the archive. By default LiteLLM downloads the zip and [hosts it itself](#host-plugins-for-claude-desktop) for Claude Desktop. Set `serve_archive` to `false` to keep serving your URL as is.

</TabItem>
</Tabs>

## Example: Setting Up an Internal Plugin Marketplace

### 1. Create Internal Plugins

Structure your plugin repository:

```
my-company-plugin/
├── plugin.json          # Plugin manifest
├── SKILL.md            # Main skill file
├── skills/             # Additional skills
│   └── helper.md
└── README.md
```

### 2. Register Plugins via API

```bash
# Register your internal tools plugin
curl -X POST http://localhost:4000/claude-code/plugins \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "internal-tools",
    "source": {"source": "github", "repo": "mycompany/internal-tools"},
    "version": "1.0.0",
    "description": "Internal development tools and utilities",
    "author": {"name": "Platform Team", "email": "platform@mycompany.com"},
    "category": "internal",
    "keywords": ["internal", "tools", "utilities"]
  }'
```

### 3. Use in Claude Code

Send engineers the marketplace URL:

```bash
# One-time setup for each engineer
claude plugin marketplace add http://litellm.internal.company.com/claude-code/marketplace.json

# Install company plugins
claude plugin install internal-tools@litellm
```

## Troubleshooting

**Plugin not appearing in marketplace:**
- Verify the plugin is **enabled** in the admin UI, or that it is granted to your key and you added the marketplace with `?key=`
- Run `claude plugin marketplace update litellm` to refresh the local copy of the catalog

**Installation fails:**
- Ensure the git repository is accessible from the engineer's machine
- For private repos, engineers need appropriate git credentials configured
- For `git-subdir` sources, check that `path` matches the skill's directory in the repository; Claude Code reports `Subdirectory '<path>' not found` otherwise

**Database errors:**
- Verify LiteLLM proxy is connected to the database
- Check proxy logs for detailed error messages
