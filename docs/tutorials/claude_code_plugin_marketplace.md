import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Code Plugin Marketplace (Managed Skills)

LiteLLM AI Gateway acts as a central registry for Claude Code plugins. Admins can govern which plugins are available across the organization, and engineers can discover and install approved plugins from a single source.

## Prerequisites

- LiteLLM Proxy running with database connected
- Admin access to LiteLLM UI
- Plugins hosted on GitHub, GitLab, or any git-accessible URL

## Admin Guide: Managing the Marketplace

### Step 1: Navigate to Claude Code Plugins

In the LiteLLM Admin UI, click on **Claude Code Plugins** in the left navigation menu.

<Image img={require('../../img/claude_code_marketplace/step1_navigate_plugins.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 2: View the Plugins List

You'll see the list of all registered plugins. From here you can add, enable, disable, or delete plugins.

<Image img={require('../../img/claude_code_marketplace/step3_plugins_list.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 3: Add a New Plugin

Click **+ Add New Plugin** to register a plugin in your marketplace.

<Image img={require('../../img/claude_code_marketplace/step4_add_plugin.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 4: Fill in Plugin Details

Enter the plugin information:

- **Name**: Plugin identifier (kebab-case, e.g., `my-plugin`)
- **Source Type**: Choose GitHub, Git URL, or Git Subdir
- **Repository/URL**: The git source (e.g., `org/repo` for GitHub)
- **Version**: Semantic version (optional)
- **Description**: What the plugin does
- **Category**: Plugin category for organization
- **Keywords**: Search terms

<Image img={require('../../img/claude_code_marketplace/step5_plugin_form.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 5: Submit the Plugin

After filling in the details, click **Add Plugin** to register it.

<Image img={require('../../img/claude_code_marketplace/step9_submit.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 6: Enable/Disable Plugins

Toggle plugins on or off to control what appears in the public marketplace. Only **enabled** plugins are visible to engineers.

<Image img={require('../../img/claude_code_marketplace/step11_enable_plugin.jpeg')} style={{ width: '800px', height: 'auto' }} />

## Self-Service Submission with Admin Review

Any authenticated user can propose a skill without holding admin rights. A submission from a non-admin lands in a pending state: it is disabled, absent from `/claude-code/marketplace.json` and the public Skill Hub, and visible only to its submitter and to admins until an admin approves it. Skills registered by an admin are active immediately, so nothing changes for existing setups

### Step 1: Submit a Skill as a User

On the **Skills** page, a non-admin sees **+ Submit Skill** and fills in the same form an admin uses

<Image img={require('../../img/claude_code_skill_review/submit_form.jpeg')} style={{ width: '800px', height: 'auto' }} />

After submitting, the skill shows up in the list with a **Pending Review** badge, along with a confirmation that it went to an administrator

<Image img={require('../../img/claude_code_skill_review/pending_submission.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 2: Review the Queue as an Admin

Admins get an **Awaiting review** button that filters the table down to pending submissions, and each pending row carries **Approve** and **Reject** actions

<Image img={require('../../img/claude_code_skill_review/admin_pending_queue.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 3: Approve or Reject

Approving marks the skill active, enables it, and publishes it to `marketplace.json` and the public Skill Hub

<Image img={require('../../img/claude_code_skill_review/approved_active.jpeg')} style={{ width: '800px', height: 'auto' }} />

Rejecting keeps the skill private and lets you leave an optional note explaining what needs to change

<Image img={require('../../img/claude_code_skill_review/reject_dialog.jpeg')} style={{ width: '800px', height: 'auto' }} />

The submitter then sees the rejected state along with your note, so they can fix the skill and edit it. An edit by a non-admin sends the skill back to pending review, since the approved content changed

<Image img={require('../../img/claude_code_skill_review/submitter_rejected.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Review States

A skill is `pending_review` while it waits on an admin, `active` once approved, and `rejected` if turned down. Only skills that are both `active` and enabled are served to users, and enabling a skill that has not been approved fails with a 409 pointing at the approve endpoint. Skills registered before this workflow existed read back as `active`, so upgrading does not hide anything that used to be published

## Engineer Guide: Installing Plugins

### Step 1: Add the LiteLLM Marketplace

Add your company's LiteLLM marketplace to Claude Code:

```bash
claude plugin marketplace add http://your-litellm-proxy:4000/claude-code/marketplace.json
```

<Image img={require('../../img/claude_code_marketplace/step12_cli_marketplace.jpeg')} style={{ width: '800px', height: 'auto' }} />

### Step 2: Browse Available Plugins

List all available plugins from the marketplace:

```bash
claude plugin search @litellm
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

Returns the marketplace catalog for Claude Code discovery.

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

Only approved, enabled skills appear here, so pending and rejected submissions are never served to Claude Code

### Authenticated Endpoints

#### POST `/claude-code/plugins`

Register a plugin. An admin key creates it active and enabled; any other key submits it for review, which returns `action: submitted_for_review` with `approval_status: pending_review` and `enabled: false`

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

#### GET `/claude-code/plugins`

List registered plugins. Admins see everything and can filter by state with `?approval_status=pending_review`; other users see active skills plus their own submissions

```bash
curl "http://localhost:4000/claude-code/plugins?approval_status=pending_review" \
  -H "Authorization: Bearer sk-admin-..."
```

#### POST `/claude-code/plugins/{name}/approve`

Approve a submitted skill (admin only). Sets `approval_status=active`, enables the skill, and records the reviewer and timestamp

```bash
curl -X POST http://localhost:4000/claude-code/plugins/my-plugin/approve \
  -H "Authorization: Bearer sk-admin-..."
```

#### POST `/claude-code/plugins/{name}/reject`

Reject a submitted skill (admin only) with optional feedback shown to the submitter

```bash
curl -X POST http://localhost:4000/claude-code/plugins/my-plugin/reject \
  -H "Authorization: Bearer sk-admin-..." \
  -H "Content-Type: application/json" \
  -d '{"review_notes": "Point the source at the reviewed internal fork"}'
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
- Verify the plugin is **enabled** in the admin UI
- Check that the review state is **Active**; a submission still pending review or rejected is not served
- Check that the plugin has a valid `source` field

**Installation fails:**
- Ensure the git repository is accessible from the engineer's machine
- For private repos, engineers need appropriate git credentials configured

**Database errors:**
- Verify LiteLLM proxy is connected to the database
- Check proxy logs for detailed error messages
