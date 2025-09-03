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

// Define all tools
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
  
  deckNamesAndIds: {
    description: "Get deck names and their IDs",
    schema: z.object({}),
    handler: async () => ankiConnect("deckNamesAndIds"),
  },
  
  getDeckConfig: {
    description: "Get configuration for a deck",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }) => ankiConnect("getDeckConfig", { deck }),
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
  addNotes: {
    description: "Bulk create multiple notes",
    schema: z.object({
      notes: z.array(z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        tags: z.array(z.string()).optional(),
        options: z.object({
          allowDuplicate: z.boolean().optional(),
        }).optional(),
      })),
    }),
    handler: async ({ notes }) => ankiConnect("addNotes", { notes }),
  },
  
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
      id: z.union([z.number(), z.string()]).describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z.array(z.string()).optional().describe("New tags"),
    }),
    handler: async ({ id, fields, tags }) => ankiConnect("updateNote", {
      note: { 
        id: typeof id === 'string' ? parseInt(id, 10) : id,
        fields, 
        tags 
      }
    }),
  },
  
  deleteNotes: {
    description: "Delete notes by ID",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs to delete"),
    }),
    handler: async ({ notes }) => ankiConnect("deleteNotes", { 
      notes: notes.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  notesInfo: {
    description: "Get detailed information about notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
    }),
    handler: async ({ notes }) => ankiConnect("notesInfo", { 
      notes: notes.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  getTags: {
    description: "Get all tags in the collection",
    schema: z.object({}),
    handler: async () => ankiConnect("getTags"),
  },
  
  addTags: {
    description: "Add tags to notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }) => ankiConnect("addTags", { 
      notes: notes.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id),
      tags 
    }),
  },
  
  removeTags: {
    description: "Remove tags from notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }) => ankiConnect("removeTags", { 
      notes: notes.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id),
      tags 
    }),
  },
  
  // === CARD OPERATIONS ===
  findCards: {
    description: "Find cards using Anki query syntax. Note: 'is:due' returns review cards only. Use getNextCards for learning+review queue order. Supports 'deck:current' for current deck",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'deck:current', 'deck:Default is:due', 'tag:japanese')"),
    }),
    handler: async ({ query }) => ankiConnect("findCards", { query }),
  },
  
  getNextCards: {
    description: "Get next cards in review queue following Anki's priority: 1) Learning cards (new/failed), 2) Review cards (due), 3) New cards. Returns cards in the order they'll appear",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
      limit: z.number().describe("Maximum cards to return").default(10),
    }),
    handler: async ({ deck, limit }) => {
      // Build deck prefix for queries
      const deckPrefix = deck === 'current' ? 'deck:current' : 
                        deck ? `deck:"${deck}"` : '';
      
      // Get learning cards first (queue=1 or queue=3)
      const learningQuery = deckPrefix 
        ? `${deckPrefix} (queue:1 OR queue:3)`
        : "(queue:1 OR queue:3)";
      const learningCards = await ankiConnect("findCards", { query: learningQuery });
      
      // Get review cards (queue=2 and due)
      const reviewQuery = deckPrefix
        ? `${deckPrefix} is:due`
        : "is:due";
      const reviewCards = await ankiConnect("findCards", { query: reviewQuery });
      
      // Get new cards if needed (queue=0)
      const newQuery = deckPrefix
        ? `${deckPrefix} is:new`
        : "is:new";
      const newCards = await ankiConnect("findCards", { query: newQuery });
      
      // Combine in priority order and limit
      const allCards = [...learningCards, ...reviewCards, ...newCards].slice(0, limit);
      
      if (allCards.length === 0) {
        return { cards: [], message: "No cards due for review" };
      }
      
      // Get detailed info for these cards
      const cardInfo = await ankiConnect("cardsInfo", { cards: allCards });
      
      // Categorize by queue type
      const categorized = {
        learning: [],
        review: [],
        new: [],
      };
      
      for (const card of cardInfo) {
        if (card.queue === 1 || card.queue === 3) {
          categorized.learning.push(card);
        } else if (card.queue === 2) {
          categorized.review.push(card);
        } else if (card.queue === 0) {
          categorized.new.push(card);
        }
      }
      
      return {
        totalCards: allCards.length,
        cards: cardInfo,
        breakdown: {
          learning: categorized.learning.length,
          review: categorized.review.length,
          new: categorized.new.length,
        },
        queueOrder: "Learning cards shown first, then reviews, then new cards"
      };
    },
  },
  
  cardsInfo: {
    description: "Get detailed card information",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsInfo", { 
      cards: cards.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  suspend: {
    description: "Suspend cards from review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to suspend"),
    }),
    handler: async ({ cards }) => ankiConnect("suspend", { 
      cards: cards.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  unsuspend: {
    description: "Unsuspend cards for review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to unsuspend"),
    }),
    handler: async ({ cards }) => ankiConnect("unsuspend", { 
      cards: cards.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  getEaseFactors: {
    description: "Get ease factors for cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getEaseFactors", { 
      cards: cards.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
    }),
  },
  
  setEaseFactors: {
    description: "Set ease factors for cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      easeFactors: z.array(z.number()).describe("Ease factors (1.3-2.5)"),
    }),
    handler: async ({ cards, easeFactors }) => 
      ankiConnect("setEaseFactors", { 
        cards: cards.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id),
        easeFactors 
      }),
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
  
  modelNamesAndIds: {
    description: "Get model names and their IDs",
    schema: z.object({}),
    handler: async () => ankiConnect("modelNamesAndIds"),
  },
  
  createModel: {
    description: "Create a custom note type",
    schema: z.object({
      modelName: z.string().describe("Model name"),
      inOrderFields: z.array(z.string()).describe("Field names"),
      css: z.string().optional().describe("Card CSS"),
      isCloze: z.boolean().optional(),
      cardTemplates: z.array(z.object({
        Name: z.string().optional(),
        Front: z.string(),
        Back: z.string(),
      })),
    }),
    handler: async (args) => ankiConnect("createModel", args),
  },
  
  // === STATISTICS ===
  getNumCardsReviewedToday: {
    description: "Get today's review count",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedToday"),
  },
  
  getDueCardsDetailed: {
    description: "Get due cards with detailed categorization by queue type (learning vs review)",
    schema: z.object({
      deck: z.string().describe("Deck name").optional(),
    }),
    handler: async ({ deck }) => {
      // Query for different card states
      const baseQuery = deck ? `deck:"${deck}"` : "";
      
      // Learning cards (queue 1 or 3, due soon)
      const learningQuery = baseQuery ? `${baseQuery} (queue:1 OR queue:3)` : "(queue:1 OR queue:3)";
      const learningCards = await ankiConnect("findCards", { query: learningQuery });
      
      // Review cards (queue 2, due today or overdue)
      const reviewQuery = baseQuery ? `${baseQuery} is:due` : "is:due";
      const reviewCards = await ankiConnect("findCards", { query: reviewQuery });
      
      // Get info for all cards
      const allCardIds = [...learningCards, ...reviewCards];
      if (allCardIds.length === 0) {
        return { learning: [], review: [], total: 0 };
      }
      
      const cardInfo = await ankiConnect("cardsInfo", { cards: allCardIds });
      
      // Separate by actual queue type
      const learning = [];
      const review = [];
      
      for (const card of cardInfo) {
        // Queue meanings:
        // 0 = new, 1 = learning, 2 = review, 3 = relearning
        if (card.queue === 1 || card.queue === 3) {
          learning.push({
            cardId: card.cardId,
            front: card.fields?.Front?.value || card.fields?.Simplified?.value || "N/A",
            interval: card.interval,
            due: card.due,
            queue: card.queue === 1 ? "learning" : "relearning",
            reps: card.reps,
          });
        } else if (card.queue === 2 && card.due <= Math.floor(Date.now() / 1000 / 86400)) {
          review.push({
            cardId: card.cardId,
            front: card.fields?.Front?.value || card.fields?.Simplified?.value || "N/A",
            interval: card.interval,
            due: card.due,
            queue: "review",
            ease: card.factor,
          });
        }
      }
      
      // Sort learning by due time (most urgent first)
      learning.sort((a, b) => a.due - b.due);
      
      // Sort review by due date
      review.sort((a, b) => a.due - b.due);
      
      return {
        learning: learning,
        review: review,
        total: learning.length + review.length,
        note: "Learning cards (including relearning) are shown before review cards in Anki"
      };
    },
  },
  
  getNumCardsReviewedByDay: {
    description: "Get review counts by day",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedByDay"),
  },
  
  getCollectionStatsHTML: {
    description: "Get collection statistics as HTML",
    schema: z.object({
      wholeCollection: z.boolean().optional().default(true),
    }),
    handler: async ({ wholeCollection }) => 
      ankiConnect("getCollectionStatsHTML", { wholeCollection }),
  },
  
  // === MEDIA ===
  storeMediaFile: {
    description: "Store a media file",
    schema: z.object({
      filename: z.string().describe("File name"),
      data: z.string().optional().describe("Base64 data"),
      url: z.string().optional().describe("URL to download"),
      path: z.string().optional().describe("File path"),
      deleteExisting: z.boolean().optional().default(true),
    }),
    handler: async (args) => ankiConnect("storeMediaFile", args),
  },
  
  retrieveMediaFile: {
    description: "Retrieve a media file",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }) => 
      ankiConnect("retrieveMediaFile", { filename }),
  },
  
  getMediaFilesNames: {
    description: "Get media file names",
    schema: z.object({
      pattern: z.string().optional().describe("File pattern"),
    }),
    handler: async ({ pattern }) => 
      ankiConnect("getMediaFilesNames", { pattern }),
  },
  
  deleteMediaFile: {
    description: "Delete a media file",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }) => 
      ankiConnect("deleteMediaFile", { filename }),
  },
  
  // === MISCELLANEOUS ===
  sync: {
    description: "Sync with AnkiWeb",
    schema: z.object({}),
    handler: async () => ankiConnect("sync"),
  },
  
  getProfiles: {
    description: "Get list of profiles",
    schema: z.object({}),
    handler: async () => ankiConnect("getProfiles"),
  },
  
  loadProfile: {
    description: "Load a profile",
    schema: z.object({
      name: z.string().describe("Profile name"),
    }),
    handler: async ({ name }) => ankiConnect("loadProfile", { name }),
  },
  
  exportPackage: {
    description: "Export deck as .apkg file",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      path: z.string().describe("Export path"),
      includeSched: z.boolean().optional().default(false),
    }),
    handler: async ({ deck, path, includeSched }) => 
      ankiConnect("exportPackage", { deck, path, includeSched }),
  },
  
  importPackage: {
    description: "Import .apkg file",
    schema: z.object({
      path: z.string().describe("Import path"),
    }),
    handler: async ({ path }) => ankiConnect("importPackage", { path }),
  },
  
  // === GUI OPERATIONS ===
  guiBrowse: {
    description: "Open card browser",
    schema: z.object({
      query: z.string().describe("Search query"),
      reorderCards: z.object({
        order: z.enum(["ascending", "descending"]).optional(),
        columnId: z.string().optional(),
      }).optional(),
    }),
    handler: async (args) => ankiConnect("guiBrowse", args),
  },
  
  guiAddCards: {
    description: "Open Add Cards dialog",
    schema: z.object({
      note: z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        tags: z.array(z.string()).optional(),
      }),
    }),
    handler: async ({ note }) => ankiConnect("guiAddCards", { note }),
  },
  
  guiCurrentCard: {
    description: "Get current review card",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCurrentCard"),
  },
  
  guiAnswerCard: {
    description: "Answer current card",
    schema: z.object({
      ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
    }),
    handler: async ({ ease }) => ankiConnect("guiAnswerCard", { ease }),
  },
  
  guiDeckOverview: {
    description: "Show deck overview",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }) => ankiConnect("guiDeckOverview", { name }),
  },
  
  guiExitAnki: {
    description: "Exit Anki",
    schema: z.object({}),
    handler: async () => ankiConnect("guiExitAnki"),
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
  console.error("Anki MCP server running on stdio");
  console.error(`Connected to Anki-Connect at ${ANKI_CONNECT_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});