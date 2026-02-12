import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const systemTools = {
  sync: {
    description:
      "Performs full two-way sync with AnkiWeb. Requires AnkiWeb credentials configured in Anki. Uploads local changes and downloads remote changes. May take time for large collections. Resolves conflicts based on modification time. Network errors may require retry. Not available in some Anki configurations",
    schema: z.object({}),
    handler: async () => ankiConnect("sync"),
  },

  getProfiles: {
    description:
      "Lists all available Anki user profiles. Each profile has separate collections, settings, and add-ons. Useful for multi-user setups or separating study topics. Returns array of profile names. Current profile marked in Anki interface. Returns paginated results for many profiles",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum profiles to return (default 100, max 1000)"),
    }),
    handler: async ({ offset = 0, limit = 100 }: { offset?: number; limit?: number }) => {
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
        },
      };
    },
  },

  loadProfile: {
    description:
      "Switches to a different user profile. Closes current collection and opens the specified profile's collection. All subsequent operations affect the new profile. May fail if profile doesn't exist or is already loaded. Useful for automated multi-profile operations",
    schema: z.object({
      name: z.string().describe("Profile name"),
    }),
    handler: async ({ name }: { name: string }) => ankiConnect("loadProfile", { name }),
  },

  exportPackage: {
    description:
      "Exports a deck to .apkg format for sharing or backup. Path must be absolute and include .apkg extension. Set includeSched=false to exclude review history (for sharing). MediaFiles included by default. Creates portable package that can be imported to any Anki installation. Large decks with media may take time",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      path: z.string().describe("Export path"),
      includeSched: z.boolean().optional().default(false),
    }),
    handler: async ({ deck, path, includeSched }: { deck: string; path: string; includeSched?: boolean }) =>
      ankiConnect("exportPackage", { deck, path, includeSched }),
  },

  importPackage: {
    description:
      "Imports an .apkg package file into the collection. Path must be absolute. Merges content with existing collection - doesn't overwrite. Handles duplicate detection based on note IDs. Media files are imported to media folder. May take significant time for large packages. Returns true on success",
    schema: z.object({
      path: z.string().describe("Import path"),
    }),
    handler: async ({ path }: { path: string }) => ankiConnect("importPackage", { path }),
  },

  version: {
    description:
      "Gets the Anki-Connect addon version number. Useful for compatibility checks and ensuring required features are available. Version 6 is current stable. Different versions may have different available actions or parameters",
    schema: z.object({}),
    handler: async () => ankiConnect("version"),
  },

  requestPermission: {
    description:
      "Requests permission to use Anki-Connect API. Shows dialog to user for approval. Required on first connection from new origin. Permission persists across sessions once granted. Returns permission status and version. Essential for web applications",
    schema: z.object({}),
    handler: async () => ankiConnect("requestPermission"),
  },

  apiReflect: {
    description:
      "Gets metadata about available Anki-Connect API actions including names, parameters, and descriptions. Useful for API discovery, generating documentation, or validating capabilities. Returns object with 'scopes' and 'actions' arrays. Essential for dynamic API clients",
    schema: z.object({
      scopes: z.array(z.string()).optional().describe("Scopes to query"),
      actions: z.array(z.string()).optional().describe("Actions to check"),
    }),
    handler: async ({ scopes, actions }: { scopes?: string[]; actions?: string[] }) =>
      ankiConnect("apiReflect", { scopes, actions }),
  },

  reloadCollection: {
    description:
      "Reloads the entire collection from disk, discarding any unsaved changes in memory. Useful after external database modifications or to resolve inconsistencies. Forces all cached data to refresh. Use sparingly - can be slow on large collections",
    schema: z.object({}),
    handler: async () => ankiConnect("reloadCollection"),
  },

  multi: {
    description:
      "Executes multiple API actions in a single request. Each action runs independently with its own parameters. Returns array of results matching action order. Errors in one action don't affect others. Much more efficient than multiple requests. Maximum 100 actions recommended",
    schema: z.object({
      actions: z
        .array(
          z.object({
            action: z.string(),
            params: z.unknown().optional(),
            version: z.number().optional(),
          }),
        )
        .describe("Actions to execute"),
    }),
    handler: async ({ actions }: { actions: Array<{ action: string; params?: unknown; version?: number }> }) =>
      ankiConnect("multi", { actions }),
  },

  getActiveProfile: {
    description:
      "Gets the name of currently active Anki profile. Each profile has separate collections and settings. Useful for multi-profile workflows or confirming correct profile before operations. Returns profile name as string",
    schema: z.object({}),
    handler: async () => ankiConnect("getActiveProfile"),
  },

  setDueDate: {
    description:
      "Manually sets the due date for cards, overriding normal scheduling. Date format: 'YYYY-MM-DD' or days from today (e.g., '5' for 5 days). Useful for vacation mode or manual scheduling adjustments. Preserves intervals and ease. Use carefully - disrupts spaced repetition algorithm",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      days: z.string().describe("Days string (e.g., '1', '3-7', '0' for today)"),
    }),
    handler: async ({ cards, days }: { cards: Array<number | string>; days: string }) =>
      ankiConnect("setDueDate", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        days,
      }),
  },

  suspended: {
    description:
      "Checks if a single card is currently suspended. Returns boolean (true if suspended). Simpler than areSuspended for single card checks. Suspended cards remain in collection but don't appear in reviews. Useful for conditional logic in automation",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
    }),
    handler: async ({ card }: { card: number | string }) =>
      ankiConnect("suspended", {
        card: typeof card === "string" ? parseInt(card, 10) : card,
      }),
  },

  saveDeckConfig: {
    description:
      "Updates deck configuration group with new settings. Config includes: new cards/day, review limits, ease factors, learning steps, graduation intervals, leech threshold, and more. Changes affect all decks using this config group. Returns true on success. Be careful - can significantly impact learning",
    schema: z.object({
      config: z.record(z.unknown()).describe("Deck configuration object"),
    }),
    handler: async ({ config }: { config: Record<string, unknown> }) => ankiConnect("saveDeckConfig", { config }),
  },

  setDeckConfigId: {
    description:
      "Assigns a deck to a different configuration group. Allows sharing settings between decks or isolating deck settings. Config ID must exist (use getDeckConfig to find IDs). Changes take effect immediately for new reviews. Useful for applying preset configurations",
    schema: z.object({
      decks: z.array(z.string()).describe("Deck names"),
      configId: z.number().describe("Configuration ID"),
    }),
    handler: async ({ decks, configId }: { decks: string[]; configId: number }) =>
      ankiConnect("setDeckConfigId", { decks, configId }),
  },

  cloneDeckConfigId: {
    description:
      "Creates a copy of an existing deck configuration with a new name. Cloned config starts with identical settings but can be modified independently. Useful for creating variations of successful configurations or testing changes without affecting originals. Returns new config ID",
    schema: z.object({
      name: z.string().describe("New config name"),
      cloneFrom: z.number().optional().describe("Config ID to clone from"),
    }),
    handler: async ({ name, cloneFrom }: { name: string; cloneFrom?: number }) =>
      ankiConnect("cloneDeckConfigId", { name, cloneFrom }),
  },

  removeDeckConfigId: {
    description:
      "Deletes a deck configuration group. Decks using this config revert to default config. Cannot delete default config (ID 1) or configs in use. Permanent deletion - cannot be undone. Check deck assignments before deletion to avoid unintended changes",
    schema: z.object({
      configId: z.number().describe("Configuration ID to remove"),
    }),
    handler: async ({ configId }: { configId: number }) => {
      const result = await ankiConnect("removeDeckConfigId", { configId });
      return result === null ? true : result;
    },
  },
} satisfies Record<string, ToolDef>;
