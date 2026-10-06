# Custom Pricing - SageMaker, Azure, etc

Register custom pricing for sagemaker completion model

For chat, completion, embedding and responses models, set `cost_per_second`. LiteLLM multiplies it by the full request
duration, including streaming until the last chunk, and ignores it when per-token pricing is configured

For chat, completion, embedding and responses, `input_cost_per_second` and `output_cost_per_second` remain accepted as
legacy aliases. `cost_per_second` takes precedence, followed by `input_cost_per_second` and then
`output_cost_per_second`; the resolved rate is charged once, not added. Transcription, speech and video continue to use
`input_cost_per_second` and `output_cost_per_second`

`cost_per_second` needs v1.105.0 or later. On earlier versions, use `input_cost_per_second`

```python
# !uv add boto3 
from litellm import completion, completion_cost 

os.environ["AWS_ACCESS_KEY_ID"] = ""
os.environ["AWS_SECRET_ACCESS_KEY"] = ""
os.environ["AWS_REGION_NAME"] = ""


def test_completion_sagemaker():
    try:
        print("testing sagemaker")
        response = completion(
            model="sagemaker/berri-benchmarking-Llama-2-70b-chat-hf-4",
            messages=[{"role": "user", "content": "Hey, how's it going?"}],
            cost_per_second=0.000420,
        )
        # Add any assertions here to check the response
        print(response)
        cost = completion_cost(completion_response=response)
        print(cost)
    except Exception as e:
        raise Exception(f"Error occurred: {e}")

```


## Cost Per Token (e.g. Azure)


```python
# !uv add boto3 
from litellm import completion, completion_cost 

## set ENV variables
os.environ["AZURE_API_KEY"] = ""
os.environ["AZURE_API_BASE"] = ""
os.environ["AZURE_API_VERSION"] = ""


def test_completion_azure_model():
    try:
        print("testing azure custom pricing")
        # azure call
        response = completion(
          model = "azure/<your_deployment_name>", 
          messages = [{ "content": "Hello, how are you?","role": "user"}],
          input_cost_per_token=0.005,
          output_cost_per_token=1,
        )
        # Add any assertions here to check the response
        print(response)
        cost = completion_cost(completion_response=response)
        print(cost)
    except Exception as e:
        raise Exception(f"Error occurred: {e}")

test_completion_azure_model()
```