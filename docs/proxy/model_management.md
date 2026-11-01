import Image from '@theme/IdealImage';

# Model Management

When `STORE_MODEL_IN_DB` is on, your models live in the database rather than in a static `config.yaml`. That means day-2 changes happen right in the Admin UI: adding a model, editing pricing, rotating a provider key, or retiring a deployment, all with no config edits and no proxy restart.

This page covers those ongoing operations. If you are adding your very first model, start with the [Quickstart](./docker_quick_start.md), which walks you through startup, provider connection, and your first request. Come back here once the gateway is running and you want to manage the models you have.

## The model list

Go to **Models + Endpoints** and open the **All Models** tab to see every model the gateway currently serves. Each row shows the public model name, the underlying provider and litellm model, and the input and output cost per token that LiteLLM maps automatically from its [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json).

A badge on each model tells you where it came from: models added through the UI or API carry a database badge, while models loaded from `config.yaml` are marked as config. This distinction matters because config models cannot be edited from the UI (see [Database vs config.yaml models](#database-vs-configyaml-models) below). Use the search box and the provider filters to narrow a long list down to the models you care about.

<Image img={require('../../img/ui_models_table.png')} alt="All Models list in the Admin UI" />

## Inspect and edit a model

Click a Model ID in the list to open its detail page. The **Overview** tab summarizes the model's settings and provider, and the **Raw JSON** tab shows the full stored definition, useful when you want to confirm exactly what the gateway is holding.

Click **Edit Settings** to change the model in place. You can update the public model name that clients call, the litellm model name that requests are routed to, and the input and output cost per 1M tokens when you want to override the mapped pricing. Save, and the change takes effect immediately for new requests.

Two more actions live on this page. **Test Connection** re-verifies the model against the provider using its stored credentials, so you can confirm a key still works or that a newly edited setting is valid before clients hit it. **Delete Model** removes the model from the gateway; for database models this deletes the stored definition outright.

<Image img={require('../../img/ui_model_detail.png')} alt="Model detail page with Edit Settings, Test Connection, and Delete Model" />

## Reusable provider credentials

Most deployments have several models behind the same provider account. Rather than paste the same API key into every model, create a named credential once and reuse it.

Open the **LLM Credentials** tab and click **Add Credential**. Pick your provider, enter the API key, and give the credential a name. The fields adapt to the provider you choose, so selecting Vertex AI, for example, gives you `Vertex Project`, `Vertex Location`, and `Vertex Credentials` instead of a single key field.

<Image
  img={require('../../img/ui_add_credential.png')}
  dark={require('../../img/ui_add_credential_dark.png')}
  alt="Add New Credential modal with OpenAI selected as the provider"
/>

Once saved, the credential is available wherever you add or edit a model. In the Add Model form, choose it from the **Existing Credentials** dropdown instead of typing a key. From a model's detail page you can also go the other way with the **Re-use Credentials** button, which turns the credentials of a model you already configured into a named credential for future models. Models attached to a named credential are tagged `Credential: <name>` in the Usage page, so you can filter spend by credential without any extra setup; see [Credential Usage Tracking](./credential_usage_tracking.md).

## Database vs config.yaml models

Storing models in the database is what makes UI-driven management possible. Turn it on by setting `STORE_MODEL_IN_DB="True"` as an environment variable, or `general_settings.store_model_in_db: true` in your config. You can also toggle it at runtime from the **Models + Endpoints** settings in the UI, which is handy for cloud deployments where editing the config means a full release. The toggle only works when `store_model_in_db` is not declared in your `config.yaml`. If the file declares it, the file value wins and saving the toggle returns a 400, so change it in the config instead (before v1.103.0 the UI value overrode the config value).

With it enabled, every model you add through the UI or the API persists in the database and survives restarts and additional proxy instances. Provider credentials for those models are encrypted at rest using `LITELLM_SALT_KEY` (falling back to `LITELLM_MASTER_KEY` if the salt key is not set); keep that value secret and never change it once models exist, since credentials encrypted with the old value cannot be decrypted with a new one.

Database storage does not replace your `config.yaml`. Any models defined there keep working and show up alongside your database models. The one difference is that config models are owned by the file, so they cannot be edited or deleted from the UI; change them in the config and reload. For the config format itself, see [Config.yaml](./configs.md).

Settings behave differently from models here. In `general_settings`, `router_settings`, `litellm_settings`, and `environment_variables`, a key declared in your `config.yaml` is owned by the file and wins over anything stored in `LiteLLM_Config`, and the UI and `/config/update` refuse to change it with a 400. Keys the file does not declare are owned by the database, so those are the ones the UI sets. Before v1.103.0 it was the other way around, and the database value won over the YAML. See [config.yaml vs database settings](./configs.md#configyaml-vs-database-settings).

### Choose one source of truth for models

For production deployments, use one primary source of truth for model definitions:

| Approach | Storage | Restart required for model changes? | Best for |
| --- | --- | --- | --- |
| `config.yaml` | Configuration file | Yes. Reload or restart the proxy tasks after changing the file. | GitOps workflows where every model change is deployed with the application. |
| Admin UI, management API, or Terraform | LiteLLM database | No. Changes apply to new requests after the write succeeds. | Day-2 operations, frequent model changes, and centralized automation. |

LiteLLM can load file-based and database-backed models at the same time, but using both as model-management systems creates two sources of truth. A model loaded from `config.yaml` remains owned by that file and cannot be edited or deleted through the UI. Keep model definitions in one system, and continue using `config.yaml` or environment variables for infrastructure settings that are not exposed through the management API.

The [LiteLLM Terraform provider](https://github.com/BerriAI/terraform-provider-litellm) calls the same management API used by the Admin UI. It persists resources in the LiteLLM database, so you do not need to build a separate REST client or restart the proxy for model changes.

## Automation (API)

The same operations are available over HTTP, which is what you want for CI/CD or scripting bulk changes. These endpoints require `store_model_in_db` to be enabled; with it off, `POST /model/new` fails because there is nowhere to persist the model.

Add a model:

```bash
curl -X POST "http://0.0.0.0:4000/model/new" \
    -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model_name": "azure-{{openai_large}}",
      "litellm_params": {
        "model": "azure/{{openai_large}}",
        "api_key": "os.environ/AZURE_API_KEY",
        "api_base": "https://my-endpoint.openai.azure.com/"
      }
    }'
```

The rest of the operations:

| Operation | Route | Notes |
| --- | --- | --- |
| List models | `GET /model/info` | Returns the full model list with API keys masked |
| Update a model | `PATCH /model/{model_id}/update` | Change `litellm_params` or `model_info` for an existing model. The older `POST /model/update` changes `litellm_params` only |
| Delete a model | `POST /model/delete` | Body `{"id": "<model_id>"}`, admin only. This is a POST; there is no DELETE-verb route |

You can attach arbitrary `model_info` fields when you create or update a model, and they pass straight through to `GET /model/info` alongside the mapped cost and context data. That is the mechanism for annotating models with your own metadata, such as an owning team, a description, or a version, and reading it back programmatically.

## Reject chat calls on non-chat models

<SinceVersion v="1.109.0" />

`model_info.mode` and `model_info.supported_endpoints` are informational by default. To have the proxy enforce the list for chat-style requests, set `enforce_supported_endpoints: true` on the deployment next to a `supported_endpoints` list with no chat endpoint. The proxy then skips that deployment for chat-style requests without calling its provider, and the routes it does list, such as `/v1/embeddings`, work as before. Only chat-style requests are checked, so embeddings, image, audio, and other non-chat requests reach the deployment whatever its list says. The flag does nothing on its own. When `supported_endpoints` is missing or is not a list of strings, the deployment is not restricted and the proxy logs a warning naming it when the deployment is loaded.

```yaml
model_list:
  - model_name: my-embeddings
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: embedding
      supported_endpoints: ["/v1/embeddings"]
      enforce_supported_endpoints: true
```

The same `model_info` fields work through `POST /model/new` and `PATCH /model/{model_id}/update`, and a change applies to new requests without a restart. When no deployment behind the model name can take the request and no fallback answers, a chat call to `my-embeddings` returns:

```json
{
  "error": {
    "message": "/v1/chat/completions is not supported by model=my-embeddings. Supported endpoints: /v1/embeddings\n\nLiteLLM: model group 'my-embeddings' failed with the error above. No fallback was attempted.",
    "type": "invalid_request_error",
    "param": "model",
    "code": "400"
  }
}
```

The check covers `/v1/chat/completions`, `/v1/completions`, `/v1/responses` (including its WebSocket mode and `/v1/responses/compact`), the same routes without `/v1` or under Azure-style `/openai/deployments/<name>/` paths, `/v1/messages` (answered in the Anthropic error shape), the Gemini `generateContent` and `streamGenerateContent` routes, and `/v1beta/interactions`. On the Responses WebSocket the proxy sends an `error` event and closes the socket with code 1008. A `supported_endpoints` list that contains any of those endpoints, written with or without a `/v1`, `/v1beta` or `/openai` prefix, counts as chat-capable and is never enforced. Entries match regardless of case, a trailing slash, or a full Gemini path such as `/v1beta/models/<model>:generateContent`. An Azure deployment path such as `/openai/deployments/<name>/chat/completions` in the list does not count, so list `/v1/chat/completions` instead. The check applies the same way when the request names the deployment by its `model_info.id` or `litellm_params.model`, or reaches it through an alias or a wildcard route.

The flag is read per deployment. When a model name has several deployments, chat-style requests go only to the ones without the restriction, and the 400 comes only when every deployment behind the name is restricted. Without the flag, `mode` and `supported_endpoints` keep their informational behavior, and `mode` plays no part in the check either way.

When the model has fallbacks, the proxy moves on to them without calling the restricted deployment's provider. This covers router `fallbacks` and `default_fallbacks`, key and team `router_settings` fallbacks, and `fallbacks` in the request body, and a chain through another restricted model is followed until a model that serves chat answers. Since `default_fallbacks` applies to every model, a proxy that sets it to a chat model answers these requests from that model instead of returning the 400. A chain that reaches only restricted models, or loops back to them, keeps the 400, and so does `disable_fallbacks: true` or `fallbacks: []` in the request.

## Require rpm and tpm on new models

By default `rpm` and `tpm` are optional on a model, so a fleet can end up with some deployments rate limited and others unbounded. Set `enforce_rpm_tpm_on_model_add` in `general_settings` to require them <SinceVersion v="1.100.0" />.

```yaml
general_settings:
  enforce_rpm_tpm_on_model_add: true
```

With `true`, `POST /model/new` answers `400` unless `litellm_params` sets both `rpm` and `tpm` to a positive value. In the Admin UI's Add Model form, set them in the LiteLLM Params field under Advanced Settings, such as `{"rpm": 100, "tpm": 100000}`. Only models added through the API or the Admin UI are checked, so a model in `config.yaml`'s `model_list` still loads without `rpm` or `tpm`.

The setting also takes the same `default`, `providers`, and `models` mapping as [`enforce_project_model_quota`](project_management#per-provider-and-per-model-requirements), with the same precedence <SinceVersion v="1.109.0" />. A proxy older than 1.109.0 reads the mapping as `true` and requires both limits on every new model. A new model is matched against `models` entries by its `model_name`, or by the model it calls when it is a team model, and against `providers` by the provider in its `litellm_params`.

```yaml
general_settings:
  enforce_rpm_tpm_on_model_add:
    providers:
      vertex_ai: [rpm, tpm]
      runwayml: []
    models:
      "veo-*": [rpm]
```

With this mapping, a `runwayml/gen4.5` model can be added with no limits, a model whose `model_name` starts with `veo-` needs only `rpm`, and a Gemini model on Vertex AI needs both. A model update through `POST /model/update` or `PATCH /model/{id}/update` is checked only for the limits its new name and provider require that its old ones did not, so a model added as exempt cannot move to a provider that needs limits without setting them. The limits a model already needed are not checked again, so an update can lower or zero `rpm` and `tpm`, or remove them with `litellm_params_to_remove` on `PATCH /model/{id}/update`, and under `true` an update never fails this check. A malformed mapping makes model add and update answer `500` with an error naming `general_settings.enforce_rpm_tpm_on_model_add`.
