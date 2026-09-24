# Rotating the Master Key

The master key is the proxy's admin credential; it authenticates admin API calls and logs you into the Admin UI. In some deployments it is also the key used to encrypt credentials at rest in the database: the proxy signs stored data (model `litellm_params`, credentials, MCP server credentials, DB-stored environment variables) with `LITELLM_SALT_KEY` when it is set, and falls back to the master key only when no salt key is configured. How you rotate the master key depends on which of those roles it plays, and getting this wrong can leave your stored credentials unreadable, so read the case that matches your setup before running anything.

:::warning

If you set a [salt key](./prod.md#set-the-salt-key), the proxy decrypts stored credentials with the salt key, not the master key. Do not rotate the master key with `POST /key/regenerate` and `new_master_key` in that setup. That flow re-encrypts everything under the new master key, but the running proxy keeps decrypting with the salt key, so every stored credential becomes unreadable and the deployment can be bricked. Follow the salt-key section below instead.

:::

Back up your database before either flow. Model re-encryption deletes and recreates rows rather than updating them in place, and credential re-encryption skips any row that fails, so a partial failure can strand data. A backup lets you revert cleanly.

Virtual keys are stored hashed, not encrypted, so they keep working after either rotation. Only models stored in the database (`store_model_in_db`) are re-encrypted by the regenerate flow; models defined in your config file are not affected. This is available on the open-source build; master-key rotation is not gated behind the enterprise tier. There is no Admin UI flow for this by design; you rotate through the API or at boot.

## If you use a salt key (recommended setup)

When `LITELLM_SALT_KEY` is set, the salt key encrypts and decrypts your stored credentials, and the master key is only an auth credential. Rotating it does not touch anything encrypted at rest, so there is nothing to re-encrypt.

Generate a new master key value, update wherever the secret lives (the `LITELLM_MASTER_KEY` environment variable, or `general_settings.master_key` in your config), and restart every proxy instance so they pick up the new value. Do not call `POST /key/regenerate` with `new_master_key` here; that would re-encrypt your credentials under a key the proxy never uses to decrypt.

Do not rotate `LITELLM_SALT_KEY` itself. It must not change after you have added a model; there is no in-place migration for salt-key rotation, so every stored credential would need to be re-registered.

## If the master key is your encryption key

When no salt key is set, the master key doubles as the at-rest encryption key, so rotating it requires re-encrypting stored data.

:::tip[Prefer a dedicated salt key]
Before you rotate, consider setting a permanent `LITELLM_SALT_KEY` so future master-key rotations become the no-migration flow above. Set the salt key to your current master key value first (so existing data still decrypts), then rotate the master key freely afterwards.
:::

You can do this against a running proxy with `POST /key/regenerate`, as described below, or at boot with `LITELLM_MIGRATE_FROM_MASTER_KEY`, which needs no running proxy and [covers more stored values](#boot-time-migration).

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

What to do next depends on whether the old key encrypted anything in your database. The proxy works that out for you. When a database is configured and `LITELLM_SALT_KEY` is not set, it connects during the refusal and counts the stored values that decrypt under the unsafe key, and the steps it prints depend on the result.

### Nothing is encrypted with the old key

This is the case when the count is 0, when there is no database, or when `LITELLM_SALT_KEY` is set. There is nothing to migrate, so the error only tells you to replace the key. If the key came from `general_settings.master_key`, it first tells you to make sure your config reads the key from the environment. The step that sets the new key depends on whether `LITELLM_MASTER_KEY` is already set in the proxy's environment.

When the variable is not set at all, the error prints a command that generates a key and saves it to `.env`. [Where to set the new key](#where-to-set-the-new-key) covers setups that do not read a `.env` file.

```bash
echo "LITELLM_MASTER_KEY=sk-$(openssl rand -hex 32)" | tee -a .env
```

When the variable is already set to an unsafe value (`sk-1234` or empty), the error prints a command that only generates a key. Put the new key in place of the current `LITELLM_MASTER_KEY` value wherever that is set: a shell export, your container or deployment environment, or its line in `.env`. Do not just add it to `.env`. The proxy loads `.env` without overriding variables that already exist, so a value already exported in the environment wins and an appended line would never take effect.

```bash
echo "sk-$(openssl rand -hex 32)"
```

Then start the proxy again. This is the same swap and restart as [rotating with a salt key](#if-you-use-a-salt-key-recommended-setup). Do not call `POST /key/regenerate` with `new_master_key` when `LITELLM_SALT_KEY` is set. As the warning at the top of this page explains, that leaves your stored credentials unreadable.

### The database holds values encrypted with the old key

When no salt key is set, the master key also encrypts the credentials stored in your database, so replacing it alone would make them unreadable. The error says so, with the number of values it found:

```text
Your database holds 6 value(s) encrypted with this master key,
which encrypts stored credentials while LITELLM_SALT_KEY is not set. Replacing the key alone makes them
unreadable, so also tell the proxy which key to migrate from:
```

If the database cannot be reached during the refusal, the first line is "Your database could not be checked for values encrypted with this master key," instead, and the same steps follow. Following them is safe either way, because the migration does nothing when there is nothing to migrate.

You tell the proxy which key to migrate from with `LITELLM_MIGRATE_FROM_MASTER_KEY`, and the next boot re-encrypts the stored values under the new master key. You do not need a running proxy, the local development override, or a call to `POST /key/regenerate`. Back up your database first, as with any rotation on this page. If the old key came from `general_settings.master_key`, the error's first step is to make your config read the key from the environment, as shown in [Where to set the new key](#where-to-set-the-new-key).

1. Set `LITELLM_MIGRATE_FROM_MASTER_KEY` to the old key in the same place as `LITELLM_MASTER_KEY`: a shell export, your container or deployment environment, or `.env`. Use an empty value, `LITELLM_MIGRATE_FROM_MASTER_KEY=`, when the old key was empty.

   ```bash
   export LITELLM_MIGRATE_FROM_MASTER_KEY=sk-1234
   ```

2. Generate a new key and set it as `LITELLM_MASTER_KEY`. When the variable is already set, put the new key in place of the current value.

   ```bash
   echo "sk-$(openssl rand -hex 32)"
   ```

   When nothing sets `LITELLM_MASTER_KEY` yet, which happens when the old key was a literal in `config.yaml`, the error prints commands that save both values to `.env` instead.

   ```bash
   echo 'LITELLM_MIGRATE_FROM_MASTER_KEY=sk-1234' | tee -a .env
   echo "LITELLM_MASTER_KEY=sk-$(openssl rand -hex 32)" | tee -a .env
   ```

3. Start the proxy again. Right after the database connects, and before any traffic is served, the proxy re-encrypts every stored value that decrypts under the previous key. It logs this at WARNING, so the lines show up at the default log level, among the first lines of the log.

   ```text
   Re-encrypting 6 stored value(s) from the LITELLM_MIGRATE_FROM_MASTER_KEY key to the new master key.
   Done re-encrypting 6 stored value(s) with the new master key. You may now delete the LITELLM_MIGRATE_FROM_MASTER_KEY environment variable.
   ```

4. Delete `LITELLM_MIGRATE_FROM_MASTER_KEY`, then verify as described in [After rotating](#after-rotating). Leaving the variable set does no harm. Each boot then logs one notice: "LITELLM_MIGRATE_FROM_MASTER_KEY is still set, but nothing in the database is left to migrate from that key. You may now delete LITELLM_MIGRATE_FROM_MASTER_KEY."

`LITELLM_MIGRATE_FROM_MASTER_KEY` only takes effect together with a safe master key. If you set it while `LITELLM_MASTER_KEY` is still unset, empty, or `sk-1234`, the proxy refuses to start again.

If a stored value is edited while the migration runs, that value is left as it was and the log says "Re-encrypted N stored value(s), but M are still encrypted with the previous key because they changed during the migration. Keep LITELLM_MIGRATE_FROM_MASTER_KEY set and restart the proxy to migrate them." Do what it says and restart once more.

A database error during the migration stops the boot, so a worker never serves traffic with stored values it cannot read. The proxy logs this at WARNING and then exits with a non-zero status:

```text
Could not migrate stored values from the LITELLM_MIGRATE_FROM_MASTER_KEY key (<ErrorType: message>). Values still encrypted with the previous key cannot be read until the migration succeeds. Keep LITELLM_MIGRATE_FROM_MASTER_KEY set and restart the proxy once the database is reachable.
```

Fix the database problem and start the proxy again with the same two variables. The next boot picks up where the failed one stopped: if it had migrated 2 of 6 values, the next boot logs "Re-encrypting 4 stored value(s)" followed by the "Done" line. The one exception follows the rule the proxy already applies to its database connection at boot. When `general_settings.allow_requests_on_db_unavailable` is true and the error is a connection outage, the boot continues, and the values still encrypted with the previous key stay unreadable until a later boot completes the migration.

Do not add `LITELLM_SALT_KEY` during these steps. With a salt key set the proxy expects stored values to be encrypted with the salt key, so it skips the migration and logs that there is nothing to migrate, and the values still encrypted with the old key stay unreadable. Once the migration is done, consider moving to a dedicated salt key, as the tip in [If the master key is your encryption key](#if-the-master-key-is-your-encryption-key) describes, so that later rotations are a swap and restart.

### What the boot-time migration covers {#boot-time-migration}

The migration works for any previous master key, not only the unsafe ones, so it is also an offline alternative to `POST /key/regenerate` with `new_master_key`: set the new `LITELLM_MASTER_KEY`, set `LITELLM_MIGRATE_FROM_MASTER_KEY` to the old one, and restart. It is idempotent, and it is safe when several workers or replicas boot at once, because each row is updated only if it still holds the value that was read. It reads and writes through the primary database even when a read replica is configured. Tables or columns that do not exist on an older schema are skipped, so it works both before and after a schema upgrade. Virtual keys keep working because they are stored hashed, not encrypted. With no database connected, the proxy logs that nothing was migrated.

It re-encrypts more than the regenerate call does: models stored in the database (`litellm_params`), credentials, `LiteLLM_Config` values (environment variables, CloudZero and Vantage settings and so on), SSO settings, cache settings, config overrides, MCP server credentials, static headers and environment variables, MCP OAuth client credentials, per-user MCP credentials and environment variables, SSO identity assertions, and the encrypted callback variables in team, key, and user metadata, including the deleted-team and deleted-key tables.

### Where to set the new key

The new key has to reach the proxy as the `LITELLM_MASTER_KEY` environment variable. A `.env` file in the working directory is only read when you run the proxy from a checkout of the repo or load the file through Docker Compose `env_file`. With a pip install, plain `docker run`, or Kubernetes, pass the variable to the process or container directly.

If `LITELLM_MASTER_KEY` is already set somewhere, such as a shell export, the container or deployment environment, or a line in `.env`, replace the value there instead of appending a new line to `.env`. The proxy loads `.env` without overriding variables that are already in the environment, so an exported value wins over the file.

If the old key is written as a literal under `general_settings.master_key`, make sure your `config.yaml` reads the key from the environment, because a literal in the config takes precedence over the environment variable.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Changing the master key signs everyone out of the Admin UI, because UI session tokens are signed with it. Log in again with the new key.
