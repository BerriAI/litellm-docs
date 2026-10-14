---
title: "Docker Compose on a server"
description: "Run standalone Lens and ClickHouse on one server with persistent storage and HTTPS."
slug: "/proxy/lens/deployment/server"
---

# Docker Compose on a server

The [Lens source installation](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md) runs Lens and ClickHouse with Keeper from the public Lens repository. Install Git and Docker Compose v2, then follow the [local quickstart](./local.md) on your server. Keep its source commit, environment file and persistent volume. Published independent release artifacts are still being qualified

For help configuring an existing deployment, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md). To connect the Lens service to an existing gateway, use the [Compose integration guide](./docker-compose.md)

## Configure the public address {#1-configure-the-services}

Point a hostname such as `lens.example.com` at your server and provision its TLS certificate. After the initial setup, set this in `deploy/lens/.env`:

```dotenv
LENS_PUBLIC_URL=https://lens.example.com
```

Replace the hostname with yours. This controls the browser origin, generated tracing address and secure session cookies. Keep the generated admin token and ClickHouse password unchanged

## Apply the configuration {#2-start-the-services}

From the Lens repository root:

```sh
docker compose -f deploy/lens/compose.yaml up -d --wait
```

The starter binds Lens to `127.0.0.1:4318` and keeps ClickHouse on an internal network. When a reverse proxy runs in another container or host, use the [deployment network settings](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md#configure-a-deployment) to give it a reachable private Lens address

## Route HTTPS traffic {#3-route-https-traffic}

Forward the standalone UI and API paths to Lens. For NGINX running on the same host, save this configuration with your hostname and certificate paths:

```nginx title="/etc/nginx/conf.d/lens.conf"
server {
    listen 443 ssl;
    server_name lens.example.com;
    ssl_certificate /etc/letsencrypt/live/lens.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lens.example.com/privkey.pem;
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:4318;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

Check and reload NGINX using your host's service manager. On a systemd host:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Allow inbound HTTPS on port 443. Keep the database private and preserve the container's shipped filesystem, sandbox and resource settings

## Check the installation {#4-check-the-installation}

Open `https://lens.example.com/ui/` using your hostname and sign in with the generated admin token. Complete the [first-trace check](../deployment.md#check-the-installation) from the agent's actual network. If you enabled investigations, verify one bounded investigation as well

Use [Back up and restore Lens](https://github.com/BerriAI/lens/blob/main/docs/backup.md) to retain the data, Keeper state, credentials and exact image together. Store backups outside this server and rehearse a restore. The supported database topology is one ClickHouse server; moving to external storage does not itself provide replication or automatic failover
