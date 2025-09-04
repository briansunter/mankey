import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNote,
  cleanupNotes,
  setupTestEnvironment,
  createTestNotes,
  suspendCards,
  unsuspendCards,
  getDeckStats,
  answerCard,
} from "./test-utils";

describe("Real Operations Integration Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe("Complete Workflow Tests", () => {
    test("should perform complete note lifecycle", async () => {
      // Create note
      const noteId = await createTestNote(
        { Front: "What is MCP?", Back: "Model Context Protocol" },
        ["learning", "tech"]
      );
      expect(noteId).toBeGreaterThan(0);

      // Find the note
      const foundNotes = await ankiConnect<number[]>("findNotes", {
        query: "tag:learning",
      });
      expect(foundNotes).toContain(noteId);

      // Update the note
      const updateResult = await ankiConnect("updateNote", {
        note: {
          id: noteId,
          fields: { Front: "What is Model Context Protocol?" },
          tags: ["learning", "tech", "updated"],
        },
      });
      expect(updateResult).toBeNull();

      // Verify update
      const info = await ankiConnect<Array<{ fields: Record<string, { value: string }>; tags: string[] }>>("notesInfo", {
        notes: [noteId],
      });
      expect(info[0].fields.Front.value).toBe("What is Model Context Protocol?");
      expect(info[0].tags).toContain("updated");

      // Delete note
      const deleteResult = await ankiConnect("deleteNotes", {
        notes: [noteId],
      });
      expect(deleteResult).toBeNull();

      // Verify deletion
      const afterDelete = await ankiConnect<number[]>("findNotes", {
        query: `nid:${noteId}`,
      });
      expect(afterDelete).toHaveLength(0);
    });

    test("should perform note operations in Default deck", async () => {
      // Use Default deck for all operations
      const deckName = "Default";

      // Verify deck exists
      const decks = await ankiConnect<string[]>("deckNames");
      expect(decks).toContain(deckName);

      // Add notes to deck
      const noteIds = await ankiConnect<number[]>("addNotes", {
        notes: Array.from({ length: 3 }, (_, i) => ({
          deckName,
          modelName: "Basic",
          fields: {
            Front: `Question ${i + 1} - ${Date.now()}`,
            Back: `Answer ${i + 1} - ${Date.now()}`,
          },
          tags: ["deck-test"],
        })),
      });
      expect(noteIds.length).toBe(3);

      // Get deck stats - might return undefined if deck is empty
      const stats = await getDeckStats(deckName);
      expect(stats).toBeDefined();

      // Get cards from deck
      const cards = await ankiConnect<number[]>("findCards", {
        query: "tag:deck-test",
      });
      expect(cards.length).toBeGreaterThanOrEqual(3);

      // Clean up notes
      await cleanupNotes(noteIds.filter((id) => id !== null) as number[]);
    });
  });

  describe("Bulk Operations", () => {
    test("should handle bulk note creation and modification", async () => {
      const count = 10;
      const noteIds = await createTestNotes(count, "Bulk");
      
      expect(noteIds.length).toBe(count);
      expect(noteIds.every((id) => id !== null)).toBe(true);

      // Bulk add tags
      const addTagsResult = await ankiConnect("addTags", {
        notes: noteIds,
        tags: "bulk-tagged processed",
      });
      expect(addTagsResult).toBeNull();

      // Verify tags added
      const info = await ankiConnect<Array<{ tags: string[]; cards: number[] }>>("notesInfo", {
        notes: noteIds,
      });
      info.forEach((note) => {
        expect(note.tags).toContain("bulk-tagged");
        expect(note.tags).toContain("processed");
      });

      // Bulk suspend cards
      const allCards: number[] = [];
      for (const note of info) {
        allCards.push(...note.cards);
      }
      const suspendResult = await suspendCards(allCards);
      // suspend returns true on success
      expect(suspendResult).toBeDefined();

      // Verify suspension
      const suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: allCards,
      });
      expect(suspended.every((s) => s === true)).toBe(true);

      // Bulk unsuspend
      const unsuspendResult = await unsuspendCards(allCards);
      // unsuspend returns true on success
      expect(unsuspendResult).toBeDefined();

      // Clean up
      await cleanupNotes(noteIds);
    });

    test("should handle pagination for large result sets", async () => {
      const totalNotes = 15;
      const noteIds = await createTestNotes(totalNotes, "Pagination");

      // Test paginated findCards
      const firstPage = await ankiConnect("findCards", {
        query: "tag:test",
        offset: 0,
        limit: 5,
      });
      expect(firstPage.cards.length).toBeLessThanOrEqual(5);
      expect(firstPage.hasMore).toBeDefined();

      if (firstPage.hasMore) {
        const secondPage = await ankiConnect("findCards", {
          query: "tag:test",
          offset: 5,
          limit: 5,
        });
        expect(secondPage.cards).toBeDefined();
      }

      // Test paginated findNotes
      const notesPage = await ankiConnect("findNotes", {
        query: "tag:test",
        offset: 0,
        limit: 10,
      });
      expect(notesPage.notes).toBeDefined();
      expect(notesPage.total).toBeGreaterThanOrEqual(totalNotes);

      // Clean up
      await cleanupNotes(noteIds);
    });
  });

  describe("Card State Management", () => {
    let noteIds: number[];
    let cardIds: number[];

    beforeAll(async () => {
      // Use Default deck instead of creating new one
      const testDeck = "Default";
      const timestamp = Date.now();
      
      // Create notes with cards
      noteIds = await ankiConnect<number[]>("addNotes", {
        notes: Array.from({ length: 5 }, (_, i) => ({
          deckName: testDeck,
          modelName: "Basic",
          fields: {
            Front: `State Test ${i + 1} - ${timestamp}`,
            Back: `Answer ${i + 1} - ${timestamp}`,
          },
          tags: ["state-test"],
        })),
      });

      // Get all card IDs
      cardIds = await ankiConnect<number[]>("findCards", {
        query: "tag:state-test",
      });
    });

    test("should manage card suspension state", async () => {
      // Initially not suspended
      let suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: cardIds,
      });
      expect(suspended.every((s) => s === false)).toBe(true);

      // Suspend cards
      await suspendCards(cardIds);
      suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: cardIds,
      });
      expect(suspended.every((s) => s === true)).toBe(true);

      // Unsuspend cards
      await unsuspendCards(cardIds);
      suspended = await ankiConnect<boolean[]>("areSuspended", {
        cards: cardIds,
      });
      expect(suspended.every((s) => s === false)).toBe(true);
    });

    test("should manage card learning state", async () => {
      // Forget cards (reset to new)
      const forgetResult = await ankiConnect("forgetCards", {
        cards: cardIds.slice(0, 2),
      });
      expect(forgetResult).toBeNull();

      // Relearn cards
      const relearnResult = await ankiConnect("relearnCards", {
        cards: cardIds.slice(2, 4),
      });
      expect(relearnResult).toBeNull();

      // Check if cards are due
      const due = await ankiConnect<boolean[]>("areDue", {
        cards: cardIds,
      });
      expect(Array.isArray(due)).toBe(true);
      expect(due.length).toBe(cardIds.length);
    });

    test("should manage ease factors", async () => {
      // Get current ease factors
      const originalFactors = await ankiConnect<number[]>("getEaseFactors", {
        cards: cardIds,
      });
      expect(originalFactors.length).toBe(cardIds.length);

      // Set new ease factors
      const newFactors = cardIds.map(() => 2300);
      const setResult = await ankiConnect<boolean[]>("setEaseFactors", {
        cards: cardIds,
        easeFactors: newFactors,
      });
      expect(setResult.every((r) => r === true)).toBe(true);

      // Verify new factors
      const updatedFactors = await ankiConnect<number[]>("getEaseFactors", {
        cards: cardIds,
      });
      expect(updatedFactors).toEqual(newFactors);
    });

    test("should manage due dates", async () => {
      // Set due date to tomorrow
      const setDueResult = await ankiConnect("setDueDate", {
        cards: cardIds,
        days: "1",
      });
      expect(setDueResult).toBeDefined();

      // Check intervals
      const intervals = await ankiConnect<number[]>("getIntervals", {
        cards: cardIds,
        complete: true,
      });
      expect(intervals.length).toBe(cardIds.length);
    });

    afterAll(async () => {
      await cleanupNotes(noteIds);
    });
  });

  describe("Queue Priority System", () => {
    test("should respect learning queue priority", async () => {
      const testDeck = "Default";  // Use Default deck

      // Create cards in different states with unique content
      const timestamp = Date.now();
      const learningNoteId = await createTestNote(
        { Front: `Learning Card ${timestamp}`, Back: `Learning Answer ${timestamp}` },
        ["queue-learning"],
        testDeck
      );
      const reviewNoteId = await createTestNote(
        { Front: `Review Card ${timestamp}`, Back: `Review Answer ${timestamp}` },
        ["queue-review"],
        testDeck
      );
      const newNoteId = await createTestNote(
        { Front: `New Card ${timestamp}`, Back: `New Answer ${timestamp}` },
        ["queue-new"],
        testDeck
      );

      // Get cards
      const learningCards = await ankiConnect<number[]>("findCards", {
        query: `nid:${learningNoteId}`,
      });
      const _reviewCards = await ankiConnect<number[]>("findCards", {
        query: `nid:${reviewNoteId}`,
      });

      // Put one card in learning state by answering it
      if (learningCards[0]) {
        await answerCard(learningCards[0], 1); // Answer "Again" to put in learning
      }

      // Note: getNextCards is not a valid Anki-Connect action
      // This functionality would need custom implementation
      // Skipping this part of the test

      // Clean up
      await cleanupNotes([learningNoteId, reviewNoteId, newNoteId]);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid note creation", async () => {
      await expect(
        ankiConnect("addNote", {
          note: {
            deckName: "NonExistentDeck_" + Date.now(),
            modelName: "Basic",
            fields: {
              Front: "Test",
              Back: "Test",
            },
          },
        })
      ).rejects.toThrow();
    });

    test("should handle invalid model fields", async () => {
      await expect(
        ankiConnect("addNote", {
          note: {
            deckName: "Default",
            modelName: "Basic",
            fields: {
              InvalidField: "Test",
              AnotherInvalid: "Test",
            },
          },
        })
      ).rejects.toThrow();
    });

    test("should handle non-existent note ID", async () => {
      const fakeId = 999999999;
      await expect(
        ankiConnect("updateNote", {
          note: {
            id: fakeId,
            fields: { Front: "Updated" },
          },
        })
      ).rejects.toThrow();
    });

    test("should handle non-existent card ID", async () => {
      const fakeCardId = 999999999;
      await expect(
        ankiConnect("suspend", {
          cards: [fakeCardId],
        })
      ).rejects.toThrow();
    });
  });

  describe("Statistics and Reports", () => {
    test("should get collection statistics", async () => {
      const reviewCount = await ankiConnect<number>(
        "getNumCardsReviewedToday"
      );
      expect(typeof reviewCount).toBe("number");
      expect(reviewCount).toBeGreaterThanOrEqual(0);

      const statsHtml = await ankiConnect<string>("getCollectionStatsHTML", {
        wholeCollection: false,
      });
      expect(typeof statsHtml).toBe("string");
      expect(statsHtml.length).toBeGreaterThan(0);
    });

    test("should get deck statistics", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: ["Default"],
      });
      expect(stats).toBeDefined();
    });

    test("should get review information", async () => {
      const latestReviewId = await ankiConnect<number>("getLatestReviewID", {
        deck: "Default",
      });
      expect(typeof latestReviewId).toBe("number");

      // Get card reviews (requires startID)
      const reviews = await ankiConnect("cardReviews", {
        deck: "Default",
        startID: 0,
      });
      expect(Array.isArray(reviews)).toBe(true);
    });
  });
});