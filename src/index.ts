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

// Anki-Connect API configuration
const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Helper function to make Anki-Connect API calls
async function ankiConnectRequest(action: string, params?: any) {
  const requestBody = {
    action,
    version: ANKI_CONNECT_VERSION,
    params: params || {}
  };

  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to communicate with Anki-Connect: ${error.message}`
      );
    }
    throw error;
  }
}

// Create the MCP server
const server = new Server(
  {
    name: "anki-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions organized by category
const toolDefinitions = {
  // Card Actions
  getEaseFactors: {
    description: "Get ease factors for cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs"),
    }),
  },
  setEaseFactors: {
    description: "Set ease factors for cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs"),
      easeFactors: z.array(z.number()).describe("Array of ease factors corresponding to each card"),
    }),
  },
  suspend: {
    description: "Suspend cards by card ID",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to suspend"),
    }),
  },
  unsuspend: {
    description: "Unsuspend cards by card ID",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to unsuspend"),
    }),
  },
  findCards: {
    description: "Find cards matching a query",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current')"),
    }),
  },
  cardsInfo: {
    description: "Get detailed information about cards",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs"),
    }),
  },
  
  // Deck Actions
  deckNames: {
    description: "Get list of all deck names",
    inputSchema: z.object({}),
  },
  deckNamesAndIds: {
    description: "Get deck names and their IDs",
    inputSchema: z.object({}),
  },
  createDeck: {
    description: "Create a new deck",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to create"),
    }),
  },
  deleteDecks: {
    description: "Delete decks",
    inputSchema: z.object({
      decks: z.array(z.string()).describe("Array of deck names to delete"),
      cardsToo: z.boolean().default(true).describe("Whether to delete cards in the decks"),
    }),
  },
  getDeckConfig: {
    description: "Get configuration for a deck",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck"),
    }),
  },
  getDeckStats: {
    description: "Get statistics for decks",
    inputSchema: z.object({
      decks: z.array(z.string()).describe("Array of deck names"),
    }),
  },
  
  // Note Actions
  addNote: {
    description: "Add a new note to Anki",
    inputSchema: z.object({
      deckName: z.string().describe("Name of the deck"),
      modelName: z.string().describe("Name of the note type/model"),
      fields: z.record(z.string()).describe("Field values for the note"),
      tags: z.array(z.string()).optional().describe("Tags for the note"),
      allowDuplicate: z.boolean().optional().describe("Allow duplicate notes"),
      audio: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional(),
      video: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional(),
      picture: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional(),
    }),
  },
  addNotes: {
    description: "Add multiple notes to Anki",
    inputSchema: z.object({
      notes: z.array(z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        options: z.object({
          allowDuplicate: z.boolean().optional(),
          duplicateScope: z.string().optional(),
        }).optional(),
        tags: z.array(z.string()).optional(),
      })),
    }),
  },
  updateNote: {
    description: "Update an existing note",
    inputSchema: z.object({
      id: z.number().describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z.array(z.string()).optional().describe("Tags to set"),
    }),
  },
  deleteNotes: {
    description: "Delete notes by ID",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to delete"),
    }),
  },
  findNotes: {
    description: "Find notes matching a query",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current')"),
    }),
  },
  notesInfo: {
    description: "Get detailed information about notes",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs"),
    }),
  },
  getTags: {
    description: "Get all tags in the collection",
    inputSchema: z.object({}),
  },
  addTags: {
    description: "Add tags to notes",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs"),
      tags: z.string().describe("Tags to add (space-separated)"),
    }),
  },
  removeTags: {
    description: "Remove tags from notes",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs"),
      tags: z.string().describe("Tags to remove (space-separated)"),
    }),
  },
  
  // Model Actions
  modelNames: {
    description: "Get list of all model/note type names",
    inputSchema: z.object({}),
  },
  modelNamesAndIds: {
    description: "Get model names and their IDs",
    inputSchema: z.object({}),
  },
  modelFieldNames: {
    description: "Get field names for a model",
    inputSchema: z.object({
      modelName: z.string().describe("Name of the model"),
    }),
  },
  createModel: {
    description: "Create a new note type/model",
    inputSchema: z.object({
      modelName: z.string().describe("Name for the new model"),
      inOrderFields: z.array(z.string()).describe("Field names in order"),
      css: z.string().optional().describe("CSS for the model"),
      isCloze: z.boolean().optional().default(false),
      cardTemplates: z.array(z.object({
        Name: z.string().optional(),
        Front: z.string(),
        Back: z.string(),
      })),
    }),
  },
  
  // Media Actions
  storeMediaFile: {
    description: "Store a media file in Anki",
    inputSchema: z.object({
      filename: z.string().describe("Name for the file"),
      data: z.string().optional().describe("Base64-encoded file content"),
      path: z.string().optional().describe("Path to file on disk"),
      url: z.string().optional().describe("URL to download file from"),
      deleteExisting: z.boolean().optional().default(true),
    }),
  },
  retrieveMediaFile: {
    description: "Retrieve a media file from Anki",
    inputSchema: z.object({
      filename: z.string().describe("Name of the file to retrieve"),
    }),
  },
  getMediaFilesNames: {
    description: "Get names of media files matching a pattern",
    inputSchema: z.object({
      pattern: z.string().optional().describe("Pattern to match (e.g., '*.jpg')"),
    }),
  },
  deleteMediaFile: {
    description: "Delete a media file",
    inputSchema: z.object({
      filename: z.string().describe("Name of the file to delete"),
    }),
  },
  
  // Statistic Actions
  getNumCardsReviewedToday: {
    description: "Get number of cards reviewed today",
    inputSchema: z.object({}),
  },
  getNumCardsReviewedByDay: {
    description: "Get number of cards reviewed by day",
    inputSchema: z.object({}),
  },
  getCollectionStatsHTML: {
    description: "Get collection statistics as HTML",
    inputSchema: z.object({
      wholeCollection: z.boolean().optional().default(true),
    }),
  },
  
  // Miscellaneous Actions
  sync: {
    description: "Synchronize with AnkiWeb",
    inputSchema: z.object({}),
  },
  getProfiles: {
    description: "Get list of profiles",
    inputSchema: z.object({}),
  },
  loadProfile: {
    description: "Load a profile",
    inputSchema: z.object({
      name: z.string().describe("Name of the profile to load"),
    }),
  },
  exportPackage: {
    description: "Export a deck as .apkg file",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to export"),
      path: z.string().describe("Path where to save the .apkg file"),
      includeSched: z.boolean().optional().default(false),
    }),
  },
  importPackage: {
    description: "Import an .apkg file",
    inputSchema: z.object({
      path: z.string().describe("Path to the .apkg file to import"),
    }),
  },
  
  // Graphical Actions (GUI operations)
  guiBrowse: {
    description: "Open the card browser with a search query",
    inputSchema: z.object({
      query: z.string().describe("Search query for the browser"),
      reorderCards: z.object({
        order: z.enum(["ascending", "descending"]).optional(),
        columnId: z.string().optional(),
      }).optional(),
    }),
  },
  guiAddCards: {
    description: "Open the Add Cards dialog with preset values",
    inputSchema: z.object({
      note: z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        tags: z.array(z.string()).optional(),
      }),
    }),
  },
  guiCurrentCard: {
    description: "Get information about the current card being reviewed",
    inputSchema: z.object({}),
  },
  guiAnswerCard: {
    description: "Answer the current card in review",
    inputSchema: z.object({
      ease: z.number().min(1).max(4).describe("Answer ease (1=Again, 2=Hard, 3=Good, 4=Easy)"),
    }),
  },
  guiDeckOverview: {
    description: "Open deck overview for a specific deck",
    inputSchema: z.object({
      name: z.string().describe("Name of the deck"),
    }),
  },
  guiExitAnki: {
    description: "Close Anki",
    inputSchema: z.object({}),
  },
};

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(toolDefinitions).map(([name, def]) => {
    // Convert Zod schema to JSON schema format
    const properties: any = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(def.inputSchema.shape)) {
      const zodField = value as any;
      
      // Build property schema
      properties[key] = {
        type: zodField._def?.typeName === "ZodNumber" ? "number" : 
              zodField._def?.typeName === "ZodBoolean" ? "boolean" :
              zodField._def?.typeName === "ZodArray" ? "array" : 
              zodField._def?.typeName === "ZodObject" ? "object" : "string",
      };
      
      // Add description if available
      if (zodField._def?.description) {
        properties[key].description = zodField._def.description;
      }
      
      // Check if required
      if (!zodField.isOptional?.()) {
        required.push(key);
      }
    }
    
    return {
      name,
      description: def.description,
      inputSchema: {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      },
    };
  });
  
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate the tool exists
    if (!(name in toolDefinitions)) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
    }

    // Special handling for addNote - needs to wrap in note object
    let params = args;
    if (name === "addNote") {
      params = {
        note: {
          deckName: args.deckName,
          modelName: args.modelName,
          fields: args.fields,
          tags: args.tags || [],
          options: {
            allowDuplicate: args.allowDuplicate || false,
          },
          audio: args.audio,
          video: args.video,
          picture: args.picture,
        }
      };
    } else if (name === "updateNote") {
      params = {
        note: {
          id: args.id,
          fields: args.fields,
          tags: args.tags,
        }
      };
    }

    // Call the Anki-Connect API
    const result = await ankiConnectRequest(name, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Anki MCP server running on stdio");
  console.error(`Connected to Anki-Connect at ${ANKI_CONNECT_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});