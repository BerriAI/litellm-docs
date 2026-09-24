import Image from '@theme/IdealImage';


# User Management Hierarchy

<Image img={require('../../img/litellm_user_heirarchy.png')} style={{ width: '100%', maxWidth: '4000px' }} />

LiteLLM supports a hierarchy of users, teams, organizations, and budgets.

- Organizations can have multiple teams. [API Reference](https://docs.litellm.ai/api-reference/#/organization%20management)
- Teams can have multiple users. [API Reference](https://docs.litellm.ai/api-reference/#/team%20management)
- Users can have multiple keys, and be on multiple teams. [API Reference](https://docs.litellm.ai/api-reference/#/budget%20management)
- Keys can belong to either a team or a user. [API Reference](https://docs.litellm.ai/api-reference/#/Customer%20Management)


:::info

See [Access Control](./access_control) for more details on roles and permissions.
:::