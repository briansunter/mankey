import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const deckTools = {
  deckNames: {
    description:
      "Gets the complete list of deck names for the current user. Returns all decks including nested decks (formatted as 'Parent::Child'). Useful for getting an overview of available decks before performing operations. Returns paginated results to handle large collections efficiently",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum decks to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }: { offset?: number; limit?: number }) => {
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
        },
      };
    },
  },

  createDeck: {
    description:
      "Creates a new empty deck. Will not overwrite a deck that exists with the same name. Use '::' separator for nested decks (e.g., 'Japanese::JLPT N5'). Returns the deck ID on success. Safe to call multiple times - acts as 'ensure exists' operation",
    schema: z.object({
      deck: z.string().describe("Deck name (use :: for nested decks)"),
    }),
    handler: async ({ deck }: { deck: string }) => ankiConnect("createDeck", { deck }),
  },

  getDeckStats: {
    description:
      "Gets detailed statistics for specified decks including: new_count (blue cards), learn_count (red cards in learning), review_count (green cards due), and total_in_deck. Essential for understanding deck workload and progress. Returns stats keyed by deck ID",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to get stats for"),
    }),
    handler: async ({ decks }: { decks: string[] }) => ankiConnect("getDeckStats", { decks }),
  },

  deckNamesAndIds: {
    description:
      "Gets complete mapping of deck names to their internal IDs. IDs are persistent and used internally by Anki. Useful when you need to work with deck IDs directly or correlate names with IDs. Returns object with deck names as keys and IDs as values. Paginated for large collections",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum entries to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }: { offset?: number; limit?: number }) => {
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
        },
      };
    },
  },

  getDeckConfig: {
    description:
      "Gets the configuration group object for a deck. Contains review settings like: new cards per day, review limits, ease factors, intervals, leech thresholds, and more. Decks can share config groups. Understanding config is crucial for optimizing learning efficiency",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }: { deck: string }) => ankiConnect("getDeckConfig", { deck }),
  },

  deleteDecks: {
    description:
      "Permanently deletes specified decks. CAUTION: Setting cardsToo=true (default) will delete all cards in the decks. Cards cannot be recovered after deletion. cardsToo MUST be explicitly set. Deleting parent deck deletes all subdecks. Returns true on success",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names to delete"),
      cardsToo: z.boolean().default(true).describe("Also delete cards"),
    }),
    handler: async ({ decks, cardsToo }: { decks: string[]; cardsToo: boolean }) => {
      const result = await ankiConnect("deleteDecks", { decks, cardsToo });
      return result === null ? true : result;
    },
  },
} satisfies Record<string, ToolDef>;
