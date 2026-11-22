---
title: Manage applications that serve customers
sidebar_label: Applications
description: See every application that calls LiteLLM for customers, control which ones may create new customers, and give an application its own surcharge.
---

# Manage applications that serve customers

<SinceVersion v="1.112.0" />

An application is one of your products that calls LiteLLM on behalf of customers, such as a chat assistant or a search feature. LiteLLM does not add a separate application record for you to maintain. One Gateway setting says what an application is, a Team, a Project or a Virtual Key, and every existing resource of that kind becomes an application. A request belongs to the application of the team, project or key it authenticated with.

Applications sit above the customer hierarchy. A request names the customer organization and member in [headers](./track-customer-spend.md), and LiteLLM takes the application from the key. Spend is tracked for the application, and for each customer inside it.

## See every application

Open Applications in the Customer Management section of the Admin UI sidebar. Before you choose what an application is, the page shows only that setting. After you choose, it lists every resource of that kind with its spend and budget, its customer surcharge, whether it may create new customers, and whether it has been configured. Select an application to change its settings.

To choose what an application is with the API, send the definition. The choice locks once an application has been configured.

```bash
curl -X PUT "$LITELLM_BASE_URL/management/v1/apps/definition" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource_type": "team"}'
```

`resource_type` is `team`, `project` or `virtual_key`. `GET /management/v1/apps/resources?resource_type=team` lists the resources of that kind, and `GET /management/v1/apps` lists the ones that have been configured.

## Control which applications create new customers

By default, the first request that names a customer organization or member LiteLLM has not seen creates it. This suits a product that onboards tenants on its own, and is too open when only one of your applications should be able to do that.

Each application has a switch, This app may create new customers. When it is off, a request from that application that names an unknown customer organization or member is refused with `403`, and nothing is created. Customers that already exist keep working through that application, whichever application or import created them.

```bash
curl -X PATCH "$LITELLM_BASE_URL/management/v1/apps/$APP_ID" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"auto_create_customers": false}'
```

A refused request names the header that carried the unknown customer.

```json
{
  "error": {
    "message": "Unknown customer in x-litellm-customer-org-alias. App search may not create customers.",
    "type": "auth_error",
    "param": "x-litellm-customer-org-alias",
    "code": "403"
  }
}
```

A request whose key belongs to no application follows a Gateway switch, Requests with no app may create new customers, shown under the application setting. It is on by default, so a working key keeps creating customers as before. Turn it off to refuse unknown customers from every key outside an application.

```bash
curl -X PUT "$LITELLM_BASE_URL/management/v1/apps/definition" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource_type": "team", "auto_create_customers_without_app": false}'
```

| Request | Switch | Unknown customer | Known customer |
|---|---|---|---|
| From an application | Application switch on (default) | Created, `200` | `200` |
| From an application | Application switch off | `403`, nothing created | `200` |
| From no application | Gateway switch on (default) | Created, `200` | `200` |
| From no application | Gateway switch off | `403`, nothing created | `200` |

A request with no customer headers is not affected by either switch. With a switch off, a request that sends an organization alias that does not exist together with a member that does is refused as well, so it is not charged to the member's existing organization.

## Give an application its own surcharge

The [customer surcharge](./customer-surcharge.md) adds a percentage to every request made for a customer. An application can carry its own percentage, which replaces the gateway-wide one for the requests that application makes for a customer. Set it in the application's settings as Surcharge on customer requests (%), or with the API as a fraction.

```bash
curl -X PATCH "$LITELLM_BASE_URL/management/v1/apps/$APP_ID" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customer_margin": 0.05}'
```

`customer_margin` is a fraction between 0 and 10, so `0.05` is 5%. Send `null` to go back to the gateway-wide surcharge.

| Application surcharge | Gateway surcharge | Request for a customer is surcharged |
|---|---|---|
| 5% | 2% | 5% |
| 0% | 2% | Not surcharged |
| Not set | 2% | 2% |
| 5% | Not set | 5% |

A request with no customer is never surcharged, even from an application that has a surcharge. Spend, budgets and the base cost and surcharge breakdown work the same way as for the gateway-wide surcharge.
