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

/** @param {Record<string, string | number | null | Array<string | number>>} value */
export function formatJson(value) {
  const entries = Object.entries(value);
  const properties = entries.map(([key, item], index) => {
    const formatted = Array.isArray(item)
      ? `[${item.map((token) => JSON.stringify(token)).join(", ")}]`
      : JSON.stringify(item);
    return `  "${key}": ${formatted}${index < entries.length - 1 ? "," : ""}`;
  });
  return `{\n${properties.join("\n")}\n}`;
}
