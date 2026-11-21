---
title: "Docker Compose on a server"
description: "Run standalone Lens and ClickHouse on one server with persistent storage and HTTPS."
slug: "/proxy/lens/deployment/server"
---

# Docker Compose on a server

Install Docker with Compose v2, then run the [v0.1.0 release bundle](https://github.com/BerriAI/lens/releases/tag/v0.1.0) on your server. It needs no Git, pulls the published image by digest, and can be [verified](./releases.md#verify-a-release) before you run it:

```sh
curl -fLO https://github.com/BerriAI/lens/releases/download/v0.1.0/lens-install-0.1.0.tar.gz
tar xzf lens-install-0.1.0.tar.gz
cd lens-0.1.0
./start
```

The script generates credentials in `deploy/lens/.env` and starts Lens with ClickHouse. Sign in at `/ui/` by pasting the `LENS_ADMIN_TOKEN` value from that file into the **Setup token** field. Stop with `docker compose -f deploy/lens/compose.yaml down` and restart with `./start`. Keep the extracted bundle, environment file and persistent volume

For help configuring an existing deployment, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md). To connect the Lens service to an existing gateway, use [Add Lens to LiteLLM](./litellm.md#docker-compose)

## Configure the public address {#1-configure-the-services}

Point a hostname such as `lens.example.com` at your server and provision its TLS certificate. The initial setup already wrote a `LENS_PUBLIC_URL` line to `deploy/lens/.env`. Edit that line instead of adding a second one:

```dotenv
LENS_PUBLIC_URL=https://lens.example.com
```

Replace the hostname with yours. This controls the browser origin, generated tracing address and secure session cookies. Keep the generated admin token and ClickHouse password unchanged

## Apply the configuration {#2-start-the-services}

From the extracted `lens-0.1.0` directory:

```sh
docker compose -f deploy/lens/compose.yaml up -d --wait
```

The starter binds Lens to `127.0.0.1:4318` and keeps ClickHouse on an internal network. When a reverse proxy runs in another container or host, use the [deployment network settings](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md#configure-a-deployment) to give it a reachable private Lens address

## Route HTTPS traffic {#3-route-https-traffic}

Forward the standalone UI and API paths to Lens. This example uses HAProxy, the same L7 proxy as the [LiteLLM gateway example](../../deploy/ha/haproxy.md), running on the same host. HAProxy reads the certificate and its private key from one file, so join them first:

```sh
sudo mkdir -p /etc/haproxy/certs
sudo sh -c 'cat /etc/letsencrypt/live/lens.example.com/fullchain.pem \
  /etc/letsencrypt/live/lens.example.com/privkey.pem \
  > /etc/haproxy/certs/lens.example.com.pem'
sudo chmod 600 /etc/haproxy/certs/lens.example.com.pem
```

Save this configuration with your hostname in the certificate path:

```text title="/etc/haproxy/haproxy.cfg"
defaults
    mode http
    timeout connect 5s
    timeout client 300s
    timeout server 300s

frontend lens_https
    bind :443 ssl crt /etc/haproxy/certs/lens.example.com.pem
    http-request set-header X-Forwarded-Proto https
    option forwardfor
    default_backend lens

backend lens
    option httpchk GET /health/ready
    http-check expect status 200
    server lens 127.0.0.1:4318 check
```

Check and reload HAProxy using your host's service manager. On a systemd host:

```sh
sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl reload haproxy
```

Allow inbound HTTPS on port 443. Keep the database private and preserve the container's shipped filesystem, sandbox and resource settings

## Check the installation {#4-check-the-installation}

Open `https://lens.example.com/ui/` using your hostname and paste the generated admin token into the **Setup token** field. Complete the [first-trace check](../deployment.md#check-the-installation) from the agent's actual network. If you enabled investigations, verify one bounded investigation as well

Use [Back up and restore Lens](https://github.com/BerriAI/lens/blob/main/docs/backup.md) to retain the data, Keeper state, credentials and exact image together. Store backups outside this server and rehearse a restore. The supported database topology is one ClickHouse server; moving to external storage does not itself provide replication or automatic failover
