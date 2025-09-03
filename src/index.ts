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

    const data = await response.json() as { error?: string; result?: any };
    if (data.error) {throw new Error(data.error);}
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
    if (field instanceof z.ZodNumber) {type = "number";} else if (field instanceof z.ZodBoolean) {type = "boolean";} else if (field instanceof z.ZodArray) {
      type = "array";
      items = { type: "string" }; // Simplified
    } else if (field instanceof z.ZodObject || field instanceof z.ZodRecord) {
      type = "object";
    }

    properties[key] = { type };
    if (items) {properties[key].items = items;}
    if ((field as any)._def?.description) {
      properties[key].description = (field as any)._def.description;
    }
    if (!field.isOptional()) {required.push(key);}
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
    description: "List all deck names in your Anki collection. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum decks to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }) => {
      const allDecks = await ankiConnect("deckNames");
      const total = allDecks.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedDecks = allDecks.slice(offset, offset + effectiveLimit);
      
      return {
        decks: paginatedDecks,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
    description: "Get deck names and their IDs. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum entries to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }) => {
      const allDecks = await ankiConnect("deckNamesAndIds");
      const entries = Object.entries(allDecks);
      const total = entries.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedEntries = entries.slice(offset, offset + effectiveLimit);
      
      return {
        decks: Object.fromEntries(paginatedEntries),
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
    description: "Search for notes using Anki query syntax. Supports 'deck:current' for current deck. Returns paginated results",
    schema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current', 'deck:Default', 'tag:vocab')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum notes to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset, limit }) => {
      const allNotes = await ankiConnect("findNotes", { query });
      const total = allNotes.length;
      const effectiveLimit = Math.min(limit, 1000);
      const paginatedNotes = allNotes.slice(offset, offset + effectiveLimit);
      
      return {
        notes: paginatedNotes,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
        id: typeof id === "string" ? parseInt(id, 10) : id,
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
      notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  notesInfo: {
    description: "Get detailed information about notes. Automatically paginates large requests",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs (automatically batched if >100)"),
    }),
    handler: async ({ notes }) => {
      const noteIds = notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id);
      
      // Batch process if more than 100 notes
      if (noteIds.length <= 100) {
        return ankiConnect("notesInfo", { notes: noteIds });
      }
      
      // Process in batches of 100
      const batchSize = 100;
      const results = [];
      
      for (let i = 0; i < noteIds.length; i += batchSize) {
        const batch = noteIds.slice(i, i + batchSize);
        const batchResult = await ankiConnect("notesInfo", { notes: batch });
        results.push(...batchResult);
      }
      
      return {
        notes: results,
        metadata: {
          total: results.length,
          batches: Math.ceil(noteIds.length / batchSize),
          batchSize,
        }
      };
    },
  },
  
  getTags: {
    description: "Get all tags in the collection. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum tags to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }) => {
      const allTags = await ankiConnect("getTags");
      const total = allTags.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedTags = allTags.slice(offset, offset + effectiveLimit);
      
      return {
        tags: paginatedTags,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
  },
  
  addTags: {
    description: "Add tags to notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }) => ankiConnect("addTags", { 
      notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
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
      notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
      tags 
    }),
  },
  
  // === CARD OPERATIONS ===
  findCards: {
    description: "Find cards using Anki query syntax. Note: 'is:due' returns review cards only. Use getNextCards for learning+review queue order. Supports 'deck:current' for current deck. Returns paginated results",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'deck:current', 'deck:Default is:due', 'tag:japanese')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum cards to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset, limit }) => {
      const allCards = await ankiConnect("findCards", { query });
      const total = allCards.length;
      const effectiveLimit = Math.min(limit, 1000);
      const paginatedCards = allCards.slice(offset, offset + effectiveLimit);
      
      return {
        cards: paginatedCards,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
  },
  
  getNextCards: {
    description: "Get next cards in review queue following Anki's priority: 1) Learning cards (new/failed), 2) Review cards (due), 3) New cards. Returns cards in the order they'll appear. Supports pagination",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
      limit: z.number().describe("Maximum cards to return (default 10, max 100)").default(10),
      offset: z.number().describe("Starting position for pagination").default(0).optional(),
    }),
    handler: async ({ deck, limit, offset = 0 }) => {
      // Build deck prefix for queries
      const deckPrefix = deck === "current" ? "deck:current" : 
                        deck ? `deck:"${deck}"` : "";
      
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
      
      // Combine in priority order
      const allCards = [...learningCards, ...reviewCards, ...newCards];
      const total = allCards.length;
      const effectiveLimit = Math.min(limit, 100);
      const paginatedCards = allCards.slice(offset, offset + effectiveLimit);
      
      if (paginatedCards.length === 0) {
        return { 
          cards: [], 
          message: "No cards due for review",
          pagination: {
            offset,
            limit: effectiveLimit,
            total,
            hasMore: false
          }
        };
      }
      
      // Get detailed info for these cards
      const cardInfo = await ankiConnect("cardsInfo", { cards: paginatedCards });
      
      // Categorize by queue type
      const categorized = {
        learning: [] as any[],
        review: [] as any[],
        new: [] as any[],
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
        cards: cardInfo,
        breakdown: {
          learning: categorized.learning.length,
          review: categorized.review.length,
          new: categorized.new.length,
        },
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null
        },
        queueOrder: "Learning cards shown first, then reviews, then new cards"
      };
    },
  },
  
  cardsInfo: {
    description: "Get detailed card information. Automatically paginates large requests",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs (automatically batched if >100)"),
    }),
    handler: async ({ cards }) => {
      const cardIds = cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id);
      
      // Batch process if more than 100 cards
      if (cardIds.length <= 100) {
        return ankiConnect("cardsInfo", { cards: cardIds });
      }
      
      // Process in batches of 100
      const batchSize = 100;
      const results = [];
      
      for (let i = 0; i < cardIds.length; i += batchSize) {
        const batch = cardIds.slice(i, i + batchSize);
        const batchResult = await ankiConnect("cardsInfo", { cards: batch });
        results.push(...batchResult);
      }
      
      return {
        cards: results,
        metadata: {
          total: results.length,
          batches: Math.ceil(cardIds.length / batchSize),
          batchSize,
        }
      };
    },
  },
  
  suspend: {
    description: "Suspend cards from review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to suspend"),
    }),
    handler: async ({ cards }) => ankiConnect("suspend", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  unsuspend: {
    description: "Unsuspend cards for review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to unsuspend"),
    }),
    handler: async ({ cards }) => ankiConnect("unsuspend", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  getEaseFactors: {
    description: "Get ease factors for cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getEaseFactors", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
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
        cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
        easeFactors 
      }),
  },
  
  // === MODEL OPERATIONS ===
  modelNames: {
    description: "List all note types. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum models to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }) => {
      const allModels = await ankiConnect("modelNames");
      const total = allModels.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedModels = allModels.slice(offset, offset + effectiveLimit);
      
      return {
        models: paginatedModels,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
    description: "Get model names and their IDs. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum entries to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }) => {
      const allModels = await ankiConnect("modelNamesAndIds");
      const entries = Object.entries(allModels);
      const total = entries.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedEntries = entries.slice(offset, offset + effectiveLimit);
      
      return {
        models: Object.fromEntries(paginatedEntries),
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
    description: "Get due cards with detailed categorization by queue type (learning vs review). Use 'current' for current deck",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
    }),
    handler: async ({ deck }) => {
      // Query for different card states
      const baseQuery = deck === "current" ? "deck:current" :
                       deck ? `deck:"${deck}"` : "";
      
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
    description: "Get list of profiles. Returns paginated results",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum profiles to return (default 100, max 1000)"),
    }),
    handler: async ({ offset = 0, limit = 100 }) => {
      const allProfiles = await ankiConnect("getProfiles");
      const total = allProfiles.length;
      const effectiveLimit = Math.min(limit, 1000);
      const paginatedProfiles = allProfiles.slice(offset, offset + effectiveLimit);
      
      return {
        profiles: paginatedProfiles,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        }
      };
    },
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
  
  // === MISSING CRITICAL APIS ===
  
  // Card Operations
  canAddNotes: {
    description: "Check if notes can be added without actually adding them",
    schema: z.object({
      notes: z.array(z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        tags: z.array(z.string()).optional(),
      })).describe("Notes to check"),
    }),
    handler: async ({ notes }) => ankiConnect("canAddNotes", { notes }),
  },
  
  areSuspended: {
    description: "Check if cards are suspended",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }) => ankiConnect("areSuspended", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  areDue: {
    description: "Check if cards are due for review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }) => ankiConnect("areDue", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  getIntervals: {
    description: "Get review intervals for cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      complete: z.boolean().optional().describe("Return complete history"),
    }),
    handler: async ({ cards, complete }) => ankiConnect("getIntervals", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
      complete
    }),
  },
  
  cardsToNotes: {
    description: "Convert card IDs to note IDs",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsToNotes", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  cardsModTime: {
    description: "Get modification times for cards (15x faster than cardsInfo)",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsModTime", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  answerCards: {
    description: "Answer multiple cards programmatically",
    schema: z.object({
      answers: z.array(z.object({
        cardId: z.union([z.number(), z.string()]),
        ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
      })).describe("Card answers"),
    }),
    handler: async ({ answers }) => ankiConnect("answerCards", { 
      answers: answers.map((a: any) => ({
        cardId: typeof a.cardId === "string" ? parseInt(a.cardId, 10) : a.cardId,
        ease: a.ease
      }))
    }),
  },
  
  forgetCards: {
    description: "Reset cards to new state",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to reset"),
    }),
    handler: async ({ cards }) => ankiConnect("forgetCards", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  relearnCards: {
    description: "Put cards into relearning queue",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("relearnCards", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  setSpecificValueOfCard: {
    description: "Set specific card values (use with caution)",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
      keys: z.array(z.string()).describe("Field keys to update"),
      newValues: z.array(z.string()).describe("New values for keys"),
      warningCheck: z.boolean().optional().describe("Required for dangerous fields"),
    }),
    handler: async ({ card, keys, newValues, warningCheck }) => 
      ankiConnect("setSpecificValueOfCard", { 
        card: typeof card === "string" ? parseInt(card, 10) : card,
        keys,
        newValues,
        warning_check: warningCheck
      }),
  },
  
  // Deck Operations
  getDecks: {
    description: "Get which decks cards belong to",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getDecks", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  changeDeck: {
    description: "Move cards to a different deck",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to move"),
      deck: z.string().describe("Target deck name"),
    }),
    handler: async ({ cards, deck }) => ankiConnect("changeDeck", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
      deck
    }),
  },
  
  saveDeckConfig: {
    description: "Save deck configuration",
    schema: z.object({
      config: z.record(z.any()).describe("Deck configuration object"),
    }),
    handler: async ({ config }) => ankiConnect("saveDeckConfig", { config }),
  },
  
  setDeckConfigId: {
    description: "Change deck configuration group",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names"),
      configId: z.number().describe("Configuration ID"),
    }),
    handler: async ({ decks, configId }) => 
      ankiConnect("setDeckConfigId", { decks, configId }),
  },
  
  cloneDeckConfigId: {
    description: "Clone deck configuration",
    schema: z.object({
      name: z.string().describe("New config name"),
      cloneFrom: z.number().optional().describe("Config ID to clone from"),
    }),
    handler: async ({ name, cloneFrom }) => 
      ankiConnect("cloneDeckConfigId", { name, cloneFrom }),
  },
  
  removeDeckConfigId: {
    description: "Remove deck configuration",
    schema: z.object({
      configId: z.number().describe("Configuration ID to remove"),
    }),
    handler: async ({ configId }) => 
      ankiConnect("removeDeckConfigId", { configId }),
  },
  
  // Model Operations
  modelFieldsOnTemplates: {
    description: "Get which fields are used in templates",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelFieldsOnTemplates", { modelName }),
  },
  
  modelTemplates: {
    description: "Get card templates for a model",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelTemplates", { modelName }),
  },
  
  modelStyling: {
    description: "Get CSS styling for a model",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelStyling", { modelName }),
  },
  
  updateModelTemplates: {
    description: "Update model templates",
    schema: z.object({
      model: z.object({
        name: z.string(),
        templates: z.record(z.object({
          Front: z.string(),
          Back: z.string(),
        })),
      }),
    }),
    handler: async ({ model }) => 
      ankiConnect("updateModelTemplates", { model }),
  },
  
  updateModelStyling: {
    description: "Update model CSS styling",
    schema: z.object({
      model: z.object({
        name: z.string(),
        css: z.string(),
      }),
    }),
    handler: async ({ model }) => 
      ankiConnect("updateModelStyling", { model }),
  },
  
  // Note Operations
  updateNoteFields: {
    description: "Update only note fields (simpler than updateNote)",
    schema: z.object({
      note: z.object({
        id: z.union([z.number(), z.string()]),
        fields: z.record(z.string()),
      }),
    }),
    handler: async ({ note }) => ankiConnect("updateNoteFields", { 
      note: {
        id: typeof note.id === "string" ? parseInt(note.id, 10) : note.id,
        fields: note.fields
      }
    }),
  },
  
  getNoteTags: {
    description: "Get tags for specific notes",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }) => ankiConnect("getNoteTags", { 
      note: typeof note === "string" ? parseInt(note, 10) : note
    }),
  },
  
  clearUnusedTags: {
    description: "Remove tags not used by any notes",
    schema: z.object({}),
    handler: async () => ankiConnect("clearUnusedTags"),
  },
  
  replaceTags: {
    description: "Replace tags in specific notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({ notes, tagToReplace, replaceWithTag }) => 
      ankiConnect("replaceTags", { 
        notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag
      }),
  },
  
  replaceTagsInAllNotes: {
    description: "Global tag replacement across all notes",
    schema: z.object({
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({ tagToReplace, replaceWithTag }) => 
      ankiConnect("replaceTagsInAllNotes", { 
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag
      }),
  },
  
  removeEmptyNotes: {
    description: "Delete notes with no cards",
    schema: z.object({}),
    handler: async () => ankiConnect("removeEmptyNotes"),
  },
  
  notesModTime: {
    description: "Get modification times for notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
    }),
    handler: async ({ notes }) => ankiConnect("notesModTime", { 
      notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  // Statistics
  cardReviews: {
    description: "Get review history for cards",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      startID: z.number().optional().describe("Start review ID"),
    }),
    handler: async ({ deck, startID }) => 
      ankiConnect("cardReviews", { deck, startID }),
  },
  
  getLatestReviewID: {
    description: "Get ID of most recent review",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }) => 
      ankiConnect("getLatestReviewID", { deck }),
  },
  
  getReviewsOfCards: {
    description: "Get reviews for specific cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getReviewsOfCards", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  // GUI Operations
  guiSelectedNotes: {
    description: "Get selected notes in browser",
    schema: z.object({}),
    handler: async () => ankiConnect("guiSelectedNotes"),
  },
  
  guiSelectCard: {
    description: "Select a card in the browser",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
    }),
    handler: async ({ card }) => ankiConnect("guiSelectCard", { 
      card: typeof card === "string" ? parseInt(card, 10) : card
    }),
  },
  
  guiEditNote: {
    description: "Open edit dialog for note",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }) => ankiConnect("guiEditNote", { 
      note: typeof note === "string" ? parseInt(note, 10) : note
    }),
  },
  
  guiStartCardTimer: {
    description: "Start timer for current card",
    schema: z.object({}),
    handler: async () => ankiConnect("guiStartCardTimer"),
  },
  
  guiShowQuestion: {
    description: "Show question side of current card",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowQuestion"),
  },
  
  guiShowAnswer: {
    description: "Show answer side of current card",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowAnswer"),
  },
  
  guiUndo: {
    description: "Undo last action",
    schema: z.object({}),
    handler: async () => ankiConnect("guiUndo"),
  },
  
  guiDeckBrowser: {
    description: "Open deck browser",
    schema: z.object({}),
    handler: async () => ankiConnect("guiDeckBrowser"),
  },
  
  guiDeckReview: {
    description: "Start deck review",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }) => ankiConnect("guiDeckReview", { name }),
  },
  
  guiCheckDatabase: {
    description: "Check database integrity",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCheckDatabase"),
  },
  
  guiImportFile: {
    description: "Import file dialog",
    schema: z.object({
      path: z.string().optional().describe("File path to import"),
    }),
    handler: async ({ path }) => ankiConnect("guiImportFile", { path }),
  },
  
  // Media Operations
  getMediaDirPath: {
    description: "Get path to media folder",
    schema: z.object({}),
    handler: async () => ankiConnect("getMediaDirPath"),
  },
  
  // System Operations
  version: {
    description: "Get Anki-Connect version",
    schema: z.object({}),
    handler: async () => ankiConnect("version"),
  },
  
  requestPermission: {
    description: "Request API permission",
    schema: z.object({}),
    handler: async () => ankiConnect("requestPermission"),
  },
  
  apiReflect: {
    description: "Get information about available API actions",
    schema: z.object({
      scopes: z.array(z.string()).optional().describe("Scopes to query"),
      actions: z.array(z.string()).optional().describe("Actions to check"),
    }),
    handler: async ({ scopes, actions }) => 
      ankiConnect("apiReflect", { scopes, actions }),
  },
  
  reloadCollection: {
    description: "Reload database from disk",
    schema: z.object({}),
    handler: async () => ankiConnect("reloadCollection"),
  },
  
  multi: {
    description: "Execute multiple actions in one request",
    schema: z.object({
      actions: z.array(z.object({
        action: z.string(),
        params: z.any().optional(),
        version: z.number().optional(),
      })).describe("Actions to execute"),
    }),
    handler: async ({ actions }) => ankiConnect("multi", { actions }),
  },
  
  getActiveProfile: {
    description: "Get currently active profile",
    schema: z.object({}),
    handler: async () => ankiConnect("getActiveProfile"),
  },
  
  setDueDate: {
    description: "Set due date for cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      days: z.string().describe("Days string (e.g., '1', '3-7', '0' for today)"),
    }),
    handler: async ({ cards, days }) => ankiConnect("setDueDate", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
      days
    }),
  },
  
  suspended: {
    description: "Check if a single card is suspended",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
    }),
    handler: async ({ card }) => ankiConnect("suspended", { 
      card: typeof card === "string" ? parseInt(card, 10) : card
    }),
  },
};

// Create MCP server
const server = new Server(
  { 
    name: "anki-mcp-server", 
    version: "1.1.0"
  },
  { 
    capabilities: { 
      tools: {},
      pagination: {
        maxPageSize: 1000,
        defaultPageSize: 100
      }
    }
  }
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