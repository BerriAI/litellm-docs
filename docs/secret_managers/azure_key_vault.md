# Azure Key Vault

:::info

✨ **This is an Enterprise Feature**

[Enterprise Pricing](https://www.litellm.ai/#pricing)

[Contact us here to get a free trial](https://enterprise.litellm.ai/demo)

:::

## Usage with LiteLLM Proxy Server

1. Install Proxy dependencies 
```bash
uv tool install 'litellm[proxy]' 'litellm[extra_proxy]'
```

2. Save Azure details in your environment
```bash 
export AZURE_CLIENT_ID="your-azure-app-client-id"
export AZURE_CLIENT_SECRET="your-azure-app-client-secret"
export AZURE_TENANT_ID="your-azure-tenant-id"
export AZURE_KEY_VAULT_URI="your-azure-key-vault-uri"
```

3. Add to proxy config.yaml 
```yaml
model_list: 
    - model_name: "my-azure-models" # model alias 
        litellm_params:
            model: "azure/<your-deployment-name>"
            api_key: "os.environ/AZURE-API-KEY" # reads from key vault - get_secret("AZURE_API_KEY")
            api_base: "os.environ/AZURE-API-BASE" # reads from key vault - get_secret("AZURE_API_BASE")

general_settings:
  key_management_system: "azure_key_vault"
```

You can now test this by starting your proxy: 
```bash
litellm --config /path/to/config.yaml
```

[Quick Test Proxy](../proxy/quick_start#using-litellm-proxy---curl-request-openai-package-langchain-langchain-js)

## Authenticate with Azure Workload Identity

If you run the proxy on AKS with [Azure Workload Identity](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview), you can authenticate to Key Vault with a federated token instead of a client secret. LiteLLM picks the Azure credential type from `AZURE_CREDENTIAL`, or infers it from the environment; when a federated token file is present alongside the client and tenant ids and no client secret is set, it uses `WorkloadIdentityCredential`.

Enabling workload identity on the pod and annotating its service account causes AKS to inject `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_FEDERATED_TOKEN_FILE` automatically, so in most cases you only need to set the vault URI and let inference do the rest. You can also select it explicitly with `AZURE_CREDENTIAL=WorkloadIdentityCredential`.

```bash
export AZURE_KEY_VAULT_URI="your-azure-key-vault-uri"
# optional; inferred automatically when AZURE_FEDERATED_TOKEN_FILE is set
export AZURE_CREDENTIAL="WorkloadIdentityCredential"
```

```yaml
general_settings:
  key_management_system: "azure_key_vault"
```

The service account used by the proxy pod must be granted `get` access to the Key Vault secrets, and its federated identity credential must be linked to the managed identity that holds that access

