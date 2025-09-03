#!/usr/bin/env bun

/**
 * Simplified Anki MCP Server with Better Zod Integration
 * Using the McpServer class for simpler tool registration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Anki-Connect configuration
const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Create MCP server instance
const server = new McpServer({
  name: "anki-mcp-server",
  version: "1.0.0",
});

// Helper function for Anki-Connect API calls
async function ankiConnect(action: string, params?: any): Promise<any> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        version: ANKI_CONNECT_VERSION,
        params: params || {}
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Anki-Connect error: ${data.error}`);
    }

    return data.result;
  } catch (error) {
    throw new Error(`Failed to call Anki-Connect: ${error}`);
  }
}

// Register Deck Tools
server.registerTool(
  "deckNames",
  {
    description: "Get list of all deck names",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await ankiConnect("deckNames");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "createDeck",
  {
    description: "Create a new deck",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to create"),
    }),
  },
  async ({ deck }) => {
    const result = await ankiConnect("createDeck", { deck });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "getDeckStats",
  {
    description: "Get statistics for specified decks",
    inputSchema: z.object({
      decks: z.array(z.string()).describe("Array of deck names"),
    }),
  },
  async ({ decks }) => {
    const result = await ankiConnect("getDeckStats", { decks });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Register Note Tools
server.registerTool(
  "addNote",
  {
    description: "Add a new note to Anki",
    inputSchema: z.object({
      deckName: z.string().describe("Name of the deck"),
      modelName: z.string().describe("Name of the note type/model"),
      fields: z.record(z.string()).describe("Field values for the note"),
      tags: z.array(z.string()).optional().describe("Tags for the note"),
      allowDuplicate: z.boolean().optional().default(false).describe("Allow duplicate notes"),
    }),
  },
  async ({ deckName, modelName, fields, tags, allowDuplicate }) => {
    const result = await ankiConnect("addNote", {
      note: {
        deckName,
        modelName,
        fields,
        tags: tags || [],
        options: { allowDuplicate },
      },
    });
    return {
      content: [{ type: "text", text: `Note created with ID: ${result}` }],
    };
  }
);

server.registerTool(
  "findNotes",
  {
    description: "Find notes matching a query",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current', 'tag:important')"),
    }),
  },
  async ({ query }) => {
    const result = await ankiConnect("findNotes", { query });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "updateNote",
  {
    description: "Update an existing note",
    inputSchema: z.object({
      id: z.number().describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z.array(z.string()).optional().describe("New tags for the note"),
    }),
  },
  async ({ id, fields, tags }) => {
    const params: any = { note: { id } };
    if (fields) params.note.fields = fields;
    if (tags) params.note.tags = tags;
    
    await ankiConnect("updateNote", params);
    return {
      content: [{ type: "text", text: `Note ${id} updated successfully` }],
    };
  }
);

server.registerTool(
  "deleteNotes",
  {
    description: "Delete notes by ID",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to delete"),
    }),
  },
  async ({ notes }) => {
    await ankiConnect("deleteNotes", { notes });
    return {
      content: [{ type: "text", text: `Deleted ${notes.length} notes` }],
    };
  }
);

// Register Card Tools
server.registerTool(
  "findCards",
  {
    description: "Find cards matching a query",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current', 'is:due')"),
    }),
  },
  async ({ query }) => {
    const result = await ankiConnect("findCards", { query });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "cardsInfo",
  {
    description: "Get detailed information about cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs"),
    }),
  },
  async ({ cards }) => {
    const result = await ankiConnect("cardsInfo", { cards });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "suspend",
  {
    description: "Suspend cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to suspend"),
    }),
  },
  async ({ cards }) => {
    const result = await ankiConnect("suspend", { cards });
    return {
      content: [{ type: "text", text: result ? "Cards suspended" : "No changes made" }],
    };
  }
);

server.registerTool(
  "unsuspend",
  {
    description: "Unsuspend cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to unsuspend"),
    }),
  },
  async ({ cards }) => {
    const result = await ankiConnect("unsuspend", { cards });
    return {
      content: [{ type: "text", text: result ? "Cards unsuspended" : "No changes made" }],
    };
  }
);

// Register Model Tools
server.registerTool(
  "modelNames",
  {
    description: "Get list of all model/note type names",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await ankiConnect("modelNames");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "modelFieldNames",
  {
    description: "Get field names for a model",
    inputSchema: z.object({
      modelName: z.string().describe("Name of the model"),
    }),
  },
  async ({ modelName }) => {
    const result = await ankiConnect("modelFieldNames", { modelName });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Register Statistics Tools
server.registerTool(
  "getNumCardsReviewedToday",
  {
    description: "Get number of cards reviewed today",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await ankiConnect("getNumCardsReviewedToday");
    return {
      content: [{ type: "text", text: `Cards reviewed today: ${result}` }],
    };
  }
);

server.registerTool(
  "getCollectionStats",
  {
    description: "Get collection statistics",
    inputSchema: z.object({
      wholeCollection: z.boolean().optional().default(true).describe("Get stats for whole collection"),
    }),
  },
  async ({ wholeCollection }) => {
    const result = await ankiConnect("getCollectionStatsHTML", { wholeCollection });
    return {
      content: [{ type: "text", text: "Statistics retrieved (HTML format)" }],
    };
  }
);

// Register Media Tools
server.registerTool(
  "storeMediaFile",
  {
    description: "Store a media file in Anki",
    inputSchema: z.object({
      filename: z.string().describe("Name for the file"),
      data: z.string().optional().describe("Base64-encoded file content"),
      url: z.string().optional().describe("URL to download file from"),
      path: z.string().optional().describe("Path to file on disk"),
    }),
  },
  async ({ filename, data, url, path }) => {
    const params: any = { filename };
    if (data) params.data = data;
    if (url) params.url = url;
    if (path) params.path = path;
    
    const result = await ankiConnect("storeMediaFile", params);
    return {
      content: [{ type: "text", text: `File stored: ${result}` }],
    };
  }
);

// Register Tag Tools
server.registerTool(
  "getTags",
  {
    description: "Get all tags in the collection",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await ankiConnect("getTags");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "addTags",
  {
    description: "Add tags to notes",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs"),
      tags: z.string().describe("Tags to add (space-separated)"),
    }),
  },
  async ({ notes, tags }) => {
    await ankiConnect("addTags", { notes, tags });
    return {
      content: [{ type: "text", text: `Tags added to ${notes.length} notes` }],
    };
  }
);

server.registerTool(
  "removeTags",
  {
    description: "Remove tags from notes",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs"),
      tags: z.string().describe("Tags to remove (space-separated)"),
    }),
  },
  async ({ notes, tags }) => {
    await ankiConnect("removeTags", { notes, tags });
    return {
      content: [{ type: "text", text: `Tags removed from ${notes.length} notes` }],
    };
  }
);

// Register System Tools
server.registerTool(
  "sync",
  {
    description: "Synchronize with AnkiWeb",
    inputSchema: z.object({}),
  },
  async () => {
    await ankiConnect("sync");
    return {
      content: [{ type: "text", text: "Synchronization completed" }],
    };
  }
);

server.registerTool(
  "getProfiles",
  {
    description: "Get list of profiles",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await ankiConnect("getProfiles");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Anki MCP Server (Simplified) running on stdio");
  console.error(`Connected to Anki-Connect at ${ANKI_CONNECT_URL}`);
  console.error(`Registered ${Object.keys(server).length} tools`);
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});