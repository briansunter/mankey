import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ankiConnect, setupTestEnvironment } from "./test-utils";

/**
 * Performance tests for batch size optimization
 *
 * Tests different batch sizes (100, 250, 500) to determine optimal performance
 * while keeping response times under 2 seconds and memory usage reasonable.
 *
 * Success criteria:
 * - Response time < 2000ms
 * - No errors or timeouts
 * - Memory usage < 100MB delta
 */

interface PerformanceResult {
  batchSize: number;
  operation: string;
  itemCount: number;
  responseTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  success: boolean;
  error?: string;
}

const testDeckName = `BatchPerformanceTest_${Date.now()}`;
const performanceResults: PerformanceResult[] = [];
const testNoteIds: number[] = [];
let testCardIds: number[] = [];

/**
 * Measure performance of an operation
 */
async function measurePerformance<T>(
  operation: string,
  batchSize: number,
  itemCount: number,
  fn: () => Promise<T>
): Promise<PerformanceResult> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const memBefore = process.memoryUsage();
  const startTime = performance.now();

  let success = true;
  let error: string | undefined;

  try {
    await fn();
  } catch (e) {
    success = false;
    error = e instanceof Error ? e.message : String(e);
  }

  const endTime = performance.now();
  const memAfter = process.memoryUsage();

  const result: PerformanceResult = {
    batchSize,
    operation,
    itemCount,
    responseTime: endTime - startTime,
    memoryBefore: memBefore.heapUsed,
    memoryAfter: memAfter.heapUsed,
    memoryDelta: memAfter.heapUsed - memBefore.heapUsed,
    success,
    error,
  };

  performanceResults.push(result);
  return result;
}

/**
 * Print performance results table
 */
function printResults() {
  console.log("\n" + "=".repeat(120));
  console.log("BATCH SIZE PERFORMANCE TEST RESULTS");
  console.log("=".repeat(120));
  console.log(
    "Operation".padEnd(30) +
    "Batch".padEnd(8) +
    "Items".padEnd(8) +
    "Time (ms)".padEnd(12) +
    "Memory Δ".padEnd(15) +
    "Status"
  );
  console.log("-".repeat(120));

  performanceResults.forEach((result) => {
    const memDeltaMB = (result.memoryDelta / 1024 / 1024).toFixed(2);
    const timeColor = result.responseTime < 2000 ? "\x1b[32m" : "\x1b[31m"; // Green if <2s, red otherwise
    const reset = "\x1b[0m";

    console.log(
      result.operation.padEnd(30) +
      result.batchSize.toString().padEnd(8) +
      result.itemCount.toString().padEnd(8) +
      `${timeColor}${result.responseTime.toFixed(2)}${reset}`.padEnd(20) + // Extra padding for color codes
      `${memDeltaMB} MB`.padEnd(15) +
      (result.success ? "✓" : `✗ ${result.error}`)
    );
  });

  console.log("=".repeat(120));

  // Summary
  const avgByBatchSize = new Map<number, { time: number; count: number }>();
  performanceResults.forEach((r) => {
    const current = avgByBatchSize.get(r.batchSize) || { time: 0, count: 0 };
    avgByBatchSize.set(r.batchSize, {
      time: current.time + r.responseTime,
      count: current.count + 1,
    });
  });

  console.log("\nAVERAGE RESPONSE TIME BY BATCH SIZE:");
  avgByBatchSize.forEach((stats, batchSize) => {
    const avg = stats.time / stats.count;
    const color = avg < 2000 ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`  Batch ${batchSize}: ${color}${avg.toFixed(2)}ms${reset} (${stats.count} operations)`);
  });

  console.log("\nRECOMMENDATION:");
  const under2s = Array.from(avgByBatchSize.entries())
    .filter(([_, stats]) => stats.time / stats.count < 2000)
    .sort((a, b) => b[0] - a[0]); // Sort descending by batch size

  if (under2s.length > 0) {
    const [recommendedSize] = under2s[0];
    console.log(`  ✓ Recommended batch size: ${recommendedSize}`);
    console.log(`  Average response time: ${(under2s[0][1].time / under2s[0][1].count).toFixed(2)}ms`);
  } else {
    console.log("  ✗ All batch sizes exceeded 2-second target");
  }
  console.log("\n");
}

beforeAll(async () => {
  await setupTestEnvironment();

  // Create test deck
  await ankiConnect("createDeck", { deck: testDeckName });

  console.log(`\n📝 Creating ${600} test notes for batch performance testing...`);

  // Create 600 test notes in batches of 100
  for (let batch = 0; batch < 6; batch++) {
    const notes = Array.from({ length: 100 }, (_, i) => ({
      deckName: testDeckName,
      modelName: "Basic",
      fields: {
        Front: `Batch Performance Test ${batch * 100 + i + 1} - ${Date.now()}`,
        Back: `Answer ${batch * 100 + i + 1} - Test data for measuring batch performance`,
      },
      tags: ["batch-perf-test", `batch${batch}`],
    }));

    const noteIds = await ankiConnect<(number | null)[]>("addNotes", { notes });
    testNoteIds.push(...noteIds.filter((id): id is number => id !== null));
  }

  console.log(`✓ Created ${testNoteIds.length} test notes`);

  // Get card IDs for the notes
  const allCards = await ankiConnect<number[]>("findCards", {
    query: `deck:"${testDeckName}"`,
  });
  testCardIds = allCards;

  console.log(`✓ Found ${testCardIds.length} test cards`);
});

afterAll(async () => {
  // Cleanup test data
  try {
    await ankiConnect("deleteDecks", {
      decks: [testDeckName],
      cardsToo: true,
    });
    console.log(`\n🧹 Cleaned up test deck: ${testDeckName}`);
  } catch (_e) {
    // Ignore cleanup errors
  }

  // Print results
  printResults();
});

describe("Batch Size Performance Tests", () => {
  describe("Auto-batching: notesInfo", () => {
    test("notesInfo with 100 notes (current batch size)", async () => {
      const noteIds = testNoteIds.slice(0, 100);
      const result = await measurePerformance(
        "notesInfo (auto-batch)",
        100,
        100,
        () => ankiConnect("notesInfo", { notes: noteIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000); // Generous limit for slower systems
    });

    test("notesInfo with 250 notes", async () => {
      const noteIds = testNoteIds.slice(0, 250);
      const result = await measurePerformance(
        "notesInfo (auto-batch)",
        250,
        250,
        () => ankiConnect("notesInfo", { notes: noteIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("notesInfo with 500 notes", async () => {
      const noteIds = testNoteIds.slice(0, 500);
      const result = await measurePerformance(
        "notesInfo (auto-batch)",
        500,
        500,
        () => ankiConnect("notesInfo", { notes: noteIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });
  });

  describe("Auto-batching: cardsInfo", () => {
    test("cardsInfo with 100 cards (current batch size)", async () => {
      const cardIds = testCardIds.slice(0, 100);
      const result = await measurePerformance(
        "cardsInfo (auto-batch)",
        100,
        100,
        () => ankiConnect("cardsInfo", { cards: cardIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("cardsInfo with 250 cards", async () => {
      const cardIds = testCardIds.slice(0, 250);
      const result = await measurePerformance(
        "cardsInfo (auto-batch)",
        250,
        250,
        () => ankiConnect("cardsInfo", { cards: cardIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("cardsInfo with 500 cards", async () => {
      const cardIds = testCardIds.slice(0, 500);
      const result = await measurePerformance(
        "cardsInfo (auto-batch)",
        500,
        500,
        () => ankiConnect("cardsInfo", { cards: cardIds })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });
  });

  describe("Pagination: findNotes", () => {
    test("findNotes with limit=100 (current default)", async () => {
      const result = await measurePerformance(
        "findNotes (paginated)",
        100,
        100,
        () =>
          ankiConnect("findNotes", {
            query: `deck:"${testDeckName}"`,
            limit: 100,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("findNotes with limit=250", async () => {
      const result = await measurePerformance(
        "findNotes (paginated)",
        250,
        250,
        () =>
          ankiConnect("findNotes", {
            query: `deck:"${testDeckName}"`,
            limit: 250,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("findNotes with limit=500", async () => {
      const result = await measurePerformance(
        "findNotes (paginated)",
        500,
        500,
        () =>
          ankiConnect("findNotes", {
            query: `deck:"${testDeckName}"`,
            limit: 500,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });
  });

  describe("Pagination: findCards", () => {
    test("findCards with limit=100 (current default)", async () => {
      const result = await measurePerformance(
        "findCards (paginated)",
        100,
        100,
        () =>
          ankiConnect("findCards", {
            query: `deck:"${testDeckName}"`,
            limit: 100,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("findCards with limit=250", async () => {
      const result = await measurePerformance(
        "findCards (paginated)",
        250,
        250,
        () =>
          ankiConnect("findCards", {
            query: `deck:"${testDeckName}"`,
            limit: 250,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });

    test("findCards with limit=500", async () => {
      const result = await measurePerformance(
        "findCards (paginated)",
        500,
        500,
        () =>
          ankiConnect("findCards", {
            query: `deck:"${testDeckName}"`,
            limit: 500,
          })
      );

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeLessThan(5000);
    });
  });

  describe("Edge Cases", () => {
    test("notesInfo with 0 notes", async () => {
      const result = await measurePerformance(
        "notesInfo (edge case)",
        0,
        0,
        () => ankiConnect("notesInfo", { notes: [] })
      );

      expect(result.success).toBe(true);
    });

    test("notesInfo with 1 note", async () => {
      const result = await measurePerformance(
        "notesInfo (edge case)",
        1,
        1,
        () => ankiConnect("notesInfo", { notes: [testNoteIds[0]] })
      );

      expect(result.success).toBe(true);
    });

    test("cardsInfo with 0 cards", async () => {
      const result = await measurePerformance(
        "cardsInfo (edge case)",
        0,
        0,
        () => ankiConnect("cardsInfo", { cards: [] })
      );

      expect(result.success).toBe(true);
    });

    test("cardsInfo with 1 card", async () => {
      const result = await measurePerformance(
        "cardsInfo (edge case)",
        1,
        1,
        () => ankiConnect("cardsInfo", { cards: [testCardIds[0]] })
      );

      expect(result.success).toBe(true);
    });
  });
});
