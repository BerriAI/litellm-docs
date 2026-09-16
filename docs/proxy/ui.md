import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quick Start

Create keys, track spend, add models without worrying about the config / CRUD endpoints.

<Image img={require('../../img/litellm_ui_create_key.png')} />

## Quick Start

- Requires proxy master key to be set
- Requires db connected

Follow [setup](./virtual_keys.md#setup)

### 1. Start the proxy

```bash
litellm --config /path/to/config.yaml

#INFO: Proxy running on http://0.0.0.0:4000
```

### 2. Go to UI

```bash
http://0.0.0.0:4000/ui # <proxy_base_url>/ui
```

### 3. Get Admin UI Link on Swagger

Your Proxy Swagger is available on the root of the Proxy: e.g.: `http://localhost:4000/`

<Image img={require('../../img/ui_link.png')} />

### 4. Sign in for the first time

Out of the box, the UI accepts a login built from environment variables: the username is `UI_USERNAME` (default `admin`) and the password is `UI_PASSWORD`. If `UI_PASSWORD` is unset, the master key itself is accepted as the password. Anyone who signs in this way is a proxy admin.

```shell
LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)" # master key for the proxy; must start with sk-
UI_USERNAME=ishaan-litellm   # username to sign in on UI
UI_PASSWORD=langchain        # password to sign in on UI
```

On accessing the LiteLLM UI, you will be prompted to enter your username, password

:::warning Environment credentials are for bootstrapping only
This login path stores a permanent, shared, cleartext admin credential in your environment, cannot be rotated per person, and leaves no way to tell which admin did what. Once you are signed in, follow the steps below to move to per-user accounts and disable it. Until you do, the dashboard shows a warning banner to every admin.
:::

### 5. Create your own admin account and disable environment credential login

First, while signed in with the environment credentials, create a `proxy_admin` user for yourself: go to `Internal Users` -> `+ Invite User`, set the role to `proxy_admin`, and open the invitation link it generates to set your password. You can also create the user over the API with `POST /user/new` and a `user_role` of `proxy_admin`; see [invite users](./self_serve.md). Sign out and confirm you can sign in with your email and new password before continuing.

Then turn off the environment credential login path in your `config.yaml` and restart the proxy:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  disable_env_credential_login: true
```

After the restart, `UI_USERNAME`/`UI_PASSWORD` and the master key are rejected on the login page with `401 Invalid credentials used to access UI`, the warning banner disappears, and only database users (and [SSO](./admin_ui_sso.md), if configured) can sign in. You can now remove `UI_USERNAME` and `UI_PASSWORD` from your environment.

:::note
Enable `disable_env_credential_login` after you have a `proxy_admin` user with a password, since it is the only way left to sign in to the UI. If you enable it too early, remove the setting and restart to bring the environment login back; the API keeps working with the master key throughout.
:::

If you use SSO, `disable_password_login_when_sso_enabled` also blocks this login path, since it rejects every username/password login once the SSO provider is fully configured. See [SSO for the Admin UI](./admin_ui_sso.md).

### 6. Configure Root Redirect URL

When `DOCS_URL` is set to something other than `"/"`, you can configure where the root path (`/`) redirects to using `ROOT_REDIRECT_URL`:

```shell
DOCS_URL="/docs"              # Set docs to a different path
ROOT_REDIRECT_URL="/ui"       # Redirect root path (/) to /ui
```

By default, `DOCS_URL` is `"/"`, so this setting is only needed when you've changed `DOCS_URL` to a different path.

## Invite-other users

Allow others to create/delete their own keys.

[**Go Here**](./self_serve.md)

## Model Management

The Admin UI provides the following model management capabilities:

- **Add Models**: Add new models through the UI without restarting the proxy
- **AI Hub**: Make models and agents public for developers to discover what's available
- **Price Data Sync**: Keep model pricing data up to date by syncing from GitHub

For detailed information on model management, see [Model Management](./model_management.md).

For information on sharing models and agents, see [AI Hub](./ai_hub.md).

:::tip Sync Model Pricing Data
[Sync model pricing data from GitHub](./sync_models_github.md) to keep your model cost information current.
:::

## Disable Admin UI

Set `DISABLE_ADMIN_UI="True"` in your environment to disable the Admin UI.

Useful, if your security team has additional restrictions on UI usage.

**Expected Response**

<Image img={require('../../img/admin_ui_disabled.png')}/>
