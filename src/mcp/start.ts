import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAnkiConnectUrl } from "../shared/config.js";
import { createServer } from "./server.js";

export async function startMcpServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Anki MCP server running on stdio");
  console.error(`Connected to Anki-Connect at ${getAnkiConnectUrl()}`);
}
