#!/usr/bin/env node

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
const DEBUG = process.env.DEBUG === "true";

// Debug logging helper (writes to stderr which shows in stdio)
function debug(message: string, data?: unknown) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data) : "");
  }
}

// Utility function to normalize tags from various formats
function normalizeTags(tags: unknown): string[] {
  debug("normalizeTags input:", tags);
  
  // Already an array - return as is
  if (Array.isArray(tags)) {
    debug("Tags already array");
    return tags;
  }
  
  // String that might be JSON or space-separated
  if (typeof tags === "string") {
    // Try parsing as JSON array
    if (tags.startsWith("[")) {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          debug("Parsed tags from JSON:", parsed);
          return parsed;
        }
      } catch {
        debug("Failed to parse JSON tags, using space-split");
      }
    }
    
    // Fall back to space-separated
    const split = tags.split(" ").filter(t => t.trim());
    debug("Split tags by space:", split);
    return split;
  }
  
  debug("Unknown tag format, returning empty array");
  return [];
}

// Utility to normalize fields from various formats
function normalizeFields(fields: unknown): object | undefined {
  debug("normalizeFields input:", fields);
  
  if (!fields) {return undefined;}
  
  // Already an object
  if (typeof fields === "object" && !Array.isArray(fields)) {
    debug("Fields already object");
    return fields;
  }
  
  // String that might be JSON
  if (typeof fields === "string") {
    try {
      const parsed = JSON.parse(fields);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        debug("Parsed fields from JSON:", parsed);
        return parsed;
      }
    } catch {
      debug("Failed to parse JSON fields");
    }
  }
  
  debug("Unknown fields format, returning undefined");
  return undefined;
}

// Helper for base64 encoding (for media operations)
function _encodeBase64(data: string | Buffer): string {
  if (typeof data === "string") {
    return Buffer.from(data).toString("base64");
  }
  return data.toString("base64");
}

// Type definitions for Anki-Connect responses
type AnkiConnectResponses = {
  deckNames: string[];
  deckNamesAndIds: Record<string, number>;
  getDeckStats: Record<string, { new_count: number; learn_count: number; review_count: number; total_in_deck: number }>;
  getDeckConfig: Record<string, unknown>;
  createDeck: number;
  deleteDecks: true;
  findNotes: number[];
  findCards: number[];
  addNote: number;
  addNotes: (number | null)[];
  updateNote: true;
  deleteNotes: true;
  notesInfo: Array<{ noteId: number; modelName: string; tags: string[]; fields: Record<string, { value: string; order: number }>; cards: number[] }>;
  cardsInfo: Array<{ cardId: number; queue: number; interval: number; due: number; reps: number; factor: number; fields?: Record<string, { value: string }> }>;
  getTags: string[];
  addTags: true;
  removeTags: true;
  suspend: true;
  unsuspend: true;
  getEaseFactors: number[];
  setEaseFactors: true;
  modelNames: string[];
  modelFieldNames: string[];
  modelNamesAndIds: Record<string, number>;
  createModel: Record<string, unknown>;
  getNumCardsReviewedToday: number;
  getNumCardsReviewedByDay: Record<string, number>;
  getCollectionStatsHTML: string;
  storeMediaFile: string;
  retrieveMediaFile: string | false;
  getMediaFilesNames: string[];
  deleteMediaFile: true;
  sync: true;
  getProfiles: string[];
  loadProfile: true;
  exportPackage: true;
  importPackage: true;
  guiBrowse: number[];
  guiAddCards: number | null;
  guiCurrentCard: Record<string, unknown> | null;
  guiAnswerCard: true;
  guiDeckOverview: true;
  guiExitAnki: true;
  canAddNotes: boolean[];
  areSuspended: boolean[];
  areDue: boolean[];
  getIntervals: number[];
  cardsToNotes: number[];
  cardsModTime: number[];
  answerCards: boolean[];
  forgetCards: true;
  relearnCards: true;
  setSpecificValueOfCard: true;
  getDecks: string[];
  changeDeck: true;
  saveDeckConfig: true;
  setDeckConfigId: true;
  cloneDeckConfigId: number;
  removeDeckConfigId: true;
  modelFieldsOnTemplates: Record<string, string[]>;
  modelTemplates: Record<string, { Front: string; Back: string }>;
  modelStyling: string;
  updateModelTemplates: Record<string, unknown>;
  updateModelStyling: true;
  updateNoteFields: true;
  getNoteTags: string[];
  clearUnusedTags: true;
  replaceTags: true;
  replaceTagsInAllNotes: true;
  removeEmptyNotes: number;
  notesModTime: number[];
  cardReviews: Array<{ reviewTime: number; cardID: number; ease: number; interval: number; lastInterval: number; factor: number; reviewDuration: number }>;
  getLatestReviewID: number | null;
  getReviewsOfCards: Array<{ reviewTime: number; cardID: number; ease: number; interval: number; lastInterval: number; factor: number; reviewDuration: number }>;
  guiSelectedNotes: number[];
  guiSelectCard: true;
  guiEditNote: Record<string, unknown> | null;
  guiStartCardTimer: true;
  guiShowQuestion: true;
  guiShowAnswer: true;
  guiUndo: boolean;
  guiDeckBrowser: true;
  guiDeckReview: string;
  guiCheckDatabase: string;
  guiImportFile: Record<string, unknown> | null;
  getMediaDirPath: string;
  version: number;
  requestPermission: { permission: string; version: number };
  apiReflect: { scopes: string[]; actions: string[] };
  reloadCollection: true;
  multi: unknown[];
  getActiveProfile: string;
  setDueDate: true;
  suspended: boolean;
};

