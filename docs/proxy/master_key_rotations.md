# Rotating the Master Key

The master key is the proxy's admin credential; it authenticates admin API calls and logs you into the Admin UI. In some deployments it is also the key used to encrypt credentials at rest in the database: the proxy signs stored data (model `litellm_params`, credentials, MCP server credentials, DB-stored environment variables) with `LITELLM_SALT_KEY` when it is set, and falls back to the master key only when no salt key is configured. How you rotate the master key depends on which of those roles it plays, and getting this wrong can leave your stored credentials unreadable, so read the case that matches your setup before running anything.

:::warning

If you set a [salt key](./prod.md#set-the-salt-key), the proxy decrypts stored credentials with the salt key, not the master key. Do not rotate the master key with `POST /key/regenerate` and `new_master_key` in that setup. That flow re-encrypts everything under the new master key, but the running proxy keeps decrypting with the salt key, so every stored credential becomes unreadable and the deployment can be bricked. Follow the salt-key section below instead.

:::

Back up your database before either flow. Model re-encryption deletes and recreates rows rather than updating them in place, and credential re-encryption skips any row that fails, so a partial failure can strand data. A backup lets you revert cleanly.

Virtual keys are stored hashed, not encrypted, so they keep working after either rotation. Only models stored in the database (`store_model_in_db`) are re-encrypted by the regenerate flow; models defined in your config file are not affected. This is available on the open-source build; master-key rotation is not gated behind the enterprise tier. There is no Admin UI flow for this; rotation is API-only by design.

## If you use a salt key (recommended setup)

When `LITELLM_SALT_KEY` is set, the salt key encrypts and decrypts your stored credentials, and the master key is only an auth credential. Rotating it does not touch anything encrypted at rest, so there is nothing to re-encrypt.

Generate a new master key value, update wherever the secret lives (the `LITELLM_MASTER_KEY` environment variable, or `general_settings.master_key` in your config), and restart every proxy instance so they pick up the new value. Do not call `POST /key/regenerate` with `new_master_key` here; that would re-encrypt your credentials under a key the proxy never uses to decrypt.

Do not rotate `LITELLM_SALT_KEY` itself. It must not change after you have added a model; there is no in-place migration for salt-key rotation, so every stored credential would need to be re-registered.

## If the master key is your encryption key

When no salt key is set, the master key doubles as the at-rest encryption key, so rotating it requires re-encrypting stored data.

:::tip Prefer a dedicated salt key
Before you rotate, consider setting a permanent `LITELLM_SALT_KEY` so future master-key rotations become the no-migration flow above. Set the salt key to your current master key value first (so existing data still decrypts), then rotate the master key freely afterwards.
:::

Call `POST /key/regenerate` with the current master key as `key` and the new one as `new_master_key`. The proxy only rotates the master key when `key` is the current master key; with any other value it treats the call as a regular virtual key regeneration.

```bash
curl -L -X POST 'http://localhost:4000/key/regenerate' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "key": "sk-<current-master-key>",
  "new_master_key": "sk-PIp1h0RekR"
}'
```

This re-encrypts stored models, the `environment_variables` saved in the config table, the credentials table, and the MCP server, user, and per-user environment credential tables under the new master key. It returns the new key:

```json
{
  "key": "sk-PIp1h0RekR",
  "token": "sk-PIp1h0RekR",
  "key_name": "sk-PIp1h0RekR",
  "expires": null
}
```

The running process does not adopt the new key on its own, so finish with the steps below before it can decrypt what it just re-encrypted.

## After rotating

Update the master key everywhere the old value lived: the `LITELLM_MASTER_KEY` environment variable and your secret manager, and `general_settings.master_key` in your config if you set it there. If both are present, `general_settings.master_key` takes precedence over the environment variable, so make sure it holds the new value.

Restart every proxy instance so they load the new key. Then verify: log into the Admin UI with the new master key, and make a request to a DB-stored model with a LiteLLM key (the new master key or a virtual key) and confirm it succeeds.

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-PIp1h0RekR' \
-d '{
    "model": "{{openai_small}}",
    "messages": [
        {
            "content": "Hey, how'\''s it going",
            "role": "user"
        }
    ]
}'
```

If the UI loads and your stored models and credentials resolve, the rotation is complete.

## Proxy refuses to start on sk-1234 {#proxy-refuses-to-start}

The proxy exits at boot with a non-zero status and prints how to fix it when the master key it resolved is not set, is empty or only whitespace, or is the literal `sk-1234`. With no master key the proxy runs without authentication and accepts every request. `sk-1234` is the example key from LiteLLM's own docs and tutorials, so anyone who can reach the proxy can guess it.

What to do next depends on whether the old key encrypted anything in your database. It did only if the key was `sk-1234`, `LITELLM_SALT_KEY` is not set, and the proxy has a database. The startup error carries a rotation warning that links to this section in exactly that case. If your error has no such warning, follow the first case.

### A salt key is set, or there is no database

Nothing is encrypted with the master key, so there is nothing to rotate. This is the same swap and restart as [rotating with a salt key](#if-you-use-a-salt-key-recommended-setup). Generate a new key, [set it](#where-to-set-the-new-key), and restart.

```bash
echo "LITELLM_MASTER_KEY=sk-$(openssl rand -hex 32)" | tee -a .env
```

### No salt key, and a database with stored credentials

Your model API keys, credentials, MCP server credentials, and DB-stored environment variables are encrypted with `sk-1234` itself. If you swap the key and restart, the proxy can no longer decrypt them. They have to be re-encrypted under the new key first, and that needs a running proxy. Back up your database before you start, for the reasons given at the top of this page.

1. Leave the old key where it is and start the proxy once with the local development override, so that it boots on `sk-1234`. With Docker or Kubernetes, add the variable to the container's environment instead.

   ```bash
   export LITELLM_DANGEROUSLY_ALLOW_UNSAFE_PROXY=true
   litellm --config config.yaml
   ```

   While the override is on, the proxy still accepts `sk-1234`, so keep it off any network you do not trust and finish these steps in one sitting.

2. In another shell, generate the new key and keep it in a variable.

   ```bash
   export NEW_MASTER_KEY="sk-$(openssl rand -hex 32)"
   echo "$NEW_MASTER_KEY"
   ```

3. Call `POST /key/regenerate` with the old master key as both the bearer token and `key`, and the new key as `new_master_key`. This is the same request as in [If the master key is your encryption key](#if-the-master-key-is-your-encryption-key), and it re-encrypts the same stored values.

   ```bash
   curl -L -X POST 'http://localhost:4000/key/regenerate' \
   -H 'Authorization: Bearer sk-1234' \
   -H 'Content-Type: application/json' \
   -d "{
     \"key\": \"sk-1234\",
     \"new_master_key\": \"$NEW_MASTER_KEY\"
   }"
   ```

4. Stop the proxy, [set `LITELLM_MASTER_KEY` to the new key](#where-to-set-the-new-key), and remove the override (`LITELLM_DANGEROUSLY_ALLOW_UNSAFE_PROXY`, or `general_settings.dangerously_allow_unsafe_proxy` if you used the config setting). Restart every proxy instance, then verify as described in [After rotating](#after-rotating).

Once you are on the new key, consider moving to a dedicated salt key, as the tip in [If the master key is your encryption key](#if-the-master-key-is-your-encryption-key) describes, so that later rotations are a swap and restart. Wait until this rotation is done before you do, because setting `LITELLM_SALT_KEY` to `sk-1234` would leave your stored credentials encrypted under a publicly known value.

### Where to set the new key

The new key has to reach the proxy as the `LITELLM_MASTER_KEY` environment variable. A `.env` file in the working directory is only read when you run the proxy from a checkout of the repo or load the file through Docker Compose `env_file`. With a pip install, plain `docker run`, or Kubernetes, pass the variable to the process or container directly. If the `.env` file already has a `LITELLM_MASTER_KEY` line, delete the old one so that only the new value remains.

If the old key is written as a literal under `general_settings.master_key` in your `config.yaml`, change it to read from the environment, because a literal in the config takes precedence over the environment variable.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Changing the master key signs everyone out of the Admin UI, because UI session tokens are signed with it. Log in again with the new key.
