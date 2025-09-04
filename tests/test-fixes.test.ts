import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNote,
  cleanupNotes,
  setupTestEnvironment,
} from "./test-utils";

describe("Return Value Consistency Tests", () => {
  let testNoteId: number;
  let testCardIds: number[] = [];

  beforeAll(async () => {
    await setupTestEnvironment();
    
    // Create a test note in Default deck
    testNoteId = await createTestNote(
      { Front: "Test Card for Fixes", Back: "Testing return value fixes" },
      ["test-fix"],
      "Default"
    );
    
    // Get cards from the note
    const noteInfo = await ankiConnect<any[]>("notesInfo", {
      notes: [testNoteId],
    });
    testCardIds = noteInfo[0].cards;
  });

  describe("Note Operations", () => {
    test("updateNote should return true", async () => {
      const result = await ankiConnect("updateNote", {
        note: {
          id: testNoteId,
          tags: ["updated-tag"],
        },
      });
      expect(result).toBe(true);
    });

    test("updateNoteFields should return true", async () => {
      const result = await ankiConnect("updateNoteFields", {
        note: {
          id: testNoteId,
          fields: { Front: "Updated Front" },
        },
      });
      expect(result).toBe(true);
    });

    test("deleteNotes should return true", async () => {
      const tempNoteId = await createTestNote();
      const result = await ankiConnect("deleteNotes", {
        notes: [tempNoteId],
      });
      expect(result).toBe(true);
    });
  });

  describe("Card Operations", () => {
    test("suspend should return true", async () => {
      const result = await ankiConnect("suspend", {
        cards: testCardIds,
      });
      expect(result).toBe(true);
    });

    test("unsuspend should return true", async () => {
      const result = await ankiConnect("unsuspend", {
        cards: testCardIds,
      });
      expect(result).toBe(true);
    });

    test("changeDeck should return true", async () => {
      const result = await ankiConnect("changeDeck", {
        cards: testCardIds,
        deck: "Default",
      });
      expect(result).toBe(true);
    });

    test("forgetCards should return true", async () => {
      const result = await ankiConnect("forgetCards", {
        cards: [testCardIds[0]],
      });
      expect(result).toBe(true);
    });

    test("relearnCards should return true", async () => {
      const result = await ankiConnect("relearnCards", {
        cards: [testCardIds[0]],
      });
      expect(result).toBe(true);
    });

    test("setDueDate should return true", async () => {
      const result = await ankiConnect("setDueDate", {
        cards: testCardIds,
        days: "1",
      });
      expect(result).toBe(true);
    });

    test("setEaseFactors should return array of true", async () => {
      const result = await ankiConnect<boolean[]>("setEaseFactors", {
        cards: testCardIds,
        easeFactors: testCardIds.map(() => 2500),
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((r) => r === true)).toBe(true);
    });

    test("answerCards should return array of true", async () => {
      const result = await ankiConnect<boolean[]>("answerCards", {
        answers: testCardIds.map((cardId) => ({
          cardId,
          ease: 3,
        })),
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((r) => r === true)).toBe(true);
    });
  });

  describe("Tag Operations", () => {
    test("addTags should return true", async () => {
      const result = await ankiConnect("addTags", {
        notes: [testNoteId],
        tags: "test-add-tag",
      });
      expect(result).toBe(true);
    });

    test("removeTags should return true", async () => {
      const result = await ankiConnect("removeTags", {
        notes: [testNoteId],
        tags: "test-add-tag",
      });
      expect(result).toBe(true);
    });

    test("replaceTags should return true", async () => {
      // First add a tag to replace
      await ankiConnect("addTags", {
        notes: [testNoteId],
        tags: "old-tag",
      });
      
      const result = await ankiConnect("replaceTags", {
        notes: [testNoteId],
        tag_to_replace: "old-tag",
        replace_with_tag: "new-tag",
      });
      expect(result).toBe(true);
    });

    test("replaceTagsInAllNotes should return true", async () => {
      const result = await ankiConnect("replaceTagsInAllNotes", {
        tag_to_replace: "test-fix",
        replace_with_tag: "test-fixed",
      });
      expect(result).toBe(true);
    });

    test("clearUnusedTags should return true", async () => {
      const result = await ankiConnect("clearUnusedTags");
      expect(result).toBe(true);
    });
  });

  describe("Deck Operations", () => {
    test("getDeckConfig should return config object", async () => {
      const config = await ankiConnect("getDeckConfig", {
        deck: "Default",
      });
      expect(config).toBeDefined();
      expect(config).toHaveProperty("name");
      expect(config).toHaveProperty("new");
      expect(config).toHaveProperty("rev");
    });

    test("getDeckStats should return stats object", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: ["Default"],
      });
      expect(stats).toBeDefined();
      expect(stats["Default"]).toBeDefined();
    });

    test("deckNames should return array of names", async () => {
      const names = await ankiConnect<string[]>("deckNames");
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("Default");
    });

    test("deckNamesAndIds should return object", async () => {
      const namesAndIds = await ankiConnect("deckNamesAndIds");
      expect(typeof namesAndIds).toBe("object");
      expect(namesAndIds).toHaveProperty("Default");
    });
  });

  describe("Model Operations", () => {
    test("modelNames should return array of names", async () => {
      const names = await ankiConnect<string[]>("modelNames");
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain("Basic");
    });

    test("modelNamesAndIds should return object", async () => {
      const namesAndIds = await ankiConnect("modelNamesAndIds");
      expect(typeof namesAndIds).toBe("object");
      expect(Object.keys(namesAndIds).length).toBeGreaterThan(0);
    });

    test("modelFieldNames should return field names", async () => {
      const fields = await ankiConnect<string[]>("modelFieldNames", {
        modelName: "Basic",
      });
      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toContain("Front");
      expect(fields).toContain("Back");
    });
  });

  describe("Media Operations", () => {
    test("storeMediaFile should return filename", async () => {
      const filename = "test-file-" + Date.now() + ".txt";
      const data = Buffer.from("Test content").toString("base64");
      
      const result = await ankiConnect<string>("storeMediaFile", {
        filename,
        data,
      });
      expect(result).toBe(filename);
      
      // Cleanup
      await ankiConnect("deleteMediaFile", { filename });
    });

    test("deleteMediaFile should return true", async () => {
      const filename = "test-to-delete-" + Date.now() + ".txt";
      const data = Buffer.from("Test").toString("base64");
      
      // First store it
      await ankiConnect("storeMediaFile", { filename, data });
      
      // Then delete it
      const result = await ankiConnect("deleteMediaFile", { filename });
      expect(result).toBe(true);
    });
  });

  describe("Special Cases", () => {
    test("sync should handle correctly", async () => {
      try {
        // Sync might fail if not configured, but should not throw
        const result = await ankiConnect("sync");
        expect([true, false, null]).toContain(result);
      } catch (error: any) {
        // Expected if sync is not configured
        expect(error.message).toContain("not configured");
      }
    });

    test("saveDeckConfig should handle config object", async () => {
      const config = await ankiConnect("getDeckConfig", {
        deck: "Default",
      });
      
      if (config) {
        config.name = "UpdatedConfig_" + Date.now();
        const result = await ankiConnect("saveDeckConfig", { config });
        expect([true, false]).toContain(result);
      }
    });

    test("cardReviews should require startID parameter", async () => {
      const result = await ankiConnect("cardReviews", {
        deck: "Default",
        startID: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Batch Operations", () => {
    test("addNotes should return array of note IDs", async () => {
      const notes = Array.from({ length: 3 }, (_, i) => ({
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: `Batch Test ${i + 1}`,
          Back: `Answer ${i + 1}`,
        },
        tags: ["batch-test"],
      }));
      
      const result = await ankiConnect<(number | null)[]>("addNotes", {
        notes,
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      
      const validIds = result.filter((id) => id !== null) as number[];
      expect(validIds.length).toBe(3);
      
      // Cleanup
      await cleanupNotes(validIds);
    });

    test("canAddNotes should return array of booleans", async () => {
      const notes = Array.from({ length: 3 }, (_, i) => ({
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: `Can Add Test ${i + 1}`,
          Back: `Answer ${i + 1}`,
        },
      }));
      
      const result = await ankiConnect<boolean[]>("canAddNotes", {
        notes,
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result.every((r) => typeof r === "boolean")).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup test note only (don't delete decks)
    await cleanupNotes([testNoteId]);
  });
});