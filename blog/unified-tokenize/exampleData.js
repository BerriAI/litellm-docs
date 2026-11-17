export const clientRequest = { model: "llama-3.1-8b", prompt: "Hello world" };

export const providerExamples = {
  vllm: {
    name: "vLLM",
    modelName: "llama-3.1-8b",
    target: "hosted_vllm/meta-llama/Llama-3.1-8B-Instruct",
    response: {
      model: "meta-llama/Llama-3.1-8B-Instruct",
      count: 2,
      token_ids: [101, 102],
      tokens: ["Hello", " world"],
    },
  },
  watsonx: {
    name: "Watsonx",
    modelName: "granite-3.3-8b",
    target: "watsonx/ibm/granite-3-3-8b-instruct",
    response: {
      model: "ibm/granite-3-3-8b-instruct",
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
