import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import { debug } from "../shared/config.js";
import { normalizeFields, normalizeTags } from "../shared/normalize.js";
import type { ToolDef } from "../shared/types.js";

export const noteTools = {
  addNotes: {
    description:
      "Bulk create multiple notes in a single operation. Each note creates one or more cards based on the model's templates. Returns array of note IDs (null for failures). More efficient than multiple addNote calls. Duplicates return null unless allowDuplicate=true. Note: Fields must match the model's field names exactly",
    schema: z.object({
      notes: z.array(
        z.union([
          z.object({
            deckName: z.string(),
            modelName: z.string(),
            fields: z.record(z.string()),
            tags: z.array(z.string()).optional(),
            options: z
              .object({
                allowDuplicate: z.boolean().optional(),
              })
              .optional(),
          }),
          z.string(), // Allow JSON string representation
        ]),
      ),
    }),
    handler: async ({ notes }: { notes: Array<unknown> }) => {
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
    description:
      "Creates a single note (fact) which generates cards based on the model's templates. Basic model creates 1 card, Cloze can create many. Returns the new note ID. Fields must match the model exactly (case-sensitive). Common models: 'Basic' (Front/Back), 'Basic (and reversed card)' (Front/Back, creates 2 cards), 'Cloze' (Text/Extra, use {{c1::text}}). Tags are passed as an array of strings. IMPORTANT: Field names are case-sensitive and must exactly match the model's field names. Use modelFieldNames to check exact field names first",
    schema: z.object({
      deckName: z.string().describe("Target deck"),
      modelName: z.string().describe("Note type (e.g., 'Basic', 'Cloze')"),
      fields: z.record(z.string()).describe("Field content"),
      tags: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .describe("Tags"),
      allowDuplicate: z.boolean().optional().describe("Allow duplicates"),
    }),
    handler: async (args: {
      deckName: string;
      modelName: string;
      fields: Record<string, string>;
      tags?: string | string[];
      allowDuplicate?: boolean;
    }) => {
      debug("addNote called with:", args);
      const tags = args.tags ? normalizeTags(args.tags) : [];

      return ankiConnect("addNote", {
        note: {
          deckName: args.deckName,
          modelName: args.modelName,
          fields: args.fields,
          tags,
          options: { allowDuplicate: args.allowDuplicate || false },
        },
      });
    },
  },

  findNotes: {
    description:
      "Search for notes using Anki's powerful query syntax. Returns note IDs matching the query. Common queries: 'deck:DeckName' (notes in deck), 'tag:tagname' (tagged notes), 'is:new' (new notes), 'is:due' (notes with due cards), 'added:7' (added in last 7 days), 'front:text' (search Front field), '*' (all notes). Combine with AND/OR. IMPORTANT: Deck names with '::' hierarchy need quotes: 'deck:\"Parent::Child\"'. Returns paginated results for large collections. Note: Returns notes, not cards",
    schema: z.object({
      query: z.string().describe("Search query (e.g., 'deck:current', 'deck:Default', 'tag:vocab')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum notes to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset = 0, limit = 100 }: { query: string; offset?: number; limit?: number }) => {
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
          },
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
          },
        };
      }
    },
  },

  updateNote: {
    description:
      "Updates an existing note's fields and/or tags. Only provided fields are updated, others remain unchanged. Field names must match the model exactly. Tags array replaces all existing tags (not additive). Changes affect all cards generated from this note. Updates modification time. Note: Changing fields that affect card generation may reset card scheduling. IMPORTANT: Field names are case-sensitive. Use notesInfo first to check current field names. Returns true on success",
    schema: z.object({
      id: z.union([z.number(), z.string()]).describe("Note ID"),
      fields: z.record(z.string()).optional().describe("Fields to update"),
      tags: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .describe("New tags"),
    }),
    handler: async ({
      id,
      fields,
      tags,
    }: {
      id: number | string;
      fields?: Record<string, string>;
      tags?: string | string[];
    }) => {
      debug("updateNote called with:", { id, fields, tags });

      const noteData: { id: number; fields?: object; tags?: string[] } = {
        id: typeof id === "string" ? parseInt(id, 10) : id,
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
        note: noteData,
      });
      return result === null ? true : result; // Normalize null to true
    },
  },

  deleteNotes: {
    description:
      "Permanently deletes notes and all their associated cards. CAUTION: This is irreversible. Cards' review history is also deleted. Deletion is immediate and cannot be undone. Use suspend instead if you might need the notes later. Accepts array of note IDs. Returns true on success",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs to delete"),
    }),
    handler: async ({ notes }: { notes: Array<number | string> }) => {
      const result = await ankiConnect("deleteNotes", {
        notes: notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      });
      return result === null ? true : result; // Normalize null to true
    },
  },

  notesInfo: {
    description:
      "Gets comprehensive information about notes including: noteId, modelName, tags array, all fields with their values and order, cards array (IDs of all cards from this note), and modification time. Essential for displaying or editing notes. Automatically paginates large requests to handle bulk operations efficiently. Returns null for non-existent notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs (automatically batched if >100)"),
    }),
    handler: async ({ notes }: { notes: Array<number | string> }) => {
      const noteIds = notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id));

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
        },
      };
    },
  },

  getTags: {
    description:
      "Gets all unique tags used across the entire collection. Tags are hierarchical using '::' separator (e.g., 'japanese::grammar'). Returns flat list of all tags including parent and child tags separately. Useful for tag management, autocomplete, or finding unused tags. Returns paginated results for collections with many tags",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum tags to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }: { offset?: number; limit?: number }) => {
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
        },
      };
    },
  },

  addTags: {
    description:
      "Adds tags to existing notes without affecting existing tags (additive operation). Tags are space-separated in Anki but passed as a single string here. Use double quotes for tags with spaces. Hierarchical tags supported with '::'. Updates modification time. Does not validate tag names - be consistent with naming",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }: { notes: Array<number | string>; tags: string }) =>
      ankiConnect("addTags", {
        notes: notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        tags,
      }),
  },

  removeTags: {
    description:
      "Removes specific tags from notes while preserving other tags. Tags parameter is space-separated string. Only removes exact matches - won't remove child tags when removing parent. Updates modification time. Safe operation - removing non-existent tags has no effect",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tags: z.string().describe("Space-separated tags"),
    }),
    handler: async ({ notes, tags }: { notes: Array<number | string>; tags: string }) =>
      ankiConnect("removeTags", {
        notes: notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        tags,
      }),
  },

  updateNoteFields: {
    description:
      "Updates only the field values of a note, leaving tags unchanged. Simpler than updateNote when you only need to modify content. Fields object can be partial - unspecified fields remain unchanged. Updates modification time. Changes reflected in all cards from this note",
    schema: z.object({
      note: z.object({
        id: z.union([z.number(), z.string()]),
        fields: z.record(z.string()),
      }),
    }),
    handler: async ({ note }: { note: { id: number | string; fields: Record<string, string> } }) => {
      const result = await ankiConnect("updateNoteFields", {
        note: {
          id: typeof note.id === "string" ? parseInt(note.id, 10) : note.id,
          fields: note.fields,
        },
      });
      return result === null ? true : result;
    },
  },

  getNoteTags: {
    description:
      "Gets tags for specified notes. Returns array of tag arrays matching input note order. Each note's tags returned as array of strings. More efficient than notesInfo when you only need tags. Useful for tag analysis or bulk tag operations",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }: { note: number | string }) =>
      ankiConnect("getNoteTags", {
        note: typeof note === "string" ? parseInt(note, 10) : note,
      }),
  },

  clearUnusedTags: {
    description:
      "Removes all tags from the tag list that aren't assigned to any notes. Cleans up tag autocomplete and tag browser. Safe operation - only removes truly unused tags. Useful after bulk deletions or tag reorganization. No effect on notes",
    schema: z.object({}),
    handler: async () => {
      const result = await ankiConnect("clearUnusedTags");
      return result === null ? true : result;
    },
  },

  replaceTags: {
    description:
      "Replaces specific tags in selected notes. Only affects notes that have the tag_to_replace. Atomic operation - all specified notes updated together. Case-sensitive tag matching. Useful for renaming tags on subset of notes or fixing typos",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({
      notes,
      tagToReplace,
      replaceWithTag,
    }: {
      notes: Array<number | string>;
      tagToReplace: string;
      replaceWithTag: string;
    }) => {
      const result = await ankiConnect("replaceTags", {
        notes: notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag,
      });
      return result === null ? true : result;
    },
  },

  replaceTagsInAllNotes: {
    description:
      "Globally replaces a tag across entire collection. Affects all notes with the specified tag. More efficient than replaceTags for collection-wide changes. Case-sensitive matching. Instant operation even on large collections. Useful for standardizing tag names or merging similar tags",
    schema: z.object({
      tagToReplace: z.string().describe("Tag to replace"),
      replaceWithTag: z.string().describe("Replacement tag"),
    }),
    handler: async ({ tagToReplace, replaceWithTag }: { tagToReplace: string; replaceWithTag: string }) => {
      const result = await ankiConnect("replaceTagsInAllNotes", {
        tag_to_replace: tagToReplace,
        replace_with_tag: replaceWithTag,
      });
      return result === null ? true : result;
    },
  },

  removeEmptyNotes: {
    description:
      "Deletes all notes that have no associated cards (orphaned notes). Can occur when all cards deleted via templates or manual deletion. Cleans up database. Returns count of deleted notes. Safe operation - only removes truly empty notes. Run periodically for maintenance",
    schema: z.object({}),
    handler: async () => ankiConnect("removeEmptyNotes"),
  },

  notesModTime: {
    description:
      "Gets last modification timestamps for notes in seconds since epoch. Returns array matching input order. More efficient than notesInfo for just timestamps. Useful for sync operations, change detection, or finding recently edited notes",
    schema: z.object({
      notes: z.array(z.union([z.number(), z.string()])).describe("Note IDs"),
    }),
    handler: async ({ notes }: { notes: Array<number | string> }) =>
      ankiConnect("notesModTime", {
        notes: notes.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },
} satisfies Record<string, ToolDef>;
