import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNotes,
  cleanupNotes,
  setupTestEnvironment,
} from "./test-utils";
import type { PaginatedResponse } from "./test-utils";

// Define interfaces for typed responses
interface CardInfo {
  cardId: number;
  noteId: number;
  deckName: string;
  fields: Record<string, string>;
}

interface DueCardsResponse {
  cards: CardInfo[];
  total: number;
  hasMore: boolean;
}

describe("Pagination Tests", () => {
  let testNoteIds: number[] = [];
  const TOTAL_NOTES = 25;

  beforeAll(async () => {
    await setupTestEnvironment();
    
    // Create test notes for pagination
    testNoteIds = await createTestNotes(TOTAL_NOTES, "Pagination");
  });

  describe("findCards Pagination", () => {
    test("should paginate card results with offset and limit", async () => {
      const limit = 10;
      
      // First page
      const page1 = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: 0,
        limit,
      });
      expect(page1.cards).toBeDefined();
      expect(page1.cards!.length).toBeLessThanOrEqual(limit);
      expect(page1.hasMore).toBe(true);
      expect(page1.total).toBeGreaterThanOrEqual(TOTAL_NOTES);
      
      // Second page
      const page2 = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: limit,
        limit,
      });
      expect(page2.cards).toBeDefined();
      expect(page2.cards!.length).toBeLessThanOrEqual(limit);
      
      // Verify no overlap between pages
      const page1Ids = new Set(page1.cards as number[]);
      const page2Ids = new Set(page2.cards as number[]);
      const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
      expect(intersection).toHaveLength(0);
    });

    test("should handle last page correctly", async () => {
      const limit = 10;
      const lastPageOffset = Math.floor(TOTAL_NOTES / limit) * limit;
      
      const lastPage = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test tag:batch" + TOTAL_NOTES,
        offset: lastPageOffset,
        limit,
      });
      
      expect(lastPage.cards).toBeDefined();
      expect(lastPage.hasMore).toBe(false);
    });

    test("should return empty results for offset beyond total", async () => {
      const result = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: 10000,
        limit: 10,
      });
      
      expect(result.cards!).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    test("should handle limit of 1", async () => {
      const result = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: 0,
        limit: 1,
      });
      
      expect(result.cards!).toHaveLength(1);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("findNotes Pagination", () => {
    test("should paginate note results with offset and limit", async () => {
      const limit = 7;
      
      // First page
      const page1 = await ankiConnect<PaginatedResponse>("findNotes", {
        query: "tag:test",
        offset: 0,
        limit,
      });
      expect(page1.notes).toBeDefined();
      expect(page1.notes!.length).toBeLessThanOrEqual(limit);
      expect(page1.hasMore).toBe(true);
      expect(page1.total).toBeGreaterThanOrEqual(TOTAL_NOTES);
      expect(page1.nextOffset).toBe(limit);
      
      // Second page using nextOffset
      const page2 = await ankiConnect<PaginatedResponse>("findNotes", {
        query: "tag:test",
        offset: page1.nextOffset,
        limit,
      });
      expect(page2.notes).toBeDefined();
      expect(page2.notes!.length).toBeLessThanOrEqual(limit);
      
      // Verify no overlap
      const page1Ids = new Set(page1.notes as number[]);
      const page2Ids = new Set(page2.notes as number[]);
      const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
      expect(intersection).toHaveLength(0);
    });

    test("should provide accurate total count", async () => {
      const result = await ankiConnect<PaginatedResponse>("findNotes", {
        query: "tag:test",
        offset: 0,
        limit: 5,
      });
      
      // Should at least have our test notes
      expect(result.total).toBeGreaterThanOrEqual(TOTAL_NOTES);
    });

    test("should handle different page sizes", async () => {
      const pageSizes = [3, 5, 10, 15];
      
      for (const size of pageSizes) {
        const result = await ankiConnect<PaginatedResponse>("findNotes", {
          query: "tag:test",
          offset: 0,
          limit: size,
        });
        
        expect(result.notes!.length).toBeLessThanOrEqual(size);
        expect(result.total).toBeGreaterThanOrEqual(TOTAL_NOTES);
      }
    });
  });

  describe.skip("getNextCards Pagination", () => {
    test("should paginate next cards for review", async () => {
      const limit = 5;
      
      const page1 = await ankiConnect<CardInfo[]>("getNextCards", {
        limit,
        offset: 0,
      });
      
      if (page1 && page1.length > 0) {
        expect(page1.length).toBeLessThanOrEqual(limit);
        
        const page2 = await ankiConnect<CardInfo[]>("getNextCards", {
          limit,
          offset: limit,
        });
        
        // Verify different cards if available
        if (page2 && page2.length > 0) {
          const page1Ids = new Set(page1.map((c) => c.cardId));
          const page2Ids = new Set(page2.map((c) => c.cardId));
          const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
          expect(intersection).toHaveLength(0);
        }
      }
    });
  });

  describe.skip("getDueCardsDetailed Pagination", () => {
    test("should paginate due cards with details", async () => {
      const limit = 10;
      
      const result = await ankiConnect<DueCardsResponse>("getDueCardsDetailed", {
        limit,
        offset: 0,
      });
      
      if (result && result.cards) {
        expect(result.cards.length).toBeLessThanOrEqual(limit);
        expect(result).toHaveProperty("total");
        expect(result).toHaveProperty("hasMore");
        
        if (result.cards.length > 0) {
          const card = result.cards[0];
          expect(card).toHaveProperty("cardId");
          expect(card).toHaveProperty("noteId");
          expect(card).toHaveProperty("deckName");
          expect(card).toHaveProperty("fields");
        }
      }
    });
  });

  describe("Edge Cases", () => {
    test("should handle zero limit gracefully", async () => {
      const result = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: 0,
        limit: 0,
      });
      
      expect(result.cards!).toHaveLength(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test("should handle negative offset as zero", async () => {
      const result = await ankiConnect<PaginatedResponse>("findNotes", {
        query: "tag:test",
        offset: -10,
        limit: 5,
      });
      
      expect(result.notes).toBeDefined();
      expect(result.notes!.length).toBeGreaterThan(0);
    });

    test("should handle very large limit", async () => {
      const result = await ankiConnect<PaginatedResponse>("findCards", {
        query: "tag:test",
        offset: 0,
        limit: 100000,
      });
      
      expect(result.cards).toBeDefined();
      expect(result.hasMore).toBe(false);
      expect(result.cards!.length).toBeGreaterThanOrEqual(TOTAL_NOTES);
    });

    test("should maintain consistency across paginated requests", async () => {
      const pageSize = 5;
      const allCards: number[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const page = await ankiConnect<PaginatedResponse>("findCards", {
          query: "tag:test tag:Pagination",
          offset,
          limit: pageSize,
        });
        
        allCards.push(...(page.cards as number[]));
        hasMore = page.hasMore;
        offset += pageSize;
        
        if (offset > 100) {break;} // Safety limit
      }
      
      // Check for duplicates
      const uniqueCards = new Set(allCards);
      expect(uniqueCards.size).toBe(allCards.length);
    });
  });

  describe("Performance", () => {
    test("should handle pagination efficiently for large datasets", async () => {
      const start = performance.now();
      
      const result = await ankiConnect<PaginatedResponse>("findCards", {
        query: "*",
        offset: 0,
        limit: 100,
      });
      
      const elapsed = performance.now() - start;
      
      expect(result.cards).toBeDefined();
      expect(elapsed).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test("should provide total count without fetching all results", async () => {
      const result = await ankiConnect<PaginatedResponse>("findNotes", {
        query: "tag:test",
        offset: 0,
        limit: 1,
      });
      
      expect(result.total).toBeGreaterThanOrEqual(TOTAL_NOTES);
      expect(result.notes!).toHaveLength(1);
    });
  });

  afterAll(async () => {
    await cleanupNotes(testNoteIds);
  });
});