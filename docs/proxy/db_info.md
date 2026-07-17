# What is stored in the DB

The LiteLLM Proxy uses a PostgreSQL database to store various information. Here's are the main features the DB is used for:
- Virtual Keys, Organizations, Teams, Users, Budgets, and more.
- Per request Usage Tracking

## Link to DB Schema

You can see the full DB Schema [here](https://github.com/BerriAI/litellm/blob/main/schema.prisma)

## DB Tables

### Organizations, Teams, Users, End Users

| Table Name | Description | Row Insert Frequency |
|------------|-------------|---------------------|
| LiteLLM_OrganizationTable | Manages organization-level configurations. Tracks organization spend, model access, and metadata. Links to budget configurations and teams. | Low |
| LiteLLM_TeamTable | Handles team-level settings within organizations. Manages team members, admins, and their roles. Controls team-specific budgets, rate limits, and model access. | Low |
| LiteLLM_UserTable | Stores user information and their settings. Tracks individual user spend, model access, and rate limits. Manages user roles and team memberships. | Low |
| LiteLLM_EndUserTable | Manages end-user configurations. Controls model access and regional requirements. Tracks end-user spend. | Low |
| LiteLLM_TeamMembership | Tracks user participation in teams. Manages team-specific user budgets and spend. | Low |
| LiteLLM_OrganizationMembership | Manages user roles within organizations. Tracks organization-specific user permissions and spend. | Low |
| LiteLLM_InvitationLink | Handles user invitations. Manages invitation status and expiration. Tracks who created and accepted invitations. | Low |
| LiteLLM_UserNotifications | Handles model access requests. Tracks user requests for model access. Manages approval status. | Low |

### Authentication

| Table Name | Description | Row Insert Frequency |
|------------|-------------|---------------------|
| LiteLLM_VerificationToken | Manages Virtual Keys and their permissions. Controls token-specific budgets, rate limits, and model access. Tracks key-specific spend and metadata. | **Medium** - stores all Virtual Keys |

### Model (LLM) Management

| Table Name | Description | Row Insert Frequency |
|------------|-------------|---------------------|
| LiteLLM_ProxyModelTable | Stores model configurations. Defines available models and their parameters. Contains model-specific information and settings. | Low - Configuration only |

### Budget Management

| Table Name | Description | Row Insert Frequency |
|------------|-------------|---------------------|
| LiteLLM_BudgetTable | Stores budget and rate limit configurations for organizations, keys, and end users. Tracks max budgets, soft budgets, TPM/RPM limits, and model-specific budgets. Handles budget duration and reset timing. | Low - Configuration only |


### Tracking & Logging

| Table Name | Description | Row Insert Frequency |
|------------|-------------|---------------------|
| LiteLLM_SpendLogs | Detailed logs of all API requests. Records token usage, spend, and timing information. Tracks which models and keys were used. | **Medium - this is a batch process that runs on an interval.** |
| LiteLLM_DailyUserSpend and siblings (DailyTeamSpend, DailyOrgSpend, DailyTagSpend, DailyEndUserSpend, DailyAgentSpend) | Pre-aggregated daily spend rollups per user, team, org, tag, end user, and agent; the Admin UI Usage views read these aggregates rather than scanning SpendLogs. | Low - one row per entity per day, updated in batches |
| LiteLLM_AuditLog | Tracks changes to system configuration. Records who made changes and what was modified. Maintains history of updates to teams, users, and models. | **Off by default**, **High - Runs on every change to an entity** |

## Disable `LiteLLM_SpendLogs`

Set `disable_spend_logs: True` or `disable_error_logs: True` under `general_settings` to stop writing those tables. With spend logs disabled you lose per-request log detail in the UI but keep cost metrics in your logging integrations (s3, Prometheus, Langfuse); with error logs disabled you lose the Errors view in the UI but keep errors in application logs and other logging integrations. See [keeping error logs out of the database](./prod.md#keep-error-logs-out-of-the-database) in the production checklist.


## Migrating Databases 

If you need to migrate Databases the following Tables should be copied to ensure continuation of services and no downtime


| Table Name | Description | 
|------------|-------------|
| LiteLLM_VerificationToken | **Required** to ensure existing virtual keys continue working |
| LiteLLM_UserTable | **Required** to ensure existing virtual keys continue working |
| LiteLLM_TeamTable | **Required** to ensure Teams are migrated |
| LiteLLM_TeamMembership | **Required** to ensure Teams member budgets are migrated |
| LiteLLM_BudgetTable | **Required** to migrate existing budgeting settings |
| LiteLLM_OrganizationTable | **Optional** Only migrate if you use Organizations in DB |
| LiteLLM_OrganizationMembership | **Optional** Only migrate if you use Organizations in DB | 
| LiteLLM_ProxyModelTable | **Optional** Only migrate if you store your LLMs in the DB (i.e you set `STORE_MODEL_IN_DB=True`) |
| LiteLLM_SpendLogs | **Optional** Only migrate if you want historical data on LiteLLM UI |
| LiteLLM_ErrorLogs | **Optional** Only migrate if you want historical data on LiteLLM UI |


