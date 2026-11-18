# Project Management UI

<EnterpriseFeature />

Manage projects directly from the LiteLLM Admin UI. Projects sit between teams and keys in your organizational hierarchy, enabling fine-grained access control and budget management for specific use cases or applications.

## Overview

Projects enable you to:

- Organize API keys by use case or application
- Set project-level budgets and rate limits
- Track spend and usage at the project level
- Control which models each project can access
- Maintain clear separation between different applications or teams

**Hierarchy**: `Organizations > Teams > Projects > Keys`

For detailed information about the project API and configuration, see [Project Management](./project_management.md).

## Prerequisites

- A valid LiteLLM Enterprise license
- Admin or Team Admin access
- At least one team created (projects belong to teams)
- The LiteLLM Admin UI running locally or remote

## Create and Manage Projects

Projects appear in the Admin UI sidebar under Access Control for Proxy Admins, Org Admins, and Team Admins. Create and manage them from the Projects page.

Without a valid Enterprise license, the Projects page shows an Enterprise notice and a trial link instead of project controls.

![Projects page with the Enterprise license notice](/img/projects-ga/projects-enterprise-notice.jpg)

### Step 1: Navigate to Projects

Click **"Projects"** in the sidebar.

![Projects under Access Control in the Admin UI sidebar](/img/projects-ga/projects-01-navigation.jpg)

### Step 2: Create a New Project

Click **"Create Project"**.

![Create New Project form](/img/projects-ga/projects-02-create-dialog.jpg)

### Step 3: Enter Project Name

Click the **"Project Name"** field and enter a name for your project.

![Project name and description entered for Documentation Assistant](/img/projects-ga/projects-03-project-name.jpg)

### Step 4: Select a Team

Choose which team this project belongs to. Projects are scoped to teams, so you can only access models and features available to that team.

![Product Engineering in the Team selector](/img/projects-ga/projects-04-select-team.jpg)

### Step 5: Configure Model Access

Select which models this project has access to. Available models are scoped to the team's allowed models.

![Allowed Models selector with the All Team Models option](/img/projects-ga/projects-05-model-access.jpg)

### Step 6: Create Project

Click **"Create Project"** to save your project.

![Documentation Assistant saved as an active project under Product Engineering](/img/projects-ga/projects-06-created.jpg)

## Use Cases

### Key Organization Within Teams

Organize API keys within a team by use case or application. Group related keys together in projects so you can manage budgets, model access, and permissions as a unit instead of individually.

### Cost Allocation

Assign projects to different cost centers or teams. Track spend per project and allocate costs back to the responsible team or business unit.

### Feature Rollout

Create a dedicated project for new features or experimental use cases. Control which models are available and set conservative rate limits during testing.

### Customer Segmentation

If you're a platform, create projects for different customer segments or use cases. Control resource allocation independently for each segment.

## Next Steps

After creating a project:

1. **Generate API Keys** – Create API keys scoped to your project for application use
2. **Set Budgets** – Configure project-level budget limits via the [Project Management API](./project_management.md)
3. **Track Spend** – View project-level spend in the Usage dashboard
4. **Manage Access** – Use [Access Groups](./access_groups.md) to control model and MCP server access

## Related Documentation

- [Project Management API](./project_management.md) – Full API reference for projects
- [Access Groups](./access_groups.md) – Define reusable access controls for models, MCP servers, and agents
- [Virtual Keys](./virtual_keys.md) – Create and manage API keys scoped to projects
- [Role-based Access Control](./access_control.md) – Organizations, teams, and user roles
- [Spend Logs](./spend_logs_deletion.md) – Track detailed request-level costs and usage
