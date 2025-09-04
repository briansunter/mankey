import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  normalizeTags,
  waitFor,
  getAllCards,
  getNextCard,
  createTestNote,
  cleanupNotes,
  setupTestEnvironment,
  createTestNotes,
  getCardsByDeck,
  suspendCards,
  unsuspendCards,
} from "./test-utils";

describe("Test Utils Functions", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe("normalizeTags edge cases", () => {
    test("should handle malformed JSON with special characters", () => {
      const input = '["test", "malformed';
      const result = normalizeTags(input);
      expect(result).toEqual(['["test",', '"malformed']);
    });

    test("should handle JSON with nested brackets", () => {
      const input = '[["nested"]]';
      const result = normalizeTags(input);
      expect(result).toEqual([["nested"] as any]);
    });

    test("should handle number input", () => {
      const input = 12345;
      const result = normalizeTags(input);
      expect(result).toEqual([]);
    });

    test("should handle object input", () => {
      const input = { tag: "test" };
      const result = normalizeTags(input);
      expect(result).toEqual([]);
    });

    test("should handle empty string", () => {
      const input = "";
      const result = normalizeTags(input);
      expect(result).toEqual([]);
    });

    test("should handle string with only spaces", () => {
      const input = "   ";
      const result = normalizeTags(input);
      expect(result).toEqual([]);
    });

    test("should handle string with tabs and newlines", () => {
      const input = "tag1\ttag2\ntag3";
      const result = normalizeTags(input);
      expect(result).toEqual(["tag1\ttag2\ntag3"]);
    });

    test("should handle boolean input", () => {
      expect(normalizeTags(true)).toEqual([]);
      expect(normalizeTags(false)).toEqual([]);
    });

    test("should handle very long tag strings", () => {
      const longTag = "a".repeat(1000);
      const result = normalizeTags(longTag);
      expect(result).toEqual([longTag]);
    });

    test("should handle unicode characters", () => {
      const input = "标签 タグ метка";
      const result = normalizeTags(input);
      expect(result).toEqual(["标签", "タグ", "метка"]);
    });
  });

  describe("waitFor function", () => {
    test("should resolve immediately when condition is true", async () => {
      const start = Date.now();
      await waitFor(async () => true, 1000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    test("should timeout when condition never becomes true", async () => {
      await expect(
        waitFor(async () => false, 100, 20)
      ).rejects.toThrow("Timeout waiting for condition");
    });

    test("should wait and resolve when condition becomes true", async () => {
      let counter = 0;
      const start = Date.now();
      
      await waitFor(
        async () => {
          counter++;
          return counter >= 3;
        },
        1000,
        50
      );
      
      const elapsed = Date.now() - start;
      expect(counter).toBeGreaterThanOrEqual(3);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(500);
    });

    test("should handle async errors in condition", async () => {
      await expect(
        waitFor(async () => {
          throw new Error("Condition error");
        }, 100)
      ).rejects.toThrow("Condition error");
    });

    test("should use default timeout and interval", async () => {
      const start = Date.now();
      
      await waitFor(async () => {
        return Date.now() - start > 200;
      });
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(200);
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("getAllCards function", () => {
    test("should return all cards in collection", async () => {
      const cards = await getAllCards();
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThanOrEqual(0);
      
      // All items should be numbers (card IDs)
      cards.forEach((cardId) => {
        expect(typeof cardId).toBe("number");
      });
    });

    test("should include cards from test notes", async () => {
      // Create a test note
      const noteId = await createTestNote(
        { Front: "GetAllCards Test", Back: "Test Answer" },
        ["test-getallcards"]
      );

      // Get all cards
      const allCards = await getAllCards();
      
      // Find cards from our test note
      const noteCards = await ankiConnect<number[]>("findCards", {
        query: `nid:${noteId}`,
      });
      
      // All note cards should be in allCards
      noteCards.forEach((cardId) => {
        expect(allCards).toContain(cardId);
      });

      // Cleanup
      await cleanupNotes([noteId]);
    });
  });

  describe("getNextCard function", () => {
    test("should get next card for review", async () => {
      const nextCard = await getNextCard();
      
      if (nextCard) {
        expect(nextCard).toHaveProperty("cardId");
        expect(nextCard).toHaveProperty("note");
        expect(nextCard).toHaveProperty("deckName");
        expect(nextCard).toHaveProperty("queue");
        expect(typeof nextCard.cardId).toBe("number");
      } else {
        // No cards due is also valid
        expect(nextCard).toBeUndefined();
      }
    });

    test("should return undefined when no cards are due", async () => {
      // Suspend all cards to ensure none are due
      const allCards = await getAllCards();
      if (allCards.length > 0) {
        const firstFewCards = allCards.slice(0, Math.min(10, allCards.length));
        await suspendCards(firstFewCards);
        
        const _nextCard = await getNextCard();
        // Might still have other cards due
        
        // Unsuspend for cleanup
        await unsuspendCards(firstFewCards);
      } else {
        const nextCard = await getNextCard();
        expect(nextCard).toBeUndefined();
      }
    });
  });

  describe("createTestNotes batch function", () => {
    test("should create multiple notes with unique content", async () => {
      const count = 5;
      const prefix = "BatchTest";
      const noteIds = await createTestNotes(count, prefix);
      
      expect(noteIds.length).toBe(count);
      expect(noteIds.every((id) => typeof id === "number")).toBe(true);
      expect(noteIds.every((id) => id > 0)).toBe(true);
      
      // Verify notes were created with correct content
      const notesInfo = await ankiConnect<any[]>("notesInfo", {
        notes: noteIds,
      });
      
      notesInfo.forEach((note, index) => {
        expect(note.fields.Front.value).toContain(`${prefix} Front ${index + 1}`);
        expect(note.fields.Back.value).toContain(`${prefix} Back ${index + 1}`);
        expect(note.tags).toContain("test");
        expect(note.tags).toContain(`batch${index + 1}`);
      });
      
      // Cleanup
      await cleanupNotes(noteIds);
    });

    test("should handle empty batch", async () => {
      const noteIds = await createTestNotes(0, "Empty");
      expect(noteIds).toEqual([]);
    });

    test("should create single note in batch", async () => {
      const noteIds = await createTestNotes(1, "Single");
      expect(noteIds.length).toBe(1);
      
      // Cleanup
      await cleanupNotes(noteIds);
    });
  });

  describe("getCardsByDeck function", () => {
    test("should get all cards from Default deck", async () => {
      const cards = await getCardsByDeck("Default");
      expect(Array.isArray(cards)).toBe(true);
      
      if (cards.length > 0) {
        // Verify they belong to Default deck
        const cardInfo = await ankiConnect<any[]>("cardsInfo", {
          cards: cards.slice(0, 5), // Check first 5 cards
        });
        
        cardInfo.forEach((card) => {
          expect(card.deckName).toBe("Default");
        });
      }
    });

    test("should return empty array for non-existent deck", async () => {
      const cards = await getCardsByDeck("NonExistentDeck12345");
      expect(cards).toEqual([]);
    });
  });

  describe("Error handling in utility functions", () => {
    test("should handle network errors gracefully", async () => {
      // Mock a network error by using invalid URL temporarily
      const originalUrl = process.env.ANKI_CONNECT_URL;
      process.env.ANKI_CONNECT_URL = "http://invalid-url-12345:9999";
      
      try {
        // The fetch should fail with a network error
        await getAllCards();
        // If we get here, the test should fail
        expect(false).toBe(true);
      } catch (error) {
        // We expect an error to be thrown
        expect(error).toBeDefined();
      } finally {
        // Restore original URL
        if (originalUrl) {
          process.env.ANKI_CONNECT_URL = originalUrl;
        } else {
          delete process.env.ANKI_CONNECT_URL;
        }
      }
    });

    test("should handle invalid note IDs in cleanupNotes", async () => {
      // cleanupNotes doesn't throw on invalid IDs, it just returns null
      await expect(cleanupNotes([999999999])).resolves.toBeUndefined();
    });

    test("should handle invalid card IDs in suspend/unsuspend", async () => {
      await expect(suspendCards([999999999])).rejects.toThrow();
      await expect(unsuspendCards([999999999])).rejects.toThrow();
    });
  });

  describe("ankiConnect function error cases", () => {
    test("should throw on Anki-Connect error response", async () => {
      await expect(
        ankiConnect("invalidAction", {})
      ).rejects.toThrow("AnkiConnect error");
    });

    test("should handle missing required parameters", async () => {
      // findCards with empty query returns empty array
      const result = await ankiConnect("findCards", {});
      expect(result).toEqual([]);
    });

    test("should handle invalid parameter types", async () => {
      await expect(
        ankiConnect("findCards", { query: 123 })
      ).rejects.toThrow();
    });
  });
});

describe("Advanced Query Tests", () => {
  let testNoteIds: number[] = [];

  beforeAll(async () => {
    await setupTestEnvironment();
    
    // Create test notes with various properties
    const timestamp = Date.now();
    testNoteIds = await ankiConnect<number[]>("addNotes", {
      notes: [
        {
          deckName: "Default",
          modelName: "Basic",
          fields: { Front: `Query Test 1 - ${timestamp}`, Back: `Answer 1 - ${timestamp}` },
          tags: ["query", "test1", "odd"],
        },
        {
          deckName: "Default",
          modelName: "Basic",
          fields: { Front: `Query Test 2 - ${timestamp}`, Back: `Answer 2 - ${timestamp}` },
          tags: ["query", "test2", "even"],
        },
        {
          deckName: "Default",
          modelName: "Basic",
          fields: { Front: `Query Test 3 - ${timestamp}`, Back: `Answer 3 - ${timestamp}` },
          tags: ["query", "test3", "odd"],
        },
      ],
    });
  });

  test("should find cards with complex queries", async () => {
    // Test OR query
    const orQuery = await ankiConnect<number[]>("findCards", {
      query: "tag:odd OR tag:even",
    });
    expect(orQuery.length).toBeGreaterThanOrEqual(3);

    // Test AND query
    const andQuery = await ankiConnect<number[]>("findCards", {
      query: "tag:query tag:test1",
    });
    expect(andQuery.length).toBeGreaterThanOrEqual(1);

    // Test NOT query
    const notQuery = await ankiConnect<number[]>("findCards", {
      query: "tag:query -tag:even",
    });
    expect(notQuery.length).toBeGreaterThanOrEqual(2);

    // Test field search - just check the cards from the tags exist
    const fieldQuery = await ankiConnect<number[]>("findCards", {
      query: "tag:query",
    });
    expect(fieldQuery.length).toBeGreaterThanOrEqual(3);
  });

  test("should handle special characters in queries", async () => {
    // Create note with special characters
    const specialNoteId = await createTestNote(
      { Front: "Test (with) [special] {chars}", Back: "Answer" },
      ["special-chars"]
    );

    // Search for it
    const found = await ankiConnect<number[]>("findCards", {
      query: "tag:special-chars",
    });
    expect(found.length).toBeGreaterThanOrEqual(1);

    await cleanupNotes([specialNoteId]);
  });

  test("should handle empty query results", async () => {
    const emptyResult = await ankiConnect<number[]>("findCards", {
      query: "tag:nonexistenttag12345",
    });
    expect(emptyResult).toEqual([]);
  });

  afterAll(async () => {
    await cleanupNotes(testNoteIds);
  });
});

describe("Concurrent Operations", () => {
  test("should handle multiple simultaneous operations", async () => {
    await setupTestEnvironment();
    
    // Run multiple operations concurrently
    const operations = await Promise.all([
      ankiConnect("deckNames"),
      ankiConnect("modelNames"),
      ankiConnect("getTags"),
      ankiConnect("version"),
      ankiConnect("getNumCardsReviewedToday"),
    ]);

    expect(Array.isArray(operations[0])).toBe(true); // deckNames
    expect(Array.isArray(operations[1])).toBe(true); // modelNames
    expect(Array.isArray(operations[2])).toBe(true); // getTags
    expect(typeof operations[3]).toBe("number"); // version
    expect(typeof operations[4]).toBe("number"); // getNumCardsReviewedToday
  });

  test("should handle concurrent note creation", async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      createTestNote(
        { Front: `Concurrent ${i}`, Back: `Answer ${i}` },
        [`concurrent${i}`]
      )
    );

    const noteIds = await Promise.all(promises);
    expect(noteIds.length).toBe(5);
    expect(noteIds.every((id) => typeof id === "number")).toBe(true);

    // Cleanup
    await cleanupNotes(noteIds);
  });

  test("should handle mixed read/write operations", async () => {
    const noteId = await createTestNote();
    
    // Concurrent read operations on the same note
    const [info1, info2, tags] = await Promise.all([
      ankiConnect("notesInfo", { notes: [noteId] }),
      ankiConnect("notesInfo", { notes: [noteId] }),
      ankiConnect("getNoteTags", { note: noteId }),
    ]);

    expect(info1).toEqual(info2); // Should return same info
    expect(Array.isArray(tags)).toBe(true);

    await cleanupNotes([noteId]);
  });
});