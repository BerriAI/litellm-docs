# Rotating Master Key

## What actually encrypts your stored credentials

LiteLLM encrypts data at rest (model `litellm_params`, credentials, MCP server credentials, DB-stored environment variables) with a signing key resolved at runtime. That signing key is `LITELLM_SALT_KEY` when it is set, and it falls back to `LITELLM_MASTER_KEY` only when no salt key is configured. Decryption always uses the same resolution, so the value that can decrypt your stored data is whichever key was in effect when it was written.

This distinction drives how you rotate the master key. Pick the scenario that matches your setup before running any commands.

:::danger Read this before rotating
If you have a dedicated `LITELLM_SALT_KEY` set, your master key does not encrypt any stored credentials. Do not run the `/key/regenerate` re-encryption flow below in that case. Doing so re-encrypts your models with the new master key while decryption keeps using the unchanged salt key, which leaves every stored model undecryptable and takes the proxy down until the data is restored or re-registered.
:::

## Scenario A: you have a dedicated `LITELLM_SALT_KEY` (recommended for production)

Your model and credential data is tied to `LITELLM_SALT_KEY`, not to the master key, so rotating the master key does not touch encrypted data and does not require any re-encryption.

**1. Update `LITELLM_MASTER_KEY`**

Set `LITELLM_MASTER_KEY` to the new value in your environment and restart the proxy. The salt key stays exactly as it was, so all previously stored credentials keep decrypting.

**2. Test it**

Make a request to a DB-stored model with a valid key and confirm it succeeds.

```bash
 curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-new-master-key' \
-d '{
    "model": "gpt-4o-mini",
    "messages": [
        {
            "content": "Hey, how'\''s it going",
            "role": "user"
        }
    ]
}'
```

Do not rotate `LITELLM_SALT_KEY` itself. As noted in [prod best practices](./prod#8-set-litellm-salt-key), it must not change after you have added a model, because there is no in-place migration for salt-key rotation and every stored credential would need to be re-registered.

## Scenario B: you have not set a dedicated salt key (salt key falls back to the master key)

Here the master key is the signing key for your stored data, so changing it does require re-encrypting everything that was written under the old key. `/key/regenerate` decrypts your stored data with the current key and re-encrypts it with `new_master_key` for you.

:::tip Prefer a dedicated salt key
Before you rotate, consider setting a permanent `LITELLM_SALT_KEY` so future master-key rotations become the no-migration flow in Scenario A. Set the salt key to your current master key value first (so existing data still decrypts), then rotate the master key freely afterwards.
:::

**1. Backup your DB**

In case of any errors during the encryption/de-encryption process, this will allow you to revert back to current state without issues.

**2. Call `/key/regenerate` with the new master key**

```bash
curl -L -X POST 'http://localhost:4000/key/regenerate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
  "key": "sk-1234",
  "new_master_key": "sk-PIp1h0RekR"
}'
```

This will re-encrypt any models in your Proxy_ModelTable with the new master key.

Expect to start seeing decryption errors in logs, as your old master key is no longer able to decrypt the new values.

```bash
   raise Exception("Unable to decrypt value={}".format(v))
Exception: Unable to decrypt value=<new-encrypted-value>
```

**3. Update LITELLM_MASTER_KEY**

In your environment variables update the value of LITELLM_MASTER_KEY to the new_master_key from Step 2.

This ensures the key used for decryption from db is the new key.

**4. Test it**

Make a test request to a model stored on proxy with a litellm key (new master key or virtual key) and see if it works

```bash
 curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "gpt-4o-mini", # 👈 REPLACE with 'public model name' for any db-model
    "messages": [
        {
            "content": "Hey, how's it going",
            "role": "user"
        }
    ],
}'
```
