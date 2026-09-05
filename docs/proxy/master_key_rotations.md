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

Call `POST /key/regenerate` with the current master key and the new one.

```bash
curl -L -X POST 'http://localhost:4000/key/regenerate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
  "key": "sk-1234",
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
