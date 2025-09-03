#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Configuration
const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Anki-Connect API helper
async function ankiConnect(action: string, params = {}): Promise<any> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Anki-Connect: ${error.message}`
    );
  }
}

// Simplified Zod to JSON Schema converter
function zodToJsonSchema(schema: z.ZodTypeAny): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (!(schema instanceof z.ZodObject)) {
    return { type: "object", properties: {} };
  }

  Object.entries(schema.shape).forEach(([key, value]) => {
    const field = value as z.ZodTypeAny;
    let type = "string";
    let items = undefined;

    // Determine type
    if (field instanceof z.ZodNumber) type = "number";
    else if (field instanceof z.ZodBoolean) type = "boolean";
    else if (field instanceof z.ZodArray) {
      type = "array";
      items = { type: "string" }; // Simplified
    } else if (field instanceof z.ZodObject || field instanceof z.ZodRecord) {
      type = "object";
    }

    properties[key] = { type };
    if (items) properties[key].items = items;
    if ((field as any)._def?.description) {
      properties[key].description = (field as any)._def.description;
    }
    if (!field.isOptional()) required.push(key);
  });

  return {
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
  };
}

// Tool definition helper
interface ToolDef {
  description: string;
  schema: z.ZodTypeAny;
  handler: (args: any) => Promise<any>;
}

// Define all tools in a cleaner way
const tools: Record<string, ToolDef> = {
  // === DECK OPERATIONS ===
  deckNames: {
    description: "List all deck names in your Anki collection",
    schema: z.object({}),
    handler: async () => ankiConnect("deckNames"),
  },
  
  createDeck: {
    description: "Create a new deck or ensure it exists",
    schema: z.object({
      deck: z.string().describe("Deck name (use :: for nested decks)"),
    }),
    handler: async ({ deck }) => ankiConnect("createDeck", { deck }),
  },
  
  getDeckStats: {
    description: "Get statistics for specified decks",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to get stats for"),
    }),
    handler: async ({ decks }) => ankiConnect("getDeckStats", { decks }),
  },
  
  deleteDecks: {
    description: "Delete decks and optionally their cards",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to delete"),
      cardsToo: z.boolean().default(true).describe("Also delete cards"),
    }),
    handler: async ({ decks, cardsToo }) => 
      ankiConnect("deleteDecks", { decks, cardsToo }),
  },
  
  // === NOTE OPERATIONS ===
  addNote: {
    description: "Create a new flashcard note",
    schema: z.object({
      deckName: z.string().describe("Target deck"),
      modelName: z.string().describe("Note type (e.g., 'Basic', 'Cloze')"),
      fields: z.record(z.string()).describe("Field content"),
      tags: z.array(z.string()).optional().describe("Tags"),
      allowDuplicate: z.boolean().optional().describe("Allow duplicates"),
    }),
    handler: async (args) => ankiConnect("addNote", {
      note: {
        deckName: args.deckName,
        modelName: args.modelName,
        fields: args.fields,
        tags: args.tags || [],
        options: { allowDuplicate: args.allowDuplicate || false },
      }
    }),
  },
  
  findNotes: {
    description: "Search for notes using Anki query syntax",
    schema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:Default')"),
    }),
    handler: async ({ query }) => ankiConnect("findNotes", { query }),
  },
  
  updateNote: {
    description: "Update an existing note's fields or tags",
    schema: z.object({
      id: z.number().describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z.array(z.string()).optional().describe("New tags"),
    }),
    handler: async ({ id, fields, tags }) => ankiConnect("updateNote", {
      note: { id, fields, tags }
    }),
  },
  
  deleteNotes: {
    description: "Delete notes by ID",
    schema: z.object({
      notes: z.array(z.number()).describe("Note IDs to delete"),
    }),
    handler: async ({ notes }) => ankiConnect("deleteNotes", { notes }),
  },
  
  notesInfo: {
    description: "Get detailed information about notes",
    schema: z.object({
      notes: z.array(z.number()).describe("Note IDs"),
    }),
    handler: async ({ notes }) => ankiConnect("notesInfo", { notes }),
  },
  
  getTags: {
    description: "Get all tags in the collection",
    schema: z.object({}),
    handler: async () => ankiConnect("getTags"),
  },
  
  addTags: {
    description: "Add tags to notes",
    schema: z.object({
      notes: z.array(z.number()).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }) => ankiConnect("addTags", { notes, tags }),
  },
  
  removeTags: {
    description: "Remove tags from notes",
    schema: z.object({
      notes: z.array(z.number()).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }) => ankiConnect("removeTags", { notes, tags }),
  },
  
  // === CARD OPERATIONS ===
  findCards: {
    description: "Find cards using Anki query syntax",
    schema: z.object({
      query: z.string().describe("Search query"),
    }),
    handler: async ({ query }) => ankiConnect("findCards", { query }),
  },
  
  cardsInfo: {
    description: "Get detailed card information",
    schema: z.object({
      cards: z.array(z.number()).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsInfo", { cards }),
  },
  
  suspend: {
    description: "Suspend cards from review",
    schema: z.object({
      cards: z.array(z.number()).describe("Card IDs to suspend"),
    }),
    handler: async ({ cards }) => ankiConnect("suspend", { cards }),
  },
  
  unsuspend: {
    description: "Unsuspend cards for review",
    schema: z.object({
      cards: z.array(z.number()).describe("Card IDs to unsuspend"),
    }),
    handler: async ({ cards }) => ankiConnect("unsuspend", { cards }),
  },
  
  getEaseFactors: {
    description: "Get ease factors for cards",
    schema: z.object({
      cards: z.array(z.number()).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getEaseFactors", { cards }),
  },
  
  setEaseFactors: {
    description: "Set ease factors for cards",
    schema: z.object({
      cards: z.array(z.number()).describe("Card IDs"),
      easeFactors: z.array(z.number()).describe("Ease factors (1.3-2.5)"),
    }),
    handler: async ({ cards, easeFactors }) => 
      ankiConnect("setEaseFactors", { cards, easeFactors }),
  },
  
  // === MODEL OPERATIONS ===
  modelNames: {
    description: "List all note types",
    schema: z.object({}),
    handler: async () => ankiConnect("modelNames"),
  },
  
  modelFieldNames: {
    description: "Get field names for a note type",
    schema: z.object({
      modelName: z.string().describe("Note type name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelFieldNames", { modelName }),
  },
  
  // === STATISTICS ===
  getNumCardsReviewedToday: {
    description: "Get today's review count",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedToday"),
  },
  
  // === MEDIA ===
  storeMediaFile: {
    description: "Store a media file",
    schema: z.object({
      filename: z.string().describe("File name"),
      data: z.string().optional().describe("Base64 data"),
      url: z.string().optional().describe("URL to download"),
    }),
    handler: async (args) => ankiConnect("storeMediaFile", args),
  },
  
  // === SYNC ===
  sync: {
    description: "Sync with AnkiWeb",
    schema: z.object({}),
    handler: async () => ankiConnect("sync"),
  },
};

// Create MCP server
const server = new Server(
  { name: "anki-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
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
  
  try {
    const result = await tool.handler(args || {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      error.message || "Unknown error"
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Anki MCP server (simplified) running");
  console.error(`Connected to Anki-Connect at ${ANKI_CONNECT_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});