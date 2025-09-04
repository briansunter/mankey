import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNote,
  cleanupNotes,
  normalizeTags,
  setupTestEnvironment,
} from "./test-utils";

describe("Tag Handling Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe("Tag Normalization", () => {
    test("should handle array of strings", () => {
      const input = ["test", "mcp", "array"];
      const result = normalizeTags(input);
      expect(result).toEqual(["test", "mcp", "array"]);
    });

    test("should parse JSON stringified array", () => {
      const input = '["test", "mcp", "json"]';
      const result = normalizeTags(input);
      expect(result).toEqual(["test", "mcp", "json"]);
    });

    test("should handle space-separated string", () => {
      const input = "test mcp string";
      const result = normalizeTags(input);
      expect(result).toEqual(["test", "mcp", "string"]);
    });

    test("should handle empty array", () => {
      const input: string[] = [];
      const result = normalizeTags(input);
      expect(result).toEqual([]);
    });

    test("should handle single tag array", () => {
      const input = ["single"];
      const result = normalizeTags(input);
      expect(result).toEqual(["single"]);
    });

    test("should handle malformed JSON string gracefully", () => {
      const input = '["test",';
      const result = normalizeTags(input);
      expect(result).toEqual(['["test",']);
    });

    test("should handle tags with spaces in JSON format", () => {
      const input = '["tag one", "tag two"]';
      const result = normalizeTags(input);
      expect(result).toEqual(["tag one", "tag two"]);
    });

    test("should handle mixed case tags", () => {
      const input = ["Test", "MCP", "Array"];
      const result = normalizeTags(input);
      expect(result).toEqual(["Test", "MCP", "Array"]);
    });

    test("should filter empty strings from space-separated", () => {
      const input = "test  mcp   string";
      const result = normalizeTags(input);
      expect(result).toEqual(["test", "mcp", "string"]);
    });

    test("should handle null/undefined", () => {
      expect(normalizeTags(null)).toEqual([]);
      expect(normalizeTags(undefined)).toEqual([]);
    });
  });

  describe("Tag Operations with Anki", () => {
    let noteId: number;

    beforeAll(async () => {
      noteId = await createTestNote(
        { Front: "Tag Test Card", Back: "Testing tag handling" },
        ["initial", "test"]
      );
    });

    test("should create note with initial tags", async () => {
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toContain("initial");
      expect(info[0].tags).toContain("test");
    });

    test("should update tags with array format", async () => {
      const result = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          tags: ["updated", "via", "api"],
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toEqual(["updated", "via", "api"]);
    });

    test("should add tags to existing note", async () => {
      const result = await ankiConnect("addTags", {
        notes: [noteId],
        tags: "new additional",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toContain("new");
      expect(info[0].tags).toContain("additional");
      expect(info[0].tags).toContain("updated");
    });

    test("should remove specific tags", async () => {
      const result = await ankiConnect("removeTags", {
        notes: [noteId],
        tags: "new additional",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).not.toContain("new");
      expect(info[0].tags).not.toContain("additional");
      expect(info[0].tags).toContain("updated");
    });

    test("should replace all tags", async () => {
      const result = await ankiConnect("replaceTags", {
        notes: [noteId],
        tag_to_replace: "updated",
        replace_with_tag: "replaced",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toContain("replaced");
      expect(info[0].tags).not.toContain("updated");
    });

    test("should get all tags from collection", async () => {
      const tags = await ankiConnect<string[]>("getTags");
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
    });

    test("should clear unused tags", async () => {
      // Add a unique tag then remove it
      await ankiConnect("addTags", {
        notes: [noteId],
        tags: "temporary_unique_tag_12345",
      });
      await ankiConnect("removeTags", {
        notes: [noteId],
        tags: "temporary_unique_tag_12345",
      });

      const result = await ankiConnect("clearUnusedTags");
      expect(result).toBe(true);

      const tags = await ankiConnect<string[]>("getTags");
      expect(tags).not.toContain("temporary_unique_tag_12345");
    });

    afterAll(async () => {
      await cleanupNotes([noteId]);
    });
  });

  describe("Bulk Tag Operations", () => {
    let noteIds: number[] = [];

    beforeAll(async () => {
      const notes = Array.from({ length: 5 }, (_, i) => ({
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: `Bulk Tag Test ${i + 1}`,
          Back: `Answer ${i + 1}`,
        },
        tags: ["bulk", `item${i + 1}`],
      }));
      noteIds = await ankiConnect<number[]>("addNotes", { notes });
    });

    test("should add tags to multiple notes", async () => {
      const result = await ankiConnect("addTags", {
        notes: noteIds,
        tags: "common shared",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: noteIds,
      });
      info.forEach((note) => {
        expect(note.tags).toContain("common");
        expect(note.tags).toContain("shared");
      });
    });

    test("should remove tags from multiple notes", async () => {
      const result = await ankiConnect("removeTags", {
        notes: noteIds,
        tags: "common",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: noteIds,
      });
      info.forEach((note) => {
        expect(note.tags).not.toContain("common");
        expect(note.tags).toContain("shared");
      });
    });

    test("should replace tags in all notes", async () => {
      const result = await ankiConnect("replaceTagsInAllNotes", {
        tag_to_replace: "bulk",
        replace_with_tag: "batch",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: noteIds,
      });
      info.forEach((note) => {
        expect(note.tags).toContain("batch");
        expect(note.tags).not.toContain("bulk");
      });
    });

    test("should find notes by tag", async () => {
      const foundNotes = await ankiConnect<number[]>("findNotes", {
        query: "tag:batch",
      });
      expect(foundNotes.length).toBeGreaterThanOrEqual(5);
      noteIds.forEach((id) => {
        expect(foundNotes).toContain(id);
      });
    });

    test("should get note tags individually", async () => {
      for (const noteId of noteIds) {
        const tags = await ankiConnect<string[]>("getNoteTags", {
          note: noteId,
        });
        expect(Array.isArray(tags)).toBe(true);
        expect(tags).toContain("batch");
        expect(tags).toContain("shared");
      }
    });

    afterAll(async () => {
      await cleanupNotes(noteIds);
    });
  });

  describe("Edge Cases", () => {
    let noteId: number;

    beforeAll(async () => {
      noteId = await createTestNote();
    });

    test("should handle special characters in tags", async () => {
      const specialTags = ["tag-with-dash", "tag_with_underscore", "tag.with.dot"];
      const result = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          tags: specialTags,
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toEqual(specialTags);
    });

    test("should handle empty tag update", async () => {
      const result = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          tags: [],
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags).toEqual([]);
    });

    test("should handle duplicate tags", async () => {
      const result = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          tags: ["duplicate", "duplicate", "unique"],
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].tags.filter((t: string) => t === "duplicate").length).toBe(1);
      expect(info[0].tags).toContain("unique");
    });

    test("should handle case sensitivity in tags", async () => {
      const result = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          tags: ["Test", "test", "TEST"],
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      // Anki may handle case differently
      expect(info[0].tags.length).toBeGreaterThanOrEqual(1);
    });

    afterAll(async () => {
      await cleanupNotes([noteId]);
    });
  });
});