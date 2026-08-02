import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# EU AI Act (eucompliance.tools)

[eucompliance.tools](https://eucompliance.tools) marks model output under **Article 50 of the EU AI Act**, which has applied since 2 August 2026.

If you put someone else's model into your product, you are the *deployer* and the transparency obligation is yours, not the model provider's. This callback produces the disclosure text you have to show your users, plus a signed provenance record for your files.

**The content of your calls is not sent anywhere.** The SHA-256 is computed locally and only that hash leaves your process, so the disclosure carries no prompt or completion data.

## Quick Start

```python
# pip install eucompliance-ai-act
import litellm
from eucompliance_ai_act.integrations import litellm_logger

disclosure = litellm_logger(deployer="Your Company GmbH")
litellm.callbacks = [disclosure]

response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hi 👋 - i'm openai"}],
)

print(disclosure.last.disclosure_text)   # show this to your users
print(disclosure.last.record)            # signed record, for your files
```

No account and no API key are required. The free tier allows 500 disclosures per day per address.

## OpenAI Proxy Usage

1. Create a file `custom_callbacks.py` next to your config:

```python
from eucompliance_ai_act.integrations import litellm_logger

proxy_handler_instance = litellm_logger(
    deployer="Your Company GmbH",
    file="disclosures.jsonl",     # one signed record per line
)
```

2. Point the proxy at it:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: custom_callbacks.proxy_handler_instance
```

3. Start the proxy:

```shell
litellm --config config.yaml
```

## What you get back

<Tabs>
<TabItem value="text" label="Disclosure text">

```python
disclosure.last.disclosure_text
# "This content was generated using artificial intelligence."
```

Available in German and English (`language="de"` / `"en"`), and in the wording required for your case: generated content, edited content, deepfake, or interactive system (`kind=`).

</TabItem>
<TabItem value="record" label="Signed record">

```python
disclosure.last.record
# {
#   "provenance": {"content_sha256": "e3b0c442…", "hashed_by": "client"},
#   "disclosure": {"text": "…", "language": "en"},
#   "obligations": [...],
#   "receipt": {"signature": "0x…", "issuer": "eucompliance.tools", …}
# }
```

The record is signed with EIP-191 and can be verified by anyone, free and without an account — `POST` it to `https://api.eucompliance.tools/verify`, or open [eucompliance.tools/verify](https://eucompliance.tools/verify) in a browser.

</TabItem>
</Tabs>

## Advanced

| Argument | Default | What it does |
| --- | --- | --- |
| `deployer` | `None` | Your organisation — appears in the record |
| `kind` | `"text"` | `text`, `bearbeitet` (edited), `deepfake`, `interaktion` |
| `language` | `"de"` | Language of the disclosure text |
| `file` | `None` | Append every record to this JSONL file |
| `sink` | `None` | Callable that receives each record |
| `blocking` | `False` | Wait for the disclosure instead of backgrounding it |
| `deployer_in_eu`, `eu_users` | `True` | If both are false, the answer says the obligation does not apply to you |

```python
disclosure.summary()
# {"disclosed": 128, "unsigned": 0, "kept": 128}
```

## Notes on failure behaviour

The callback runs on a background thread, so your model call never waits for it, and it swallows its own exceptions — if the service is unreachable you still get valid disclosure text, flagged `offline=True`, and your application is unaffected.

It attests **origin**, not detection: a record proves this exact content was declared AI-generated at this time and is unchanged since. It does not prove that content *without* a record is human-made. This is a technical attestation, not legal advice — classifying your own system remains your responsibility.