// Anki-Connect API helper with improved error handling
async function ankiConnect<T extends keyof AnkiConnectResponses>(
  action: T, 
  params?: Record<string, unknown>
): Promise<AnkiConnectResponses[T]>;
async function ankiConnect(action: string, params?: Record<string, unknown>): Promise<unknown>;
async function ankiConnect(
  action: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
    });

    const data = await response.json() as { error?: string; result?: unknown };
    if (data.error) {
      // Clean up nested error messages and provide helpful context
      const cleanError = data.error.replace(/^Anki-Connect: /, "");

      // Provide more helpful messages for common errors
      let errorMessage = `${action}: ${cleanError}`;

      if (cleanError.includes("duplicate")) {
        errorMessage = `${action}: Note already exists with this content. ${cleanError.includes("allowDuplicate") ? "Set allowDuplicate:true to bypass this check." : "Use allowDuplicate parameter or modify the note content."}`;
      } else if (cleanError.includes("deck") && cleanError.includes("not found")) {
        errorMessage = `${action}: Deck not found. Create the deck first or check the deck name spelling.`;
      } else if (cleanError.includes("model") && cleanError.includes("not found")) {
        errorMessage = `${action}: Note type (model) not found. Check the modelName parameter.`;
      } else if (cleanError.includes("field")) {
        errorMessage = `${action}: Field error - ${cleanError}. Check that field names match the note type exactly (case-sensitive).`;
      }

      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
    return data.result;
  } catch (error: unknown) {
    // Only catch network errors or JSON parse errors here
    if (error instanceof McpError) {
      throw error; // Re-throw McpError as-is
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Anki-Connect connection error: ${errorMessage}`
    );
  }
}

// Simplified Zod to JSON Schema converter
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (!(schema instanceof z.ZodObject)) {
    return { type: "object", properties: {} };
  }

  Object.entries(schema.shape).forEach(([key, value]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let field: any = value;
    let isOptional = false;

    // Unwrap all wrapper types (ZodOptional, ZodDefault) in any order
    while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
      if (field instanceof z.ZodOptional) {
        isOptional = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      } else if (field instanceof z.ZodDefault) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      }
    }

    let type = "string";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any = undefined;

    // Determine type based on Zod type
    if (field instanceof z.ZodNumber) {
      type = "number";
    } else if (field instanceof z.ZodBoolean) {
      type = "boolean";
    } else if (field instanceof z.ZodArray) {
      type = "array";
      // Get the inner type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let innerField: any = field._def.type;

      // Unwrap optional inner types
      while (innerField instanceof z.ZodOptional) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        innerField = (innerField as any).innerType || innerField._def.innerType;
      }

      if (innerField instanceof z.ZodNumber) {
        items = { type: "number" };
      } else if (innerField instanceof z.ZodBoolean) {
        items = { type: "boolean" };
      } else if (innerField instanceof z.ZodObject) {
        // Recursively convert nested object schema
        items = zodToJsonSchema(innerField);
      } else if (innerField instanceof z.ZodUnion) {
        // For unions in arrays, default to string
        items = { type: "string" };
      } else {
        items = { type: "string" };
      }
    } else if (field instanceof z.ZodObject) {
      type = "object";
    } else if (field instanceof z.ZodUnion) {
      // For unions, check if all are the same type
      const types = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field._def.options.forEach((opt: any) => {
        if (opt instanceof z.ZodNumber) {
          types.add("number");
        } else if (opt instanceof z.ZodString) {
          types.add("string");
        } else if (opt instanceof z.ZodBoolean) {
          types.add("boolean");
        } else {
          types.add("string");
        }
      });

      // If all same type, use that type
      if (types.size === 1) {
        const typeArray = Array.from(types);
        if (typeArray[0]) {
          type = typeArray[0];
        } else {
          type = "string";
        }
      } else {
        // Multiple types - default to string for simplicity
        type = "string";
      }
    } else if (field instanceof z.ZodRecord) {
      type = "object";
    }

    const prop: Record<string, unknown> = { type };
    if (items) { prop.items = items; }

    // Get description from Zod
    const fieldDef = (value as { _def?: { description?: string } })._def;
    if (fieldDef?.description) {
      prop.description = fieldDef.description;
    }

    properties[key] = prop;

    // Check if field is required (not optional)
    if (!isOptional && !(value instanceof z.ZodOptional)) {
      required.push(key);
    }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<unknown>;
}

// Define all tools
const tools: Record<string, ToolDef> = {
  // === DECK OPERATIONS ===
  deckNames: {
    description: "Gets the complete list of deck names for the current user. Returns all decks including nested decks (formatted as 'Parent::Child'). Useful for getting an overview of available decks before performing operations. Returns paginated results to handle large collections efficiently",
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
    description: "Creates a new empty deck. Will not overwrite a deck that exists with the same name. Use '::' separator for nested decks (e.g., 'Japanese::JLPT N5'). Returns the deck ID on success. Safe to call multiple times - acts as 'ensure exists' operation",
    schema: z.object({
      deck: z.string().describe("Deck name (use :: for nested decks)"),
    }),
    handler: async ({ deck }) => ankiConnect("createDeck", { deck }),
  },
  
  getDeckStats: {
    description: "Gets detailed statistics for specified decks including: new_count (blue cards), learn_count (red cards in learning), review_count (green cards due), and total_in_deck. Essential for understanding deck workload and progress. Returns stats keyed by deck ID",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to get stats for"),
    }),
    handler: async ({ decks }) => ankiConnect("getDeckStats", { decks }),
  },
  
  deckNamesAndIds: {
    description: "Gets complete mapping of deck names to their internal IDs. IDs are persistent and used internally by Anki. Useful when you need to work with deck IDs directly or correlate names with IDs. Returns object with deck names as keys and IDs as values. Paginated for large collections",
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
    description: "Gets the configuration group object for a deck. Contains review settings like: new cards per day, review limits, ease factors, intervals, leech thresholds, and more. Decks can share config groups. Understanding config is crucial for optimizing learning efficiency",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }) => ankiConnect("getDeckConfig", { deck }),
  },
  
  deleteDecks: {
    description: "Permanently deletes specified decks. CAUTION: Setting cardsToo=true (default) will delete all cards in the decks. Cards cannot be recovered after deletion. cardsToo MUST be explicitly set. Deleting parent deck deletes all subdecks. Returns true on success",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to delete"),
      cardsToo: z.boolean().default(true).describe("Also delete cards"),
    }),
    handler: async ({ decks, cardsToo }) => {
      const result = await ankiConnect("deleteDecks", { decks, cardsToo });
      return result === null ? true : result; // Normalize null to true
    },
  },
  
  // === NOTE OPERATIONS ===
  addNotes: {
    description: "Bulk create multiple notes in a single operation. Each note creates one or more cards based on the model's templates. Returns array of note IDs (null for failures). More efficient than multiple addNote calls. Duplicates return null unless allowDuplicate=true. Note: Fields must match the model's field names exactly",
    schema: z.object({
      notes: z.array(z.union([
        z.object({
          deckName: z.string(),
          modelName: z.string(),
          fields: z.record(z.string()),
          tags: z.array(z.string()).optional(),
          options: z.object({
            allowDuplicate: z.boolean().optional(),
          }).optional(),
        }),
        z.string()  // Allow JSON string representation
      ])),
    }),
    handler: async ({ notes }) => {
      debug("addNotes called with:", notes);
      
      // Parse and normalize notes
      const parsedNotes = notes.map((note: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsedNote: any = note;
        if (typeof note === "string") {
          try {
            parsedNote = JSON.parse(note);
          } catch (_e) {
            throw new Error("Invalid note format");
          }
        }
        
        // Normalize tags using utility
        if (parsedNote.tags) {
          parsedNote.tags = normalizeTags(parsedNote.tags);
        }
        
        return parsedNote;
      });
      
      return ankiConnect("addNotes", { notes: parsedNotes });
    },
  },
  
  addNote: {
    description: "Creates a single note (fact) which generates cards based on the model's templates. Basic model creates 1 card, Cloze can create many. Returns the new note ID. Fields must match the model exactly (case-sensitive). Common models: 'Basic' (Front/Back), 'Basic (and reversed card)' (Front/Back, creates 2 cards), 'Cloze' (Text/Extra, use {{c1::text}}). Tags are passed as an array of strings. IMPORTANT: Field names are case-sensitive and must exactly match the model's field names. Use modelFieldNames to check exact field names first",
    schema: z.object({
      deckName: z.string().describe("Target deck"),
      modelName: z.string().describe("Note type (e.g., 'Basic', 'Cloze')"),
      fields: z.record(z.string()).describe("Field content"),
      tags: z.union([z.array(z.string()), z.string()]).optional().describe("Tags"),
      allowDuplicate: z.boolean().optional().describe("Allow duplicates"),
    }),
    handler: async (args) => {
      debug("addNote called with:", args);
      const tags = args.tags ? normalizeTags(args.tags) : [];
      
      return ankiConnect("addNote", {
        note: {
          deckName: args.deckName,
          modelName: args.modelName,
          fields: args.fields,
          tags,
          options: { allowDuplicate: args.allowDuplicate || false },
        }
      });
    },
  },
  
  findNotes: {
    description: "Search for notes using Anki's powerful query syntax. Returns note IDs matching the query. Common queries: 'deck:DeckName' (notes in deck), 'tag:tagname' (tagged notes), 'is:new' (new notes), 'is:due' (notes with due cards), 'added:7' (added in last 7 days), 'front:text' (search Front field), '*' (all notes). Combine with AND/OR. IMPORTANT: Deck names with '::' hierarchy need quotes: 'deck:\"Parent::Child\"'. Returns paginated results for large collections. Note: Returns notes, not cards",
    schema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current', 'deck:Default', 'tag:vocab')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum notes to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset = 0, limit = 100 }) => {
      try {
        const allNotes = await ankiConnect("findNotes", { query });
        const total = Array.isArray(allNotes) ? allNotes.length : 0;
        const effectiveLimit = Math.min(limit, 1000);
        const paginatedNotes = Array.isArray(allNotes) ? allNotes.slice(offset, offset + effectiveLimit) : [];
        
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
      } catch (_error) {
        // Return empty result set on error
        return {
          notes: [],
          pagination: {
            offset,
            limit: Math.min(limit, 1000),
            total: 0,
            hasMore: false,
            nextOffset: null,
          }
        };
      }
    },
  },
  
  updateNote: {
    description: "Updates an existing note's fields and/or tags. Only provided fields are updated, others remain unchanged. Field names must match the model exactly. Tags array replaces all existing tags (not additive). Changes affect all cards generated from this note. Updates modification time. Note: Changing fields that affect card generation may reset card scheduling. IMPORTANT: Field names are case-sensitive. Use notesInfo first to check current field names. Returns true on success",
    schema: z.object({
      id: z.union([z.number(), z.string()]).describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z.union([z.array(z.string()), z.string()]).optional().describe("New tags"),
    }),
    handler: async ({ id, fields, tags }) => {
      debug("updateNote called with:", { id, fields, tags });
      
      const noteData: { id: number; fields?: object; tags?: string[] } = { 
        id: typeof id === "string" ? parseInt(id, 10) : id
      };
      
      // Use utility to normalize fields
      const normalizedFields = normalizeFields(fields);
      if (normalizedFields) {
        noteData.fields = normalizedFields;
      }
      
      // Use utility to normalize tags
      if (tags) {
        noteData.tags = normalizeTags(tags);
      }
      
      debug("Sending to Anki-Connect:", noteData);
      
      const result = await ankiConnect("updateNote", {
        note: noteData
      });
      return result === null ? true : result; // Normalize null to true
    },
  },
  
  deleteNotes: {
    description: "Permanently deletes notes and all their associated cards. CAUTION: This is irreversible. Cards' review history is also deleted. Deletion is immediate and cannot be undone. Use suspend instead if you might need the notes later. Accepts array of note IDs. Returns true on success",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs to delete"),
    }),
    handler: async ({ notes }) => {
      const result = await ankiConnect("deleteNotes", { 
        notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
      });
      return result === null ? true : result; // Normalize null to true
    },
  },
  
  notesInfo: {
    description: "Gets comprehensive information about notes including: noteId, modelName, tags array, all fields with their values and order, cards array (IDs of all cards from this note), and modification time. Essential for displaying or editing notes. Automatically paginates large requests to handle bulk operations efficiently. Returns null for non-existent notes",
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
    description: "Gets all unique tags used across the entire collection. Tags are hierarchical using '::' separator (e.g., 'japanese::grammar'). Returns flat list of all tags including parent and child tags separately. Useful for tag management, autocomplete, or finding unused tags. Returns paginated results for collections with many tags",
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
    description: "Adds tags to existing notes without affecting existing tags (additive operation). Tags are space-separated in Anki but passed as a single string here. Use double quotes for tags with spaces. Hierarchical tags supported with '::'. Updates modification time. Does not validate tag names - be consistent with naming",
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
    description: "Removes specific tags from notes while preserving other tags. Tags parameter is space-separated string. Only removes exact matches - won't remove child tags when removing parent. Updates modification time. Safe operation - removing non-existent tags has no effect",
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
    description: "Search for cards using Anki's query syntax. Returns card IDs (not note IDs). Common queries: 'deck:DeckName' (cards in deck), 'is:due' (due for review today), 'is:new' (never studied), 'is:learn' (in learning phase), 'is:suspended' (suspended cards), 'prop:due<=0' (overdue), 'rated:1:1' (reviewed today, answered Hard). Note: 'is:due' excludes learning cards - use getNextCards for actual review order. IMPORTANT: Deck names with '::' hierarchy need quotes: 'deck:\"Parent::Child\"'. Returns paginated results",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'deck:current', 'deck:Default is:due', 'tag:japanese')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum cards to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset = 0, limit = 100 }) => {
      try {
        const allCards = await ankiConnect("findCards", { query });
        const total = Array.isArray(allCards) ? allCards.length : 0;
        const effectiveLimit = Math.min(limit, 1000);
        const paginatedCards = Array.isArray(allCards) ? allCards.slice(offset, offset + effectiveLimit) : [];
        
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
      } catch (_error) {
        // Return empty result set on error
        return {
          cards: [],
          pagination: {
            offset,
            limit: Math.min(limit, 1000),
            total: 0,
            hasMore: false,
            nextOffset: null,
          }
        };
      }
    },
  },
  
  getNextCards: {
    description: "Gets cards in the exact order they'll appear during review, following Anki's scheduling algorithm. Priority: 1) Cards in learning (red - failed or recently learned), 2) Review cards due today (green), 3) New cards up to daily limit (blue). Critical for simulating actual review session. Use deck:current for current deck or provide deck name. Includes suspended:false by default. Returns with scheduling metadata",
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
        learning: [] as Array<{ cardId: number; queue: number }>,
        review: [] as Array<{ cardId: number; queue: number }>,
        new: [] as Array<{ cardId: number; queue: number }>,
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
    description: "Gets comprehensive card information including: cardId, noteId, deckName, modelName, question/answer HTML, scheduling data (due date, interval, ease factor, reviews, lapses), queue status, modification time, and more. Essential for understanding card state and history. Automatically handles string/number ID conversion and paginates large requests. Returns detailed objects for each card",
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
    description: "Suspends cards, removing them from review queue while preserving all scheduling data. Suspended cards won't appear in reviews but remain in collection. Useful for temporarily hiding problematic or irrelevant cards. Can be reversed with unsuspend. Cards show yellow background in browser when suspended",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to suspend"),
    }),
    handler: async ({ cards }) => ankiConnect("suspend", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  unsuspend: {
    description: "Restores suspended cards to active review queue with all scheduling data intact. Cards resume from where they left off - due cards become immediately due, learning cards continue learning phase. No scheduling information is lost during suspension period. Returns true on success",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to unsuspend"),
    }),
    handler: async ({ cards }) => {
      const result = await ankiConnect("unsuspend", { 
        cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
      });
      return result === null ? true : result; // Normalize null to true
    },
  },
  
  getEaseFactors: {
    description: "Gets ease factors (difficulty multipliers) for cards. Ease affects interval growth: default 250% (2.5x), minimum 130%, Hard decreases by 15%, Easy increases by 15%. Lower ease = more frequent reviews. Useful for identifying difficult cards (ease < 200%) that may need reformulation. Returns array of ease values",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getEaseFactors", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  setEaseFactors: {
    description: "Manually sets ease factors for cards. Use with caution - can disrupt spaced repetition algorithm. Typical range: 130-300%. Setting ease to 250% resets to default. Lower values increase review frequency, higher values decrease it. Useful for manually adjusting difficult cards. Changes take effect on next review",
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
    description: "Lists all available note types (models) in the collection. Common built-in models: 'Basic' (Front/Back fields), 'Basic (and reversed card)', 'Cloze' (for cloze deletions), 'Basic (type in the answer)'. Custom models show user-defined names. Essential for addNote operations. Returns paginated results for collections with many models",
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
    description: "Gets ordered list of field names for a specific model. Field names are case-sensitive and must match exactly when creating/updating notes. Common fields: 'Front', 'Back' (Basic), 'Text', 'Extra' (Cloze). Order matters for some operations. Essential for validating note data before creation",
    schema: z.object({
      modelName: z.string().describe("Note type name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelFieldNames", { modelName }),
  },
  
  modelNamesAndIds: {
    description: "Gets mapping of model names to their internal IDs. Model IDs are timestamps of creation and never change. Useful for operations requiring model IDs or checking if models exist. IDs are stable across syncs. Returns object with model names as keys, IDs as values. Paginated for large collections",
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
    description: "Creates a custom note type with specified fields and card templates. Requires careful template syntax: {{Field}} for replacements, {{#Field}}...{{/Field}} for conditionals. Templates generate cards from notes. CSS styling is shared across all templates. Model name must be unique. Returns created model object. Complex operation - consider cloning existing models instead",
    schema: z.object({
      modelName: z.string().min(1).describe("Unique model name (case-sensitive)"),
      inOrderFields: z.array(z.string()).min(1).describe("Field names in display order (at least one required)"),
      css: z.string().optional().describe("CSS styling for all cards in this model"),
      isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
      cardTemplates: z.array(z.object({
        Name: z.string().min(1).describe("Template name (required)"),
        Front: z.string().describe("Front template HTML (question side)"),
        Back: z.string().describe("Back template HTML (answer side)"),
      })).min(1).describe("Card templates (at least one required)"),
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
      const learning: Array<{
        cardId: number;
        front: string;
        interval: number;
        due: number;
        queue: string;
        reps: number;
      }> = [];
      const review: Array<{
        cardId: number;
        front: string;
        interval: number;
        due: number;
        queue: string;
        ease: number;
      }> = [];
      
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
    description: "Gets number of reviews performed on a specific day. Date format: Unix timestamp (seconds since epoch). Returns total review count including new, learning, and review cards. Useful for tracking study patterns and consistency. Historical data available since collection creation",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedByDay"),
  },
  
  getCollectionStatsHTML: {
    description: "Gets comprehensive collection statistics as formatted HTML including: total cards/notes, daily averages, retention rates, mature vs young cards, time spent studying, forecast, and more. Same statistics shown in Anki's Stats window. HTML includes embedded CSS for proper rendering. Useful for dashboards and reporting",
    schema: z.object({
      wholeCollection: z.boolean().optional().default(true),
    }),
    handler: async ({ wholeCollection }) => 
      ankiConnect("getCollectionStatsHTML", { wholeCollection }),
  },
  
  // === MEDIA ===
  storeMediaFile: {
    description: "Stores a media file in Anki's media folder. REQUIRES one of: data (base64), path, or url. Media is automatically synced to AnkiWeb. Supported formats: images (jpg, png, gif, svg), audio (mp3, ogg, wav), video (mp4, webm). File is available immediately for use in cards with HTML tags like <img> or [sound:]. Example with base64: {filename: 'test.txt', data: 'SGVsbG8gV29ybGQ='}. Returns filename on success",
    schema: z.object({
      filename: z.string().describe("File name"),
      data: z.string().optional().describe("Base64-encoded file content"),
      url: z.string().optional().describe("URL to download from"),
      path: z.string().optional().describe("Local file path to read from"),
      deleteExisting: z.boolean().optional().default(true).describe("Replace if file exists"),
    }),
    handler: async (args) => {
      // Validate that at least one data source is provided
      if (!args.data && !args.url && !args.path) {
        throw new Error("storeMediaFile requires one of: data (base64), url, or path");
      }
      return ankiConnect("storeMediaFile", args);
    },
  },
  
  retrieveMediaFile: {
    description: "Retrieves a media file from Anki's collection as base64-encoded data. Specify just the filename (not full path). Returns false if file doesn't exist. Useful for backing up media or transferring between collections. Large files may take time to encode",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }) => 
      ankiConnect("retrieveMediaFile", { filename }),
  },
  
  getMediaFilesNames: {
    description: "Lists all media files in the collection including images, audio, and video files. Pattern supports wildcards (* and ?). Returns array of filenames (not paths). Useful for media management, finding unused files, or bulk operations. Large collections may have thousands of files",
    schema: z.object({
      pattern: z.string().optional().describe("File pattern"),
    }),
    handler: async ({ pattern }) => 
      ankiConnect("getMediaFilesNames", { pattern }),
  },
  
  deleteMediaFile: {
    description: "Permanently deletes a media file from the collection. CAUTION: Cannot be undone. File is removed immediately and will be deleted from AnkiWeb on next sync. Cards referencing the file will show broken media. Consider checking usage with findNotes before deletion",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }) => 
      ankiConnect("deleteMediaFile", { filename }),
  },
  
  // === MISCELLANEOUS ===
  sync: {
    description: "Performs full two-way sync with AnkiWeb. Requires AnkiWeb credentials configured in Anki. Uploads local changes and downloads remote changes. May take time for large collections. Resolves conflicts based on modification time. Network errors may require retry. Not available in some Anki configurations",
    schema: z.object({}),
    handler: async () => ankiConnect("sync"),
  },
  
  getProfiles: {
    description: "Lists all available Anki user profiles. Each profile has separate collections, settings, and add-ons. Useful for multi-user setups or separating study topics. Returns array of profile names. Current profile marked in Anki interface. Returns paginated results for many profiles",
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
    description: "Switches to a different user profile. Closes current collection and opens the specified profile's collection. All subsequent operations affect the new profile. May fail if profile doesn't exist or is already loaded. Useful for automated multi-profile operations",
    schema: z.object({
      name: z.string().describe("Profile name"),
    }),
    handler: async ({ name }) => ankiConnect("loadProfile", { name }),
  },
  
  exportPackage: {
    description: "Exports a deck to .apkg format for sharing or backup. Path must be absolute and include .apkg extension. Set includeSched=false to exclude review history (for sharing). MediaFiles included by default. Creates portable package that can be imported to any Anki installation. Large decks with media may take time",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      path: z.string().describe("Export path"),
      includeSched: z.boolean().optional().default(false),
    }),
    handler: async ({ deck, path, includeSched }) => 
      ankiConnect("exportPackage", { deck, path, includeSched }),
  },
  
  importPackage: {
    description: "Imports an .apkg package file into the collection. Path must be absolute. Merges content with existing collection - doesn't overwrite. Handles duplicate detection based on note IDs. Media files are imported to media folder. May take significant time for large packages. Returns true on success",
    schema: z.object({
      path: z.string().describe("Import path"),
    }),
    handler: async ({ path }) => ankiConnect("importPackage", { path }),
  },
  
  // === GUI OPERATIONS ===
  guiBrowse: {
    description: "Opens Anki's Browse window with optional search query. Query uses same syntax as findCards/findNotes. Useful for complex manual review or bulk operations. Browser allows editing, tagging, suspending, and more. Returns array of note IDs initially shown. Requires Anki GUI running",
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
    description: "Opens Add Cards dialog pre-filled with specified content. Allows user to review and modify before adding. Useful for semi-automated card creation where human review is needed. CloseAfterAdding option controls dialog behavior. Returns note ID if card was added (null if cancelled). Requires GUI",
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
    description: "Gets information about the card currently being reviewed in the main window. Returns null if not in review mode. Includes card ID, question/answer content, buttons available, and more. Useful for integration with review session or automated review helpers. Requires active review session",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCurrentCard"),
  },
  
  guiAnswerCard: {
    description: "Answers the current review card programmatically. Ease values: 1=Again (fail), 2=Hard, 3=Good, 4=Easy. Affects scheduling based on chosen ease. Only works during active review session. Automatically shows next card. Useful for automated review or accessibility tools. Returns true on success",
    schema: z.object({
      ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
    }),
    handler: async ({ ease }) => ankiConnect("guiAnswerCard", { ease }),
  },
  
  guiDeckOverview: {
    description: "Opens deck overview screen showing study options and statistics for specified deck. Displays new/learning/review counts and study buttons. User can start studying from this screen. Useful for navigating to specific deck programmatically. Requires GUI running",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }) => ankiConnect("guiDeckOverview", { name }),
  },
  
  guiExitAnki: {
    description: "Closes Anki application completely. Saves all changes before exiting. Use with caution - terminates the Anki process. No confirmation dialog shown. Useful for automated workflows that need clean shutdown. Connection to Anki-Connect will be lost",
    schema: z.object({}),
    handler: async () => ankiConnect("guiExitAnki"),
  },
  
  // === MISSING CRITICAL APIS ===
  
  // Card Operations
  canAddNotes: {
    description: "Validates if notes can be added without actually creating them. Checks for: valid model name, valid deck name, required fields filled, duplicate detection (if not allowing duplicates). Returns array of booleans matching input array. Essential for validation before bulk operations. True means note can be added",
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
    description: "Checks suspension status for multiple cards. Returns array of booleans (true=suspended). Order matches input card ID array. More efficient than cardsInfo for just checking suspension. Useful for filtering active cards or managing suspended cards in bulk",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }) => ankiConnect("areSuspended", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  areDue: {
    description: "Checks if cards are due for review today. Returns array of booleans. Due means: new cards within daily limit, learning cards ready for next step, or review cards due today or overdue. Does not check suspension status. Order matches input array. Useful for filtering reviewable cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }) => ankiConnect("areDue", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  getIntervals: {
    description: "Gets current intervals (days until next review) for cards. Returns array of intervals in days. Negative values indicate cards in learning phase (minutes/hours). Zero means due today. Useful for understanding card scheduling state and predicting future workload. Order matches input array",
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
    description: "Converts card IDs to their parent note IDs. Multiple cards can belong to same note (e.g., Basic reversed, Cloze deletions). Returns array of note IDs matching input order. Useful when you have cards but need to operate on notes. Handles invalid IDs gracefully",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsToNotes", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  cardsModTime: {
    description: "Gets last modification timestamps for cards in milliseconds since epoch. Much faster than cardsInfo when you only need modification times (15x speedup). Returns array matching input order. Useful for sync operations, change detection, or sorting by recent activity",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("cardsModTime", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  answerCards: {
    description: "Batch answers multiple cards without GUI. Each answer includes cardId and ease (1-4). Processes cards as if reviewed normally, updating scheduling. Does not require active review session. Returns array of booleans indicating success. Useful for automated review or importing review data. Use carefully - affects learning algorithm",
    schema: z.object({
      answers: z.array(z.object({
        cardId: z.union([z.number(), z.string()]),
        ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
      })).describe("Card answers"),
    }),
    handler: async ({ answers }) => ankiConnect("answerCards", { 
      answers: answers.map((a: { cardId: string | number; ease: number }) => ({
        cardId: typeof a.cardId === "string" ? parseInt(a.cardId, 10) : a.cardId,
        ease: a.ease
      }))
    }),
  },
  
  forgetCards: {
    description: "Resets cards to 'new' state, clearing all review history and scheduling data. Cards become blue (new) again. Interval, ease factor, and review count reset. Useful for re-learning forgotten material or resetting problematic cards. CAUTION: Destroys review history permanently",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to reset"),
    }),
    handler: async ({ cards }) => {
      const result = await ankiConnect("forgetCards", { 
        cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
      });
      return result === null ? true : result;
    },
  },
  
  relearnCards: {
    description: "Places cards into relearning queue (similar to pressing Again on mature cards). Cards enter red learning phase with steps defined in deck config. Preserves ease factor unlike forget. Useful for cards that need refreshing without complete reset. Returns array of success indicators",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => {
      const result = await ankiConnect("relearnCards", { 
        cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
      });
      return result === null ? true : result;
    },
  },
  
  setSpecificValueOfCard: {
    description: "Directly modifies internal card properties. EXTREME CAUTION: Can break scheduling algorithm if misused. Keys include: 'due' (due date), 'ease' (ease factor), 'ivl' (interval), 'reps' (review count), 'lapses' (failure count). Values must match Anki's internal format. For advanced users only. Can cause unexpected behavior",
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
    description: "Gets deck names for specified cards. Returns array of deck names matching input card order. Useful for organizing cards by deck, moving cards between decks, or filtering cards by location. Handles cards from different decks in single call",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getDecks", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  changeDeck: {
    description: "Moves cards to a different deck while preserving all scheduling information. Cards maintain their review state, intervals, and ease factors. Only deck location changes. Creates deck if it doesn't exist. Useful for reorganizing without losing progress. Returns success status",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to move"),
      deck: z.string().describe("Target deck name"),
    }),
    handler: async ({ cards, deck }) => {
      const result = await ankiConnect("changeDeck", { 
        cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
        deck
      });
      return result === null ? true : result;
    },
  },
  
  saveDeckConfig: {
    description: "Updates deck configuration group with new settings. Config includes: new cards/day, review limits, ease factors, learning steps, graduation intervals, leech threshold, and more. Changes affect all decks using this config group. Returns true on success. Be careful - can significantly impact learning",
    schema: z.object({
      config: z.record(z.unknown()).describe("Deck configuration object"),
    }),
    handler: async ({ config }) => ankiConnect("saveDeckConfig", { config }),
  },
  
  setDeckConfigId: {
    description: "Assigns a deck to a different configuration group. Allows sharing settings between decks or isolating deck settings. Config ID must exist (use getDeckConfig to find IDs). Changes take effect immediately for new reviews. Useful for applying preset configurations",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names"),
      configId: z.number().describe("Configuration ID"),
    }),
    handler: async ({ decks, configId }) => 
      ankiConnect("setDeckConfigId", { decks, configId }),
  },
  
  cloneDeckConfigId: {
    description: "Creates a copy of an existing deck configuration with a new name. Cloned config starts with identical settings but can be modified independently. Useful for creating variations of successful configurations or testing changes without affecting originals. Returns new config ID",
    schema: z.object({
      name: z.string().describe("New config name"),
      cloneFrom: z.number().optional().describe("Config ID to clone from"),
    }),
    handler: async ({ name, cloneFrom }) => 
      ankiConnect("cloneDeckConfigId", { name, cloneFrom }),
  },
  
  removeDeckConfigId: {
    description: "Deletes a deck configuration group. Decks using this config revert to default config. Cannot delete default config (ID 1) or configs in use. Permanent deletion - cannot be undone. Check deck assignments before deletion to avoid unintended changes",
    schema: z.object({
      configId: z.number().describe("Configuration ID to remove"),
    }),
    handler: async ({ configId }) => {
      const result = await ankiConnect("removeDeckConfigId", { configId });
      return result === null ? true : result;
    },
  },
  
  // Model Operations
  modelFieldsOnTemplates: {
    description: "Analyzes which fields are actually used in each card template. Returns mapping of template names to field arrays. Helps identify unused fields or understand template dependencies. Essential for model optimization or safe field deletion. Only shows fields referenced in templates",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelFieldsOnTemplates", { modelName }),
  },
  
  modelTemplates: {
    description: "Gets all card templates for a model. Each template defines how cards are generated from notes. Returns object with template names as keys and template definitions (Front/Back format strings) as values. Templates use {{Field}} syntax with conditionals {{#Field}}...{{/Field}}. Essential for understanding card generation",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => 
      ankiConnect("modelTemplates", { modelName }),
  },
  
  modelStyling: {
    description: "Gets CSS styling that applies to all cards of this model type. Returns CSS string that controls card appearance during review. Includes fonts, colors, alignment, and custom classes. Shared across all templates of the model. Understanding CSS required for modifications",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }) => {
      const result = await ankiConnect("modelStyling", { modelName });
      // Anki-Connect returns { css: "..." }, extract the CSS string
      if (typeof result === "object" && result !== null && "css" in result) {
        return (result as { css: string }).css;
      }
      return result as string;
    },
  },
  
  updateModelTemplates: {
    description: "Updates card generation templates for a model. CAUTION: Affects all existing notes using this model. May delete cards if templates removed, or create cards if added. Template syntax errors can break card generation. Test changes on copy first. Returns updated template object",
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
    description: "Updates CSS styling for all cards of a model type. Changes apply immediately to all cards during review. Invalid CSS may break card display. Affects all notes using this model. Consider model-specific classes to avoid conflicts. Test thoroughly before applying to important decks",
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
    description: "Updates only the field values of a note, leaving tags unchanged. Simpler than updateNote when you only need to modify content. Fields object can be partial - unspecified fields remain unchanged. Updates modification time. Changes reflected in all cards from this note",
    schema: z.object({
      note: z.object({
        id: z.union([z.number(), z.string()]),
        fields: z.record(z.string()),
      }),
    }),
    handler: async ({ note }) => {
      const result = await ankiConnect("updateNoteFields", { 
        note: {
          id: typeof note.id === "string" ? parseInt(note.id, 10) : note.id,
          fields: note.fields
        }
      });
      return result === null ? true : result;
    },
  },
  
  getNoteTags: {
    description: "Gets tags for specified notes. Returns array of tag arrays matching input note order. Each note's tags returned as array of strings. More efficient than notesInfo when you only need tags. Useful for tag analysis or bulk tag operations",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }) => ankiConnect("getNoteTags", { 
      note: typeof note === "string" ? parseInt(note, 10) : note
    }),
  },
  
  clearUnusedTags: {
    description: "Removes all tags from the tag list that aren't assigned to any notes. Cleans up tag autocomplete and tag browser. Safe operation - only removes truly unused tags. Useful after bulk deletions or tag reorganization. No effect on notes",
    schema: z.object({}),
    handler: async () => {
      const result = await ankiConnect("clearUnusedTags");
      return result === null ? true : result;
    },
  },
  
  replaceTags: {
    description: "Replaces specific tags in selected notes. Only affects notes that have the tag_to_replace. Atomic operation - all specified notes updated together. Case-sensitive tag matching. Useful for renaming tags on subset of notes or fixing typos",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({ notes, tagToReplace, replaceWithTag }) => {
      const result = await ankiConnect("replaceTags", { 
        notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id),
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag
      });
      return result === null ? true : result;
    },
  },
  
  replaceTagsInAllNotes: {
    description: "Globally replaces a tag across entire collection. Affects all notes with the specified tag. More efficient than replaceTags for collection-wide changes. Case-sensitive matching. Instant operation even on large collections. Useful for standardizing tag names or merging similar tags",
    schema: z.object({
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({ tagToReplace, replaceWithTag }) => {
      const result = await ankiConnect("replaceTagsInAllNotes", { 
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag
      });
      return result === null ? true : result;
    },
  },
  
  removeEmptyNotes: {
    description: "Deletes all notes that have no associated cards (orphaned notes). Can occur when all cards deleted via templates or manual deletion. Cleans up database. Returns count of deleted notes. Safe operation - only removes truly empty notes. Run periodically for maintenance",
    schema: z.object({}),
    handler: async () => ankiConnect("removeEmptyNotes"),
  },
  
  notesModTime: {
    description: "Gets last modification timestamps for notes in seconds since epoch. Returns array matching input order. More efficient than notesInfo for just timestamps. Useful for sync operations, change detection, or finding recently edited notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
    }),
    handler: async ({ notes }) => ankiConnect("notesModTime", { 
      notes: notes.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  // Statistics
  cardReviews: {
    description: "Gets complete review history for specified cards. Returns array of review arrays, each containing: reviewTime, cardID, ease, interval, lastInterval, factor, reviewDuration. Essential for analyzing learning patterns, identifying problem cards, or exporting review data. Large histories may be substantial",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      startID: z.number().describe("Start review ID"),
    }),
    handler: async ({ deck, startID }) => 
      ankiConnect("cardReviews", { deck, startID }),
  },
  
  getLatestReviewID: {
    description: "Gets the ID of the most recent review in collection. Review IDs increment monotonically. Useful for tracking new reviews since last check, implementing review sync, or monitoring study activity. Returns integer ID or null if no reviews",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }) => 
      ankiConnect("getLatestReviewID", { deck }),
  },
  
  getReviewsOfCards: {
    description: "Gets review entries for specific cards from the review log. More targeted than cardReviews. Returns review entries with timestamps, ease ratings, and intervals. Useful for detailed card analysis or custom statistics. Handles multiple cards efficiently",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }) => ankiConnect("getReviewsOfCards", { 
      cards: cards.map((id: string | number) => typeof id === "string" ? parseInt(id, 10) : id)
    }),
  },
  
  // GUI Operations
  guiSelectedNotes: {
    description: "Gets note IDs currently selected in the Browse window. Returns empty array if browser not open or nothing selected. Useful for creating tools that operate on user's selection. Requires browser window to be open. Selection can be from search or manual",
    schema: z.object({}),
    handler: async () => ankiConnect("guiSelectedNotes"),
  },
  
  guiSelectCard: {
    description: "Selects and scrolls to a specific card in the Browse window. Opens browser if not already open. Card is highlighted and details shown in preview pane. Useful for navigating to specific cards programmatically or showing search results. Returns true on success",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
    }),
    handler: async ({ card }) => ankiConnect("guiSelectCard", { 
      card: typeof card === "string" ? parseInt(card, 10) : card
    }),
  },
  
  guiEditNote: {
    description: "Opens the Edit Current Note dialog for a specific note. Shows all fields and tags in editable form. User can modify and save changes. Blocks until dialog closed. Returns modified note fields after save, or null if cancelled. Requires GUI running",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }) => ankiConnect("guiEditNote", { 
      note: typeof note === "string" ? parseInt(note, 10) : note
    }),
  },
  
  guiStartCardTimer: {
    description: "Starts the review timer for current card. Timer tracks time spent on card for statistics. Usually starts automatically but can be triggered manually. Only works during active review session. Returns true if timer started successfully",
    schema: z.object({}),
    handler: async () => ankiConnect("guiStartCardTimer"),
  },
  
  guiShowQuestion: {
    description: "Shows the question (front) side of current review card. Hides answer if visible. Resets timer if configured. Only works during review session. Useful for custom review interfaces or accessibility tools. Returns true on success",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowQuestion"),
  },
  
  guiShowAnswer: {
    description: "Reveals the answer (back) side of current review card. Shows rating buttons for ease selection. Timer continues running. Only works during review with question shown. Essential for custom review flows. Returns true on success",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowAnswer"),
  },
  
  guiUndo: {
    description: "Undoes the last reviewable action in Anki. Can undo: card answers, note edits, note additions, deletions. Limited undo history (typically last 10 actions). Not all operations can be undone. Returns true if undo successful, false if nothing to undo",
    schema: z.object({}),
    handler: async () => ankiConnect("guiUndo"),
  },
  
  guiDeckBrowser: {
    description: "Opens the main deck browser screen showing all decks with statistics. This is Anki's home screen. Shows new/learning/due counts for each deck. User can select decks to study from here. Returns true when opened successfully",
    schema: z.object({}),
    handler: async () => ankiConnect("guiDeckBrowser"),
  },
  
  guiDeckReview: {
    description: "Starts review session for specified deck. Opens review screen and shows first card. Follows configured order: learning, review, then new cards. User reviews with spacebar and number keys. Returns name of deck being reviewed. Requires GUI",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }) => ankiConnect("guiDeckReview", { name }),
  },
  
  guiCheckDatabase: {
    description: "Runs database integrity check and optimization. Checks for: corruption, missing media, invalid cards, orphaned notes. Fixes problems when possible. Shows progress dialog. May take time on large collections. Returns status message with problems found/fixed",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCheckDatabase"),
  },
  
  guiImportFile: {
    description: "Opens import dialog for user to select and import files. Supports: .apkg (deck packages), .colpkg (collection), .txt/.csv (notes). Shows import options and progress. User controls duplicate handling. Returns import summary or null if cancelled. Requires GUI",
    schema: z.object({
      path: z.string().optional().describe("File path to import"),
    }),
    handler: async ({ path }) => ankiConnect("guiImportFile", { path }),
  },
  
  // Media Operations
  getMediaDirPath: {
    description: "Gets absolute filesystem path to Anki's media folder where images, audio, and video files are stored. Path varies by OS and profile. Useful for direct media file operations or backup scripts. Typically: ~/Anki2/ProfileName/collection.media/",
    schema: z.object({}),
    handler: async () => ankiConnect("getMediaDirPath"),
  },
  
  // System Operations
  version: {
    description: "Gets the Anki-Connect addon version number. Useful for compatibility checks and ensuring required features are available. Version 6 is current stable. Different versions may have different available actions or parameters",
    schema: z.object({}),
    handler: async () => ankiConnect("version"),
  },
  
  requestPermission: {
    description: "Requests permission to use Anki-Connect API. Shows dialog to user for approval. Required on first connection from new origin. Permission persists across sessions once granted. Returns permission status and version. Essential for web applications",
    schema: z.object({}),
    handler: async () => ankiConnect("requestPermission"),
  },
  
  apiReflect: {
    description: "Gets metadata about available Anki-Connect API actions including names, parameters, and descriptions. Useful for API discovery, generating documentation, or validating capabilities. Returns object with 'scopes' and 'actions' arrays. Essential for dynamic API clients",
    schema: z.object({
      scopes: z.array(z.string()).optional().describe("Scopes to query"),
      actions: z.array(z.string()).optional().describe("Actions to check"),
    }),
    handler: async ({ scopes, actions }) => 
      ankiConnect("apiReflect", { scopes, actions }),
  },
  
  reloadCollection: {
    description: "Reloads the entire collection from disk, discarding any unsaved changes in memory. Useful after external database modifications or to resolve inconsistencies. Forces all cached data to refresh. Use sparingly - can be slow on large collections",
    schema: z.object({}),
    handler: async () => ankiConnect("reloadCollection"),
  },
  
  multi: {
    description: "Executes multiple API actions in a single request. Each action runs independently with its own parameters. Returns array of results matching action order. Errors in one action don't affect others. Much more efficient than multiple requests. Maximum 100 actions recommended",
    schema: z.object({
      actions: z.array(z.object({
        action: z.string(),
        params: z.unknown().optional(),
        version: z.number().optional(),
      })).describe("Actions to execute"),
    }),
    handler: async ({ actions }) => ankiConnect("multi", { actions }),
  },
  
  getActiveProfile: {
    description: "Gets the name of currently active Anki profile. Each profile has separate collections and settings. Useful for multi-profile workflows or confirming correct profile before operations. Returns profile name as string",
    schema: z.object({}),
    handler: async () => ankiConnect("getActiveProfile"),
  },
  
  setDueDate: {
    description: "Manually sets the due date for cards, overriding normal scheduling. Date format: 'YYYY-MM-DD' or days from today (e.g., '5' for 5 days). Useful for vacation mode or manual scheduling adjustments. Preserves intervals and ease. Use carefully - disrupts spaced repetition algorithm",
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
    description: "Checks if a single card is currently suspended. Returns boolean (true if suspended). Simpler than areSuspended for single card checks. Suspended cards remain in collection but don't appear in reviews. Useful for conditional logic in automation",
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new McpError(
      ErrorCode.InternalError,
      errorMessage
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