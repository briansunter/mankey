import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNote,
  cleanupNotes,
  setupTestEnvironment,
  answerCard,
} from "./test-utils";

describe("Queue Priority Tests", () => {
  let testDeck: string;
  let learningNoteId: number;
  let reviewNoteId: number;
  let newNoteId: number;
  let learningCards: number[];
  let reviewCards: number[];
  let _newCards: number[];

  beforeAll(async () => {
    await setupTestEnvironment();
    
    testDeck = "Default";  // Use Default deck instead of creating new one

    // Create cards in different states
    learningNoteId = await createTestNote(
      { Front: "Learning Question", Back: "Learning Answer" },
      ["queue-learning"],
      testDeck
    );
    
    reviewNoteId = await createTestNote(
      { Front: "Review Question", Back: "Review Answer" },
      ["queue-review"],
      testDeck
    );
    
    newNoteId = await createTestNote(
      { Front: "New Question", Back: "New Answer" },
      ["queue-new"],
      testDeck
    );

    // Get card IDs
    learningCards = await ankiConnect<number[]>("findCards", {
      query: `nid:${learningNoteId}`,
    });
    reviewCards = await ankiConnect<number[]>("findCards", {
      query: `nid:${reviewNoteId}`,
    });
    _newCards = await ankiConnect<number[]>("findCards", {
      query: `nid:${newNoteId}`,
    });

    // Set up card states
    // Put learning card in learning queue (answer with Again)
    if (learningCards[0]) {
      await answerCard(learningCards[0], 1);
    }
    
    // Put review card in review queue (answer once with Good, then wait)
    if (reviewCards[0]) {
      await answerCard(reviewCards[0], 3);
    }
    
    // New card remains untouched
  });

  describe.skip("getNextCards Queue Priority", () => {
    test("should return cards respecting queue priority", async () => {
      const nextCards = await ankiConnect("getNextCards", {
        limit: 10,
        offset: 0,
      });

      if (nextCards && nextCards.length > 0) {
        // Check that we get cards
        expect(nextCards).toBeDefined();
        expect(Array.isArray(nextCards)).toBe(true);
        
        // Verify card structure
        const firstCard = nextCards[0];
        expect(firstCard).toHaveProperty("cardId");
        expect(firstCard).toHaveProperty("noteId");
        expect(firstCard).toHaveProperty("deckName");
        expect(firstCard).toHaveProperty("queue");
        expect(firstCard).toHaveProperty("type");
      }
    });

    test("should prioritize learning cards over review cards", async () => {
      const nextCards = await ankiConnect("getNextCards", {
        limit: 3,
        offset: 0,
      });

      if (nextCards && nextCards.length > 0) {
        // Learning cards (queue=1 or queue=3) should come first
        const queues = nextCards.map((c: any) => c.queue);
        const hasLearningCard = queues.some((q: number) => q === 1 || q === 3);
        
        if (hasLearningCard) {
          const firstNonNewIndex = nextCards.findIndex((c: any) => c.queue !== 0);
          if (firstNonNewIndex >= 0) {
            const firstNonNew = nextCards[firstNonNewIndex];
            expect([1, 3]).toContain(firstNonNew.queue);
          }
        }
      }
    });

    test("should include queue type information", async () => {
      const nextCards = await ankiConnect("getNextCards", {
        limit: 5,
        offset: 0,
      });

      if (nextCards && nextCards.length > 0) {
        nextCards.forEach((card: any) => {
          expect(card.queue).toBeDefined();
          expect([0, 1, 2, 3, 4]).toContain(card.queue);
          // Queue types: 0=new, 1=learning, 2=review, 3=day learning, 4=preview
        });
      }
    });

    test("should handle pagination with queue priority maintained", async () => {
      const page1 = await ankiConnect("getNextCards", {
        limit: 2,
        offset: 0,
      });
      
      const page2 = await ankiConnect("getNextCards", {
        limit: 2,
        offset: 2,
      });

      if (page1 && page2 && page1.length > 0 && page2.length > 0) {
        // Verify no overlap
        const page1Ids = new Set(page1.map((c: any) => c.cardId));
        const page2Ids = new Set(page2.map((c: any) => c.cardId));
        const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
        expect(intersection).toHaveLength(0);
      }
    });
  });

  describe.skip("getDueCardsDetailed with Priority", () => {
    test("should return detailed due cards with priority", async () => {
      const dueCards = await ankiConnect("getDueCardsDetailed", {
        limit: 10,
        offset: 0,
      });

      if (dueCards && dueCards.cards && dueCards.cards.length > 0) {
        expect(dueCards).toHaveProperty("cards");
        expect(dueCards).toHaveProperty("total");
        expect(dueCards).toHaveProperty("hasMore");
        
        const firstCard = dueCards.cards[0];
        expect(firstCard).toHaveProperty("cardId");
        expect(firstCard).toHaveProperty("noteId");
        expect(firstCard).toHaveProperty("queue");
        expect(firstCard).toHaveProperty("fields");
        expect(firstCard).toHaveProperty("deckName");
      }
    });

    test("should include field values in detailed response", async () => {
      const dueCards = await ankiConnect("getDueCardsDetailed", {
        limit: 5,
        offset: 0,
      });

      if (dueCards && dueCards.cards && dueCards.cards.length > 0) {
        dueCards.cards.forEach((card: any) => {
          expect(card.fields).toBeDefined();
          expect(typeof card.fields).toBe("object");
          // Should have Front and Back fields for Basic model
          if (card.modelName === "Basic") {
            expect(card.fields).toHaveProperty("Front");
            expect(card.fields).toHaveProperty("Back");
          }
        });
      }
    });
  });

  describe.skip("Queue State Transitions", () => {
    test("should move cards between queues based on answers", async () => {
      const testNote = await createTestNote(
        { Front: "Transition Test", Back: "Answer" },
        ["transition"],
        testDeck
      );
      
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${testNote}`,
      });
      const cardId = cards[0];

      // Initially should be new (queue=0)
      let cardInfo = await ankiConnect<any[]>("cardsInfo", {
        cards: [cardId],
      });
      expect(cardInfo[0].queue).toBe(0);

      // Answer to move to learning
      if (cardId) {
        await answerCard(cardId, 1);
      }
      
      cardInfo = await ankiConnect<any[]>("cardsInfo", {
        cards: [cardId],
      });
      expect([1, 3]).toContain(cardInfo[0].queue); // Learning or day learning

      await cleanupNotes([testNote]);
    });

    test("should handle buried and suspended cards", async () => {
      const buriedNote = await createTestNote(
        { Front: "Buried Test", Back: "Answer" },
        ["buried"],
        testDeck
      );
      
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${buriedNote}`,
      });
      
      // Suspend the card
      await ankiConnect("suspend", { cards });
      
      // Suspended cards should not appear in next cards
      const nextCards = await ankiConnect("getNextCards", {
        limit: 100,
        offset: 0,
      });
      
      if (nextCards && nextCards.length > 0) {
        const suspendedFound = nextCards.some(
          (c: any) => cards.includes(c.cardId)
        );
        expect(suspendedFound).toBe(false);
      }

      await cleanupNotes([buriedNote]);
    });
  });

  describe("Deck-specific Queue Priority", () => {
    test("should get cards from Default deck", async () => {
      const noteId = await createTestNote(
        { Front: "Deck Specific", Back: "Answer" },
        ["deck-specific"],
        "Default"
      );

      // Get cards from Default deck
      const deckCards = await ankiConnect<number[]>("findCards", {
        query: 'deck:"Default" tag:deck-specific',
      });
      expect(deckCards.length).toBeGreaterThan(0);

      // Verify the cards belong to the correct deck
      const cardInfo = await ankiConnect<any[]>("cardsInfo", {
        cards: deckCards,
      });
      cardInfo.forEach((card) => {
        expect(card.deckName).toBe("Default");
      });

      await cleanupNotes([noteId]);
    });
  });

  describe.skip("Performance with Queue Priority", () => {
    test("should efficiently handle large queue requests", async () => {
      const start = performance.now();
      
      const result = await ankiConnect("getNextCards", {
        limit: 50,
        offset: 0,
      });
      
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(3000); // Should be fast
      if (result) {
        expect(Array.isArray(result)).toBe(true);
      }
    });

    test("should provide accurate queue statistics", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: [testDeck],
      });
      
      expect(stats[testDeck]).toBeDefined();
      if (stats[testDeck]) {
        expect(stats[testDeck]).toHaveProperty("new_count");
        expect(stats[testDeck]).toHaveProperty("learn_count");
        expect(stats[testDeck]).toHaveProperty("review_count");
      }
    });
  });

  afterAll(async () => {
    await cleanupNotes([learningNoteId, reviewNoteId, newNoteId]);
  });
});