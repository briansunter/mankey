import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  verifyAnkiConnection,
  createTestNote,
  cleanupNotes,
  createTestDeck,
  cleanupDeck,
  setupTestEnvironment,
} from "./test-utils";

describe("Anki-Connect Integration Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe("Basic Connectivity", () => {
    test("should connect to Anki-Connect", async () => {
      await verifyAnkiConnection(); // Will throw if connection fails
      expect(true).toBe(true); // Connection successful
    });

    test("should get version", async () => {
      const version = await ankiConnect<number>("version");
      expect(version).toBeGreaterThanOrEqual(6);
    });

    test("should request permission", async () => {
      const result = await ankiConnect<{
        permission: string;
        requireApikey: boolean;
        version: number;
      }>("requestPermission");
      expect(result.permission).toBe("granted");
    });

    test("should get deck names", async () => {
      const decks = await ankiConnect<string[]>("deckNames");
      expect(Array.isArray(decks)).toBe(true);
      expect(decks).toContain("Default");
    });

    test("should get model names", async () => {
      const models = await ankiConnect<string[]>("modelNames");
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe("Deck Operations", () => {
    test("should get existing deck names", async () => {
      const decks = await ankiConnect<string[]>("deckNames");
      expect(Array.isArray(decks)).toBe(true);
      expect(decks.length).toBeGreaterThan(0);
      expect(decks).toContain("Default");
    });

    test("should get deck stats for Default deck", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: ["Default"],
      });
      expect(stats).toBeDefined();
      expect(stats["Default"]).toBeDefined();
    });

    test("should get deck config for Default deck", async () => {
      const config = await ankiConnect("getDeckConfig", {
        deck: "Default",
      });
      expect(config).toBeDefined();
      expect(config).toHaveProperty("name");
      expect(config).toHaveProperty("new");
      expect(config).toHaveProperty("rev");
    });

    test("should get deck names and IDs", async () => {
      const decksAndIds = await ankiConnect("deckNamesAndIds");
      expect(typeof decksAndIds).toBe("object");
      expect(decksAndIds).toHaveProperty("Default");
      expect(typeof decksAndIds["Default"]).toBe("number");
    });
  });

  describe("Note Operations", () => {
    let testNoteIds: number[] = [];

    test("should add a note", async () => {
      const noteId = await createTestNote(
        { Front: "Test Question", Back: "Test Answer" },
        ["test", "integration"],
        "Default"
      );
      expect(typeof noteId).toBe("number");
      expect(noteId).toBeGreaterThan(0);
      testNoteIds.push(noteId);
    });

    test("should find notes", async () => {
      const notes = await ankiConnect<number[]>("findNotes", {
        query: "tag:test",
      });
      expect(Array.isArray(notes)).toBe(true);
      expect(notes).toContain(testNoteIds[0]);
    });

    test("should get notes info", async () => {
      const info = await ankiConnect("notesInfo", {
        notes: testNoteIds,
      });
      expect(Array.isArray(info)).toBe(true);
      expect(info[0]).toHaveProperty("noteId");
      expect(info[0]).toHaveProperty("fields");
      expect(info[0].fields.Front.value).toBe("Test Question");
    });

    test("should update note fields", async () => {
      const result = await ankiConnect("updateNoteFields", {
        note: {
          id: testNoteIds[0],
          fields: {
            Front: "Updated Question",
            Back: "Updated Answer",
          },
        },
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: testNoteIds,
      });
      expect(info[0].fields.Front.value).toBe("Updated Question");
    });

    test("should add tags to note", async () => {
      const result = await ankiConnect("addTags", {
        notes: testNoteIds,
        tags: "newtag anothertag",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: testNoteIds,
      });
      expect(info[0].tags).toContain("newtag");
      expect(info[0].tags).toContain("anothertag");
    });

    test("should remove tags from note", async () => {
      const result = await ankiConnect("removeTags", {
        notes: testNoteIds,
        tags: "newtag",
      });
      expect(result).toBe(true);

      const info = await ankiConnect<any[]>("notesInfo", {
        notes: testNoteIds,
      });
      expect(info[0].tags).not.toContain("newtag");
      expect(info[0].tags).toContain("anothertag");
    });

    test("should delete notes", async () => {
      const result = await ankiConnect("deleteNotes", {
        notes: testNoteIds,
      });
      expect(result).toBe(true);

      const notes = await ankiConnect<number[]>("findNotes", {
        query: `nid:${testNoteIds[0]}`,
      });
      expect(notes).toHaveLength(0);
      testNoteIds = [];
    });
  });

  describe("Card Operations", () => {
    let testNoteId: number;
    let testCardIds: number[] = [];

    beforeAll(async () => {
      testNoteId = await createTestNote(
        { Front: "Card Test", Back: "Card Answer" },
        ["cardtest"]
      );
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${testNoteId}`,
      });
      testCardIds = cards;
    });

    test("should find cards", async () => {
      const cards = await ankiConnect<number[]>("findCards", {
        query: "tag:cardtest",
      });
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards).toEqual(testCardIds);
    });

    test("should get card info", async () => {
      const info = await ankiConnect("cardsInfo", {
        cards: testCardIds,
      });
      expect(Array.isArray(info)).toBe(true);
      expect(info[0]).toHaveProperty("cardId");
      expect(info[0]).toHaveProperty("note");
      expect(info[0]).toHaveProperty("deckName");
    });

    test("should suspend cards", async () => {
      const result = await ankiConnect("suspend", {
        cards: testCardIds,
      });
      expect(result).toBe(true);

      const suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: testCardIds,
      });
      expect(suspended).toEqual(testCardIds.map(() => true));
    });

    test("should unsuspend cards", async () => {
      const result = await ankiConnect("unsuspend", {
        cards: testCardIds,
      });
      expect(result).toBe(true);

      const suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: testCardIds,
      });
      expect(suspended).toEqual(testCardIds.map(() => false));
    });

    test("should get card intervals", async () => {
      const intervals = await ankiConnect<number[]>("getIntervals", {
        cards: testCardIds,
        complete: true,
      });
      expect(Array.isArray(intervals)).toBe(true);
      expect(intervals.length).toBe(testCardIds.length);
    });

    test("should get card ease factors", async () => {
      const factors = await ankiConnect<number[]>("getEaseFactors", {
        cards: testCardIds,
      });
      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBe(testCardIds.length);
      factors.forEach((factor) => {
        expect(factor).toBeGreaterThanOrEqual(1000);
      });
    });

    test("should set ease factors", async () => {
      const newFactors = testCardIds.map(() => 2000);
      const result = await ankiConnect<boolean[]>("setEaseFactors", {
        cards: testCardIds,
        easeFactors: newFactors,
      });
      expect(result).toEqual(testCardIds.map(() => true));

      const factors = await ankiConnect<number[]>("getEaseFactors", {
        cards: testCardIds,
      });
      expect(factors).toEqual(newFactors);
    });

    test("should check if cards are due", async () => {
      const due = await ankiConnect<boolean[]>("areDue", {
        cards: testCardIds,
      });
      expect(Array.isArray(due)).toBe(true);
      expect(due.length).toBe(testCardIds.length);
    });

    test("should forget cards", async () => {
      const result = await ankiConnect("forgetCards", {
        cards: testCardIds,
      });
      expect(result).toBe(true);
    });

    test("should relearn cards", async () => {
      const result = await ankiConnect("relearnCards", {
        cards: testCardIds,
      });
      expect(result).toBe(true);
    });

    afterAll(async () => {
      await cleanupNotes([testNoteId]);
    });
  });

  describe("Media Operations", () => {
    test("should get media files names", async () => {
      const files = await ankiConnect<string[]>("getMediaFilesNames", {
        pattern: "*",
      });
      expect(Array.isArray(files)).toBe(true);
    });

    test("should get media directory path", async () => {
      const path = await ankiConnect<string>("getMediaDirPath");
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    test("should store and retrieve media file", async () => {
      const filename = "test-image-" + Date.now() + ".txt";
      const data = Buffer.from("Test content").toString("base64");

      const storedName = await ankiConnect<string>("storeMediaFile", {
        filename,
        data,
      });
      expect(storedName).toBe(filename);

      const retrieved = await ankiConnect<string>("retrieveMediaFile", {
        filename,
      });
      expect(retrieved).toBeDefined();
      expect(Buffer.from(retrieved, "base64").toString()).toBe("Test content");

      // Cleanup
      await ankiConnect("deleteMediaFile", { filename });
    });
  });

  describe("Model Operations", () => {
    test("should get model names and IDs", async () => {
      const namesAndIds = await ankiConnect<{ [key: string]: number }>(
        "modelNamesAndIds"
      );
      expect(typeof namesAndIds).toBe("object");
      expect(Object.keys(namesAndIds).length).toBeGreaterThan(0);
    });

    test("should get model field names", async () => {
      const fields = await ankiConnect<string[]>("modelFieldNames", {
        modelName: "Basic",
      });
      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toContain("Front");
      expect(fields).toContain("Back");
    });

    test("should get model styling", async () => {
      const styling = await ankiConnect<{ css: string }>("modelStyling", {
        modelName: "Basic",
      });
      expect(styling).toHaveProperty("css");
      expect(typeof styling.css).toBe("string");
    });

    test("should get model templates", async () => {
      const templates = await ankiConnect("modelTemplates", {
        modelName: "Basic",
      });
      expect(typeof templates).toBe("object");
      expect(Object.keys(templates).length).toBeGreaterThan(0);
    });
  });

  describe("Collection Statistics", () => {
    test("should get number of cards reviewed today", async () => {
      const count = await ankiConnect<number>("getNumCardsReviewedToday");
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("should get collection stats HTML", async () => {
      const stats = await ankiConnect<string>("getCollectionStatsHTML", {
        wholeCollection: false,
      });
      expect(typeof stats).toBe("string");
      expect(stats.length).toBeGreaterThan(0);
    });

    test("should get latest review ID", async () => {
      const id = await ankiConnect<number>("getLatestReviewID");
      expect(typeof id).toBe("number");
    });
  });

  describe("Pagination Support", () => {
    let testNoteIds: number[] = [];

    beforeAll(async () => {
      // Create 10 test notes for pagination testing
      const notes = Array.from({ length: 10 }, (_, i) => ({
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: `Pagination Test ${i + 1}`,
          Back: `Answer ${i + 1}`,
        },
        tags: ["pagination-test"],
      }));
      testNoteIds = await ankiConnect<number[]>("addNotes", { notes });
    });

    test("should support pagination for findCards", async () => {
      const firstPage = await ankiConnect("findCards", {
        query: "tag:pagination-test",
        offset: 0,
        limit: 5,
      });
      expect(firstPage.cards.length).toBe(5);
      expect(firstPage.hasMore).toBe(true);

      const secondPage = await ankiConnect("findCards", {
        query: "tag:pagination-test",
        offset: 5,
        limit: 5,
      });
      expect(secondPage.cards.length).toBe(5);
      expect(secondPage.hasMore).toBe(false);
    });

    test("should support pagination for findNotes", async () => {
      const firstPage = await ankiConnect("findNotes", {
        query: "tag:pagination-test",
        offset: 0,
        limit: 3,
      });
      expect(firstPage.notes.length).toBe(3);
      expect(firstPage.total).toBe(10);
      expect(firstPage.hasMore).toBe(true);
    });

    afterAll(async () => {
      await cleanupNotes(testNoteIds);
    });
  });
});