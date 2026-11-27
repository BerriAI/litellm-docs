import type { McpServer } from "./connections.ts";
import { listAllTools, litellmConfig, resultText, withMcp } from "./mcp.ts";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AgentStep = { tool: string; arguments: unknown; isError: boolean; preview: string };
export type AgentAnswer = { answer: string; steps: AgentStep[] };

const MAX_TURNS = 8;

async function chat(messages: Message[], tools: unknown[]): Promise<Extract<Message, { role: "assistant" }>> {
  const { base, key } = litellmConfig();
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.LITELLM_MODEL ?? "claude-sonnet-5-5", messages, tools }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? `The model request failed with HTTP ${response.status}.`);
  return body.choices[0].message;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function ask(server: McpServer, accessToken: string, question: string): Promise<AgentAnswer> {
  return withMcp(server, accessToken, async client => {
    const tools = (await listAllTools(client)).map(tool => ({
      type: "function",
      function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema },
    }));
    const messages: Message[] = [
      {
        role: "system",
        content: `You answer questions about the signed-in customer's meetings. Use the ${server.label} tools to look up meetings before you answer, and say when the meetings do not contain the answer. Today is ${new Date().toDateString()}.`,
      },
      { role: "user", content: question },
    ];
    const steps: AgentStep[] = [];
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await chat(messages, tools);
      messages.push({ role: "assistant", content: reply.content ?? null, tool_calls: reply.tool_calls });
      if (!reply.tool_calls?.length) return { answer: reply.content ?? "", steps };
      for (const call of reply.tool_calls) {
        const args = parseArguments(call.function.arguments);
        const result = await client.callTool({ name: call.function.name, arguments: args });
        const text = resultText(result);
        steps.push({ tool: call.function.name, arguments: args, isError: Boolean(result.isError), preview: text.slice(0, 400) });
        messages.push({ role: "tool", tool_call_id: call.id, content: text || "(empty result)" });
      }
    }
    return { answer: "I stopped after too many tool calls. Try a narrower question.", steps };
  });
}
