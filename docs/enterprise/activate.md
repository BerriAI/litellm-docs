---
title: Activate your license
description: Set LITELLM_LICENSE on each LiteLLM gateway instance, confirm that the gateway shows Enterprise Edition, and see which features the license key enables.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Activate your license

LiteLLM Enterprise is a license key for the gateway image that you run now. The key enables the Enterprise features. You do not install a different image, and you do not migrate data.

The license key is a JWT. LiteLLM gives you the key when you buy a license or start a [30-day trial](https://www.litellm.ai/enterprise#trial).

## Set the license key

Set `LITELLM_LICENSE` in the environment of each gateway instance. Then restart each instance.

<Tabs>
<TabItem value="env" label=".env file">

```env
LITELLM_LICENSE="eyJ..."
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker run \
  -e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
  -e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
  -e LITELLM_LICENSE="eyJ..." \
  -e STORE_MODEL_IN_DB=True \
  -p 4000:4000 \
  docker.litellm.ai/berriai/litellm:latest
```

</TabItem>
<TabItem value="kubernetes" label="Kubernetes">

Put the key in the Secret that your Deployment loads with `envFrom`:

```bash
kubectl create secret generic litellm-secrets \
  --from-literal=LITELLM_MASTER_KEY="sk-<paste-a-long-random-key>" \
  --from-literal=LITELLM_SALT_KEY="sk-<paste-a-long-random-salt>" \
  --from-literal=LITELLM_LICENSE="eyJ..." \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/litellm"
```

</TabItem>
<TabItem value="helm" label="Helm">

Create a Secret and list it in `environmentSecrets` in your values file:

```bash
kubectl create secret generic litellm-env-secret \
  --from-literal=LITELLM_LICENSE="eyJ..."
```

```yaml title="values.yaml"
environmentSecrets:
  - litellm-env-secret
```

</TabItem>
</Tabs>

You can also set the key as `litellm_license` in `general_settings`, or keep an encrypted key in `LITELLM_SECRET_AWS_KMS_LITELLM_LICENSE` for AWS KMS. Refer to the [configuration reference](../proxy/config_settings.md).

If you run the gateway in more than one region, use the same key in each region. Each instance does a check of the key independently. One license covers all the regions that share one database. Refer to [Multi-region deployment](../proxy/multi_region.md#licensing-across-regions).

## Verify the license

1. Open `http://<your-proxy-host>:<port>/` in a browser.
2. Find **Enterprise Edition** in the description of the API docs page.
3. If the page does not show **Enterprise Edition**, make sure that the key is correct and not expired.
4. Restart all the gateway instances fully, and then do the check again.

If you set `NO_DOCS`, the gateway does not show the API docs page. Do the check before you disable the API docs. Refer to [Restrict all API documentation](../proxy/configs.md#restrict-all-api-documentation-for-productionair-gapped-deployments).

## What the license enables

The [full feature list](../enterprise.md#full-feature-list) on the Overview page shows all the features that the key enables. Each feature page has an **Enterprise feature** note at the top. In the sidebar, these pages have an **Enterprise** label.

Some features have special conditions:

- SSO for the Admin UI is free for up to 5 users. For more users, you must have a license. Refer to [SSO for the Admin UI](../proxy/admin_ui_sso.md).
- Audit logs are on by default when the gateway has a license. Refer to [Audit logs](../proxy/multiple_admins.md).
- Some guardrail integrations need a license. Refer to [Which guardrails need a license?](../enterprise.md#guardrails-oss-vs-enterprise).
- Pages with a **Free Enterprise feature** note do not need a license. Examples are [managed files](../proxy/litellm_managed_files.md) and [managed batches](../proxy/managed_batches.md).
- [Billable request metering](../proxy/billing_metrics.md) needs the license key and the metering credentials from your LiteLLM onboarding.

## Next steps

- [Moving from OSS](./moving_from_oss.md): the checklist for a gateway that you run now.
- [Production rollout](../learn/enterprise_quickstart.md): the five steps for a new deployment.
