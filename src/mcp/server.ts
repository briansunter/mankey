import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { AnkiConnectError } from "../shared/anki-connect.js";
import { zodToJsonSchema } from "../shared/schema.js";
import { tools } from "../tools/index.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "anki-mcp-server",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
        pagination: {
          maxPageSize: 1000,
          defaultPageSize: 100,
        },
      },
    },
  );

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tools).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: zodToJsonSchema(def.schema),
    })),
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = tools[name];
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
    }

    // Validate args against the tool's Zod schema
    const parsed = tool.schema.safeParse(args || {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      throw new McpError(ErrorCode.InvalidParams, `Validation error: ${issues}`);
    }

    try {
      const result = await tool.handler(parsed.data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      // Wrap AnkiConnectError in McpError for MCP clients
      if (error instanceof AnkiConnectError) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
  });

  return server;
}
