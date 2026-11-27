import { Client, StreamableHTTPClientTransport, type Tool } from "@modelcontextprotocol/client";
import type { McpServer } from "./connections.ts";

export function litellmConfig(): { base: string; key: string } {
  const base = process.env.LITELLM_PROXY_API_BASE;
  const key = process.env.LITELLM_PROXY_API_KEY;
  if (!base || !key) throw new Error("Set the LiteLLM backend environment variables.");
  return { base: base.replace(/\/$/, ""), key };
}

export async function withMcp<T>(server: McpServer, accessToken: string, run: (client: Client) => Promise<T>): Promise<T> {
  const { base, key } = litellmConfig();
  const client = new Client({ name: "meeting-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${server.name}/mcp`, `${base}/`), {
    authProvider: { token: async () => accessToken },
    requestInit: {
      headers: { "x-litellm-api-key": `Bearer ${key}` },
      redirect: "error",
    },
  });
  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close();
  }
}

export async function listAllTools(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools({ cursor });
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

export function resultText(result: { content?: unknown }): string {
  const content = Array.isArray(result.content) ? result.content : [];
  return content
    .map(block => (block && typeof block === "object" && "text" in block ? String(block.text) : JSON.stringify(block)))
    .join("\n");
}

export async function checkAccount(server: McpServer, accessToken: string): Promise<string> {
  return withMcp(server, accessToken, async client => {
    const tool = (await listAllTools(client)).find(t => t.name.endsWith("get_account_info"));
    if (!tool) throw new Error("Account tool unavailable. Check the MCP tool permissions.");
    const result = await client.callTool({ name: tool.name, arguments: {} });
    const text = resultText(result);
    if (result.isError) throw new Error(text || "The account check failed.");
    return text;
  });
}
