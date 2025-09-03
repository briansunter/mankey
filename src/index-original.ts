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

// Type definitions for better type safety
interface AnkiConnectResponse<T = any> {
  result: T;
  error: string | null;
}

interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
  options?: {
    allowDuplicate?: boolean;
    duplicateScope?: string;
  };
  audio?: MediaAsset[];
  video?: MediaAsset[];
  picture?: MediaAsset[];
}

interface MediaAsset {
  url?: string;
  filename: string;
  fields: string[];
}

// Anki-Connect API configuration
const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Helper function to make Anki-Connect API calls with proper typing
async function ankiConnectRequest<T = any>(action: string, params?: any): Promise<T> {
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

    const data = await response.json() as AnkiConnectResponse<T>;

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

// Tool definitions organized by category with improved descriptions
const toolDefinitions = {
  // ==================== Card Actions ====================
  getEaseFactors: {
    description: "Retrieve the ease factors (difficulty multipliers) for specified cards. Ease factors affect review scheduling intervals.",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to get ease factors for"),
    }),
  },
  setEaseFactors: {
    description: "Modify the ease factors for specified cards to adjust their difficulty. Higher factors mean easier cards with longer intervals.",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to modify"),
      easeFactors: z.array(z.number()).describe("New ease factors (typically 1.3 to 2.5) corresponding to each card"),
    }),
  },
  suspend: {
    description: "Temporarily hide cards from review without deleting them. Suspended cards won't appear in study sessions until unsuspended.",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to suspend from review"),
    }),
  },
  unsuspend: {
    description: "Restore previously suspended cards to active review status. Cards will appear in study sessions again.",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to restore to active review"),
    }),
  },
  findCards: {
    description: "Search for cards using Anki's powerful query syntax. Returns card IDs matching the search criteria.",
    inputSchema: z.object({
      query: z.string().describe("Anki search query (e.g., 'deck:current', 'is:due', 'tag:vocabulary', 'front:*question*')"),
    }),
  },
  cardsInfo: {
    description: "Get comprehensive details about specific cards including question, answer, deck, due date, and review statistics.",
    inputSchema: z.object({
      cards: z.array(z.number()).describe("Array of card IDs to get detailed information for"),
    }),
  },
  
  // ==================== Deck Actions ====================
  deckNames: {
    description: "List all deck names in the Anki collection. Returns a flat array including nested decks with :: separators.",
    inputSchema: z.object({}),
  },
  deckNamesAndIds: {
    description: "Get a mapping of all deck names to their internal IDs. Useful for operations requiring deck IDs.",
    inputSchema: z.object({}),
  },
  createDeck: {
    description: "Create a new deck or ensure a deck exists. If deck already exists, returns its ID without error.",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to create (use :: for nested decks, e.g., 'Parent::Child')"),
    }),
  },
  deleteDecks: {
    description: "Delete one or more decks and optionally their cards. This action cannot be undone.",
    inputSchema: z.object({
      decks: z.array(z.string()).describe("Array of deck names to delete"),
      cardsToo: z.boolean().default(true).describe("Whether to delete all cards in the decks (true) or move them to default deck (false)"),
    }),
  },
  getDeckConfig: {
    description: "Retrieve the study settings and configuration for a specific deck including new card limits, review limits, and timing settings.",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to get configuration for"),
    }),
  },
  getDeckStats: {
    description: "Get study statistics for decks including card counts (new/learning/due), total reviews, and average ease.",
    inputSchema: z.object({
      decks: z.array(z.string()).describe("Array of deck names to get statistics for"),
    }),
  },
  
  // ==================== Note Actions ====================
  addNote: {
    description: "Create a new flashcard note in Anki with specified content, deck, and note type. Returns the note ID if successful.",
    inputSchema: z.object({
      deckName: z.string().describe("Target deck for the new note"),
      modelName: z.string().describe("Note type/model (e.g., 'Basic', 'Basic (and reversed card)', 'Cloze')"),
      fields: z.record(z.string()).describe("Content for each field (e.g., {'Front': 'Question', 'Back': 'Answer'})"),
      tags: z.array(z.string()).optional().describe("Tags to apply to the note for organization"),
      allowDuplicate: z.boolean().optional().describe("Allow creating duplicate notes (default: false)"),
      audio: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional().describe("Audio files to attach to fields"),
      video: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional().describe("Video files to attach to fields"),
      picture: z.array(z.object({
        url: z.string().optional(),
        filename: z.string(),
        fields: z.array(z.string()),
      })).optional().describe("Image files to attach to fields"),
    }),
  },
  addNotes: {
    description: "Bulk create multiple flashcard notes efficiently in a single operation. Returns array of note IDs.",
    inputSchema: z.object({
      notes: z.array(z.object({
        deckName: z.string().describe("Target deck for this note"),
        modelName: z.string().describe("Note type/model for this note"),
        fields: z.record(z.string()).describe("Field content for this note"),
        options: z.object({
          allowDuplicate: z.boolean().optional(),
          duplicateScope: z.string().optional(),
        }).optional().describe("Options for duplicate handling"),
        tags: z.array(z.string()).optional().describe("Tags for this note"),
      })).describe("Array of note objects to create"),
    }),
  },
  updateNote: {
    description: "Modify an existing note's fields or tags. Useful for correcting errors or adding information.",
    inputSchema: z.object({
      id: z.number().describe("Note ID to update"),
      fields: z.record(z.string()).optional().describe("Field values to update (only specified fields are changed)"),
      tags: z.array(z.string()).optional().describe("New complete tag list (replaces all existing tags)"),
    }),
  },
  deleteNotes: {
    description: "Permanently delete notes and their associated cards. This action cannot be undone.",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to delete"),
    }),
  },
  findNotes: {
    description: "Search for notes using Anki's query syntax. Returns note IDs matching the search criteria.",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:Default', 'tag:important', 'added:1', 'front:*keyword*')"),
    }),
  },
  notesInfo: {
    description: "Get detailed information about notes including all fields, tags, deck, and associated card IDs.",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to get information for"),
    }),
  },
  getTags: {
    description: "Retrieve all unique tags used across the entire Anki collection. Useful for tag management and organization.",
    inputSchema: z.object({}),
  },
  addTags: {
    description: "Add tags to existing notes without removing current tags. Tags help organize and filter cards.",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to add tags to"),
      tags: z.string().describe("Space-separated tags to add (e.g., 'vocabulary important')"),
    }),
  },
  removeTags: {
    description: "Remove specific tags from notes while preserving other tags. Useful for tag cleanup and reorganization.",
    inputSchema: z.object({
      notes: z.array(z.number()).describe("Array of note IDs to remove tags from"),
      tags: z.string().describe("Space-separated tags to remove"),
    }),
  },
  
  // ==================== Model Actions ====================
  modelNames: {
    description: "List all available note types (models) in Anki. Common types include Basic, Cloze, and custom templates.",
    inputSchema: z.object({}),
  },
  modelNamesAndIds: {
    description: "Get a mapping of model names to their IDs. Useful when model IDs are required for operations.",
    inputSchema: z.object({}),
  },
  modelFieldNames: {
    description: "Get the field names for a specific note type. Essential for knowing what fields to populate when creating notes.",
    inputSchema: z.object({
      modelName: z.string().describe("Name of the model/note type to get fields for"),
    }),
  },
  createModel: {
    description: "Create a custom note type with specified fields and card templates. Allows full customization of card appearance.",
    inputSchema: z.object({
      modelName: z.string().describe("Unique name for the new model"),
      inOrderFields: z.array(z.string()).describe("Ordered list of field names"),
      css: z.string().optional().describe("CSS styling for the cards"),
      isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
      cardTemplates: z.array(z.object({
        Name: z.string().optional().describe("Template name"),
        Front: z.string().describe("Front template HTML/fields"),
        Back: z.string().describe("Back template HTML/fields"),
      })).describe("Card generation templates"),
    }),
  },
  
  // ==================== Media Actions ====================
  storeMediaFile: {
    description: "Add media files (images, audio, video) to Anki's media collection for use in cards.",
    inputSchema: z.object({
      filename: z.string().describe("Name for the file in Anki's media folder"),
      data: z.string().optional().describe("Base64-encoded file content"),
      path: z.string().optional().describe("Local file system path to the file"),
      url: z.string().optional().describe("URL to download the file from"),
      deleteExisting: z.boolean().optional().default(true).describe("Overwrite if file exists"),
    }),
  },
  retrieveMediaFile: {
    description: "Download a media file from Anki's collection as base64-encoded data.",
    inputSchema: z.object({
      filename: z.string().describe("Name of the media file to retrieve"),
    }),
  },
  getMediaFilesNames: {
    description: "List media files in Anki's collection, optionally filtered by pattern. Useful for media management.",
    inputSchema: z.object({
      pattern: z.string().optional().describe("Wildcard pattern to filter files (e.g., '*.jpg', 'audio_*')"),
    }),
  },
  deleteMediaFile: {
    description: "Remove a media file from Anki's collection. Cards referencing the file will show missing media.",
    inputSchema: z.object({
      filename: z.string().describe("Name of the media file to delete"),
    }),
  },
  
  // ==================== Statistic Actions ====================
  getNumCardsReviewedToday: {
    description: "Get the count of cards reviewed in the current day. Useful for tracking daily study progress.",
    inputSchema: z.object({}),
  },
  getNumCardsReviewedByDay: {
    description: "Get review counts for each day in the collection's history. Returns data for creating review heatmaps.",
    inputSchema: z.object({}),
  },
  getCollectionStatsHTML: {
    description: "Generate comprehensive statistics report in HTML format including forecast graphs and review history.",
    inputSchema: z.object({
      wholeCollection: z.boolean().optional().default(true).describe("Include stats for entire collection vs current deck only"),
    }),
  },
  
  // ==================== Miscellaneous Actions ====================
  sync: {
    description: "Synchronize the local Anki collection with AnkiWeb cloud service. Requires AnkiWeb account credentials.",
    inputSchema: z.object({}),
  },
  getProfiles: {
    description: "List all user profiles in the Anki installation. Each profile has separate cards and settings.",
    inputSchema: z.object({}),
  },
  loadProfile: {
    description: "Switch to a different user profile. Will close current collection and open the specified profile.",
    inputSchema: z.object({
      name: z.string().describe("Name of the profile to load"),
    }),
  },
  exportPackage: {
    description: "Export a deck as an .apkg file for sharing or backup. Can include scheduling information.",
    inputSchema: z.object({
      deck: z.string().describe("Name of the deck to export"),
      path: z.string().describe("File system path where to save the .apkg file"),
      includeSched: z.boolean().optional().default(false).describe("Include review scheduling data"),
    }),
  },
  importPackage: {
    description: "Import an .apkg file to add shared decks or restore backups. Merges with existing content.",
    inputSchema: z.object({
      path: z.string().describe("File system path to the .apkg file to import"),
    }),
  },
  
  // ==================== GUI Actions (Graphical Interface) ====================
  guiBrowse: {
    description: "Open Anki's card browser window with a search query. Allows visual card management and bulk operations.",
    inputSchema: z.object({
      query: z.string().describe("Search query to filter cards in the browser"),
      reorderCards: z.object({
        order: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
        columnId: z.string().optional().describe("Column to sort by"),
      }).optional().describe("Card sorting options"),
    }),
  },
  guiAddCards: {
    description: "Open the Add Cards dialog with pre-filled values. Useful for guided card creation with user interaction.",
    inputSchema: z.object({
      note: z.object({
        deckName: z.string().describe("Deck to select in the dialog"),
        modelName: z.string().describe("Note type to select"),
        fields: z.record(z.string()).describe("Fields to pre-fill"),
        tags: z.array(z.string()).optional().describe("Tags to pre-fill"),
      }).describe("Note data to pre-populate in the dialog"),
    }),
  },
  guiCurrentCard: {
    description: "Get information about the card currently being reviewed in Anki's study window.",
    inputSchema: z.object({}),
  },
  guiAnswerCard: {
    description: "Programmatically answer the current card during review with a specific ease rating.",
    inputSchema: z.object({
      ease: z.number().min(1).max(4).describe("Answer rating: 1=Again (failed), 2=Hard, 3=Good, 4=Easy"),
    }),
  },
  guiDeckOverview: {
    description: "Open the deck overview screen showing study options and statistics for a specific deck.",
    inputSchema: z.object({
      name: z.string().describe("Name of the deck to show overview for"),
    }),
  },
  guiExitAnki: {
    description: "Close the Anki application gracefully. Saves any pending changes before exiting.",
    inputSchema: z.object({}),
  },
};

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(toolDefinitions).map(([name, def]) => {
    // Convert Zod schema to JSON schema format
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    // Type guard for Zod schema shape
    const schema = def.inputSchema as z.ZodObject<any>;
    if (!schema.shape) {
      return {
        name,
        description: def.description,
        inputSchema: {
          type: "object",
          properties: {},
        },
      };
    }
    
    for (const [key, value] of Object.entries(schema.shape)) {
      const zodField = value as z.ZodTypeAny;
      
      // Determine base type
      let type = "string";
      let items: any = undefined;
      
      if (zodField instanceof z.ZodNumber) {
        type = "number";
      } else if (zodField instanceof z.ZodBoolean) {
        type = "boolean";
      } else if (zodField instanceof z.ZodArray) {
        type = "array";
        const elementType = (zodField as any)._def?.type;
        if (elementType instanceof z.ZodNumber) {
          items = { type: "number" };
        } else if (elementType instanceof z.ZodString) {
          items = { type: "string" };
        } else if (elementType instanceof z.ZodObject) {
          items = { type: "object" };
        } else {
          items = { type: "string" };
        }
      } else if (zodField instanceof z.ZodObject) {
        type = "object";
      } else if (zodField instanceof z.ZodRecord) {
        type = "object";
      }
      
      // Build property schema
      properties[key] = { type };
      if (items) {
        properties[key].items = items;
      }
      
      // Add description if available
      const description = (zodField as any)._def?.description;
      if (description) {
        properties[key].description = description;
      }
      
      // Check if required
      if (!zodField.isOptional()) {
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

    // Special handling for tools that need parameter transformation
    let params = args;
    
    // Transform parameters for specific tools
    if (name === "addNote" && args) {
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
    } else if (name === "updateNote" && args) {
      params = {
        note: {
          id: args.id,
          fields: args.fields,
          tags: args.tags,
        }
      };
    }

    // Call the Anki-Connect API with proper typing
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