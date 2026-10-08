---
title: "Upgrade Lens"
description: "Update an installed Lens deployment while preserving its data and credentials."
slug: "/proxy/lens/deployment/upgrades"
---

# Upgrade Lens

To update an installed Lens deployment to a later release:

1. Read the release notes and select matching LiteLLM and Lens images, or the chart version for that release.
2. Pause scheduled investigations and finish or cancel active runs. Update the images through the same Docker or Helm deployment process you used to install Lens.
3. [Check the installation](../deployment.md#check-the-installation) and run an investigation before resuming schedules.

Keep your databases, encryption keys, shared service secret, and public trace URL. Reuse your environment or values file. For the local stack, update the saved version and start the matching images:

```bash
python3 deploy/lens/configure.py --version "<next-release-version>"
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

Normal Helm upgrades reuse generated credentials. Helm retains the generated secrets on uninstall, and Kubernetes retains the ClickHouse volume. Back them up together. Changing the database, storage class, or secret reference requires a separate data migration plan.

Do not run `docker compose down -v`; it deletes the database volumes.
