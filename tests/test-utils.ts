import { expect } from "bun:test";

const ANKI_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_API_KEY = process.env.ANKI_API_KEY;

export interface AnkiResponse<T = any> {
  result: T;
  error?: string | null;
}

/**
 * Helper to call Anki-Connect API directly
 */
export async function ankiConnect<T = any>(
  action: string,
  params: any = {}
): Promise<T> {
  const response = await fetch(ANKI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      version: 6,
      params,
      ...(ANKI_API_KEY && { key: ANKI_API_KEY }),
    }),
  });

  const result = (await response.json()) as AnkiResponse<T>;
  if (result.error) {
    throw new Error(`AnkiConnect error: ${result.error}`);
  }
  return result.result;
}

/**
 * Create a test note and return its ID
 */
export async function createTestNote(
  fields: { Front: string; Back: string } = {
    Front: "Test Front " + Date.now() + Math.random(),
    Back: "Test Back " + Date.now() + Math.random(),
  },
  tags: string[] = ["test"],
  deck: string = "Default"
): Promise<number> {
  return ankiConnect("addNote", {
    note: {
      deckName: deck,
      modelName: "Basic",
      fields,
      tags,
    },
  });
}

/**
 * Clean up test notes by IDs
 */
export async function cleanupNotes(noteIds: number[]): Promise<void> {
  if (noteIds.length === 0) return;
  await ankiConnect("deleteNotes", { notes: noteIds });
}

/**
 * Create test deck and return its ID
 * WARNING: This causes full sync requirement - avoid in tests
 * @deprecated Use existing Default deck instead
 */
export async function createTestDeck(name: string): Promise<number> {
  // Avoid creating new decks - use Default instead
  console.warn("WARNING: Creating decks requires full sync. Use Default deck instead.");
  return ankiConnect("createDeck", { deck: name });
}

/**
 * Clean up test deck
 * WARNING: This causes full sync requirement - avoid in tests
 * @deprecated Clean up notes instead of deleting decks
 */
export async function cleanupDeck(name: string): Promise<void> {
  // Avoid deleting decks - just clean up notes instead
  console.warn("WARNING: Deleting decks requires full sync. Clean up notes instead.");
  await ankiConnect("deleteDecks", {
    decks: [name],
    cardsToo: true,
  });
}

/**
 * Verify Anki is running and connected
 */
export async function verifyAnkiConnection(): Promise<void> {
  const version = await ankiConnect<number>("version");
  if (version < 6) {
    throw new Error(`Anki-Connect version ${version} is too old, need version 6+`);
  }
}

/**
 * Normalize tags for comparison
 */
export function normalizeTags(tags: any): string[] {
  if (Array.isArray(tags)) {
    return tags;
  }
  if (typeof tags === "string") {
    if (tags.startsWith("[") && tags.endsWith("]")) {
      try {
        const parsed = JSON.parse(tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Fall back to space-separated
      }
    }
    return tags.split(" ").filter((t) => t.trim());
  }
  return [];
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await Bun.sleep(interval);
  }
  throw new Error("Timeout waiting for condition");
}

/**
 * Get all cards for testing
 */
export async function getAllCards(): Promise<number[]> {
  return ankiConnect("findCards", { query: "*" });
}

/**
 * Get deck stats
 */
export async function getDeckStats(deck: string = "Default"): Promise<any> {
  return ankiConnect("getDeckStats", { decks: [deck] });
}

/**
 * Answer a card
 */
export async function answerCard(
  card: number,
  ease: number = 3
): Promise<boolean> {
  return ankiConnect("answerCards", {
    answers: [{ cardId: card, ease }],
  });
}

/**
 * Get next card for review
 */
export async function getNextCard(): Promise<any> {
  const cards = await ankiConnect("getNextCards", {
    limit: 1,
    offset: 0,
  });
  return cards?.[0];
}

/**
 * Create a Basic model if it doesn't exist
 * WARNING: This causes full sync requirement - avoid in tests
 * @deprecated Assume Basic model exists
 */
export async function ensureBasicModel(): Promise<void> {
  const models = await ankiConnect<string[]>("modelNames");
  if (!models.includes("Basic")) {
    console.warn("WARNING: Creating models requires full sync. Assuming Basic model exists.");
    // Don't create models in tests - assume they exist
    // await ankiConnect("createModel", { ... });
  }
}

/**
 * Setup test environment
 */
export async function setupTestEnvironment(): Promise<void> {
  await verifyAnkiConnection();
  // Don't create models or decks - use existing ones
  // await ensureBasicModel();
  
  // Verify Default deck exists (it should always exist)
  const decks = await ankiConnect<string[]>("deckNames");
  if (!decks.includes("Default")) {
    throw new Error("Default deck not found. Please create it manually in Anki.");
  }
  
  // Verify Basic model exists (it should always exist)
  const models = await ankiConnect<string[]>("modelNames");
  if (!models.includes("Basic")) {
    throw new Error("Basic model not found. Please create it manually in Anki.");
  }
}

/**
 * Batch create test notes
 */
export async function createTestNotes(
  count: number,
  prefix = "Test"
): Promise<number[]> {
  const notes = Array.from({ length: count }, (_, i) => ({
    deckName: "Default",
    modelName: "Basic",
    fields: {
      Front: `${prefix} Front ${i + 1}`,
      Back: `${prefix} Back ${i + 1}`,
    },
    tags: ["test", `batch${i + 1}`],
  }));

  return ankiConnect("addNotes", { notes });
}

/**
 * Get cards by deck
 */
export async function getCardsByDeck(deck: string): Promise<number[]> {
  return ankiConnect("findCards", { query: `deck:"${deck}"` });
}

/**
 * Suspend cards
 */
export async function suspendCards(cardIds: number[]): Promise<boolean> {
  return ankiConnect("suspend", { cards: cardIds });
}

/**
 * Unsuspend cards
 */
export async function unsuspendCards(cardIds: number[]): Promise<boolean> {
  return ankiConnect("unsuspend", { cards: cardIds });
}