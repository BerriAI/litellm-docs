export const clientRequest = { model: "tokenizer", prompt: "Hello world" };

export const providerExamples = {
  vllm: {
    name: "vLLM",
    target: "hosted_vllm/your-served-model",
    response: {
      model: "your-served-model",
      count: 2,
      token_ids: [101, 102],
      tokens: ["Hello", " world"],
    },
  },
  watsonx: {
    name: "Watsonx",
    target: "watsonx/your-model-id",
    response: {
      model: "your-model-id",
      count: 2,
      token_ids: null,
      tokens: ["Hello", " world"],
    },
  },
};
