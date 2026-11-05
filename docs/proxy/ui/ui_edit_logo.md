import Image from '@theme/IdealImage';

# Customize UI branding

{/* keep-version-note */}

<a id="custom-branding-admin-ui"></a>
<a id="customize-ui-logo"></a>

Customize the Admin UI logo, favicon, and color scheme.

<Image img={require('../../../img/litellm_custom_ai.png')} />

## Via the UI

<a id="or-set-your-logo-directly-from-admin-ui"></a>
<a id="1-navigate-to-settings"></a>
<a id="2-open-ui-theme-settings"></a>
<a id="3-click-the-logo-url-field"></a>
<a id="4-find-your-logo-image"></a>
<a id="5-right-click-on-the-logo-image"></a>
<a id="6-copy-the-image-address"></a>
<a id="7-switch-back-to-litellm"></a>
<a id="8-paste-the-logo-url"></a>
<a id="9-save-changes"></a>

1. Open **Settings → UI Theme**.
2. Paste a hosted image URL into **Logo URL**. Optionally set **Custom Logo URL (dark mode)**.
3. Click **Save Changes**. The logo appears in the dashboard sidebar and login page.

<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
  <Image img={require('../../../img/admin_settings_ui_theme.png')} />
  <Image img={require('../../../img/admin_settings_ui_theme_logo.png')} />
</div>

## Dark Mode Logo

Set **Custom Logo URL (dark mode)** or `UI_LOGO_PATH_DARK` for artwork designed for a dark background. If it is unset or cannot be loaded, dark mode reuses the light logo. Setting only a dark logo leaves light mode on the default LiteLLM logo.

## Via the API

### Set a Custom Logo

```bash
curl -X PATCH 'http://localhost:4000/update/ui_theme_settings' \
  -H 'Authorization: Bearer <your-admin-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "logo_url": "https://example.com/your-company-logo.png",
    "logo_url_dark": "https://example.com/your-company-logo-dark.png"
  }'
```

`logo_url_dark` is optional. Omit it and dark mode reuses `logo_url`.

### Set a Custom Favicon

You can also customize the browser tab favicon:

```bash
curl -X PATCH 'http://localhost:4000/update/ui_theme_settings' \
  -H 'Authorization: Bearer <your-admin-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "logo_url": "https://example.com/your-company-logo.png",
    "favicon_url": "https://example.com/your-favicon.ico"
  }'
```

### Get Current Theme Settings

```bash
curl -X GET 'http://localhost:4000/get/ui_theme_settings'
```

### Reset to Default Logo

Send an empty `logo_url` to restore the default LiteLLM logo:

```bash
curl -X PATCH 'http://localhost:4000/update/ui_theme_settings' \
  -H 'Authorization: Bearer <your-admin-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "logo_url": ""
  }'
```

## Via `proxy_config.yaml`

You can also set the logo URL in your proxy configuration file:

```yaml
litellm_settings:
  ui_theme_config:
    logo_url: "https://example.com/your-company-logo.png"
    logo_url_dark: "https://example.com/your-company-logo-dark.png"  # optional
    favicon_url: "https://example.com/your-favicon.ico"  # optional
```

## Environment variables {#set-custom-logo}

Set `UI_LOGO_PATH` to a hosted image URL or a file available inside the proxy container. Hosted images are easier to configure and troubleshoot.

```bash
UI_LOGO_PATH="https://example.com/your-company-logo.png"
UI_LOGO_PATH_DARK="https://example.com/your-company-logo-dark.png"
```

For a local image:

```bash
UI_LOGO_PATH="ui_images/logo.jpg"
```

You can also declare the variables in the proxy configuration:

```yaml
environment_variables:
  UI_LOGO_PATH: "https://example.com/your-company-logo.png"
  UI_LOGO_PATH_DARK: "https://example.com/your-company-logo-dark.png"
```

## Set a custom color theme {#set-custom-color-theme}

1. Open the [enterprise UI color template](https://github.com/BerriAI/litellm/blob/main/enterprise/enterprise_ui/_enterprise_colors.json).
2. In `enterprise/enterprise_ui`, rename `_enterprise_colors.json` to `enterprise_colors.json`.
3. Set your colors using the [supported color palette](https://www.tremor.so/docs/layout/color-palette#default-colors). For example:

```json
{
  "brand": {
    "DEFAULT": "teal",
    "faint": "teal",
    "muted": "teal",
    "subtle": "teal",
    "emphasis": "teal",
    "inverted": "teal"
  }
}
```

4. Deploy the LiteLLM proxy with the updated file.

## Supported Logo Formats

| Format | Supported |
|--------|-----------|
| JPEG / JPG | Yes |
| PNG | Yes |
| SVG | Yes |
| ICO (favicon only) | Yes |
| HTTP/HTTPS URL | Yes |
| Local file path | Yes |
