---
title: "Docker Compose on a server"
description: "Run LiteLLM and Lens on one server with persistent storage and HTTPS."
slug: "/proxy/lens/deployment/server"
---

# Docker Compose on a server

This setup runs LiteLLM, Lens, PostgreSQL, and ClickHouse on one server. If LiteLLM already runs in Compose, [add Lens to that project](./docker-compose.md). To try Lens on your computer, use the [local quickstart](./local.md).

You need Git, Python {{python_min_version}} or later, Docker with Compose, and NGINX installed on the host. Point `llm.example.com` and `traces.example.com` at the server and obtain TLS certificates for both. The example below uses certificates stored under `/etc/letsencrypt/live/`.

This is a single-server deployment. Keep database backups outside the server. For replication and independent service scaling, use [Kubernetes](./kubernetes.md) with [external ClickHouse](./storage.md#external-clickhouse).

## 1. Configure the services

Select a [release with published Lens images](./releases.md). Replace `RELEASE_VERSION` with its version without the `v` prefix, then clone that release:

```bash
export LITELLM_VERSION="RELEASE_VERSION"
git clone --depth 1 --branch "v${LITELLM_VERSION}" https://github.com/BerriAI/litellm.git
cd litellm
```

Generate the configuration:

```bash
python3 deploy/lens/configure.py --version "$LITELLM_VERSION"
```

The helper saves generated credentials in `deploy/lens/.env`. Add your public trace address to that file:

```dotenv
LITELLM_LENS_PUBLIC_URL=https://traces.example.com
```

Back up this file with the database volumes. Running the helper again preserves the credentials. Keep the file out of Git.

## 2. Start the services

```bash
docker compose --env-file deploy/lens/.env -f deploy/lens/stack.yaml up -d --wait
```

LiteLLM listens on `127.0.0.1:4000`, and Lens listens on `127.0.0.1:4318`. PostgreSQL and ClickHouse stay on internal Docker networks.

## 3. Route HTTPS traffic

Save this as `/etc/nginx/conf.d/litellm.conf`. Replace the hostnames and certificate paths with yours:

```nginx title="/etc/nginx/conf.d/litellm.conf"
server {
    listen 443 ssl;
    server_name llm.example.com;
    ssl_certificate /etc/letsencrypt/live/llm.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/llm.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}

server {
    listen 443 ssl;
    server_name traces.example.com;
    ssl_certificate /etc/letsencrypt/live/traces.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/traces.example.com/privkey.pem;
    client_max_body_size 16m;

    location /v1/ {
        proxy_pass http://127.0.0.1:4318;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location / { return 404; }
}
```

Check the configuration, then reload NGINX:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Allow inbound HTTPS on port `443`. Keep ports `4000` and `4318` bound to localhost. The Lens route exposes `/v1/` and leaves its internal APIs private.

## 4. Check the installation

1. Open `https://llm.example.com/ui/`, using your hostname.
2. Sign in as `admin` with the `LITELLM_MASTER_KEY` from `deploy/lens/.env`.
3. Open **Lens > Set up Lens**. Check that **Traces endpoint** is `https://traces.example.com/v1/traces` with your hostname.
4. Click **Generate tracing key**, then **Send a test trace** and **View trace**.

The test trace does not call a model. To run your agent through LiteLLM, add a provider model under **Models** and create a model key under **Virtual Keys**. Then [send your first agent trace](../first-trace.md).

If the check fails, use [Troubleshooting](./configuration.md#troubleshooting). For future releases, follow [Upgrade Lens](./upgrades.md).
