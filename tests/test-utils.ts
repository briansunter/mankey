
const ANKI_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";
const ANKI_API_KEY = process.env.ANKI_API_KEY;

export interface AnkiResponse<T = unknown> {
  result: T;
  error?: string | null;
}

export interface PaginatedResponse {
  cards?: unknown[];
  notes?: unknown[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit?: number;
  nextOffset: number;
}

/**
 * Helper to call Anki-Connect API directly
 */
export async function ankiConnect<T = unknown>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  // Handle client-side pagination for findCards and findNotes
  if ((action === "findCards" || action === "findNotes") && 
      (params.offset !== undefined || params.limit !== undefined)) {
    const offset = typeof params.offset === 'number' ? params.offset : 0;
    const limit = typeof params.limit === 'number' ? params.limit : undefined;
    
    // Remove pagination params before sending to Anki-Connect
    const cleanParams = { ...params };
    delete cleanParams.offset;
    delete cleanParams.limit;
    
    // Fetch all results
    const response = await fetch(ANKI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        version: 6,
        params: cleanParams,
        ...(ANKI_API_KEY && { key: ANKI_API_KEY }),
      }),
    });
    
    const result = (await response.json()) as AnkiResponse<T>;
    if (result.error) {
      throw new Error(`AnkiConnect error: ${result.error}`);
    }
    
    // Apply pagination to results
    const allResults = result.result as unknown[];
    const paginatedResults = limit !== undefined 
      ? allResults.slice(offset, offset + limit)
      : allResults.slice(offset);
    
    // Return paginated response with metadata
    const responseKey = action === "findCards" ? "cards" : "notes";
    const paginatedResponse: PaginatedResponse = {
      total: allResults.length,
      hasMore: limit !== undefined ? offset + limit < allResults.length : false,
      offset,
      limit,
      nextOffset: limit !== undefined ? offset + limit : offset + allResults.length
    };
    
    if (responseKey === "cards") {
      paginatedResponse.cards = paginatedResults;
    } else {
      paginatedResponse.notes = paginatedResults;
    }
    
    return paginatedResponse as T;
  }
  
  // Standard API call without pagination
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
  if (noteIds.length === 0) {return;}
  await ankiConnect("deleteNotes", { notes: noteIds });
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
export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags;
  }
  if (typeof tags === "string") {
    if (tags.startsWith("[") && tags.endsWith("]")) {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          // Flatten nested arrays and convert to strings
          return parsed.flat().map(item => String(item));
        }
        return [];
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
export async function getDeckStats(deck: string = "Default"): Promise<Record<string, unknown>> {
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
export async function getNextCard(): Promise<{ cardId: number; note: number; deckName: string; queue: number } | undefined> {
  try {
    const cards = await ankiConnect<number[]>("findCards", {
      query: "is:due",
    });
    if (cards && cards.length > 0) {
      const info = await ankiConnect<Array<{ cardId: number; note: number; deckName: string; queue: number }>>("cardsInfo", {
        cards: [cards[0]],
      });
      return info?.[0];
    }
    return undefined;
  } catch {
    return undefined;
  }
}


/**
 * Setup test environment
 */
export async function setupTestEnvironment(): Promise<void> {
  await verifyAnkiConnection();
  
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
  const timestamp = Date.now();
  const notes = Array.from({ length: count }, (_, i) => ({
    deckName: "Default",
    modelName: "Basic",
    fields: {
      Front: `${prefix} Front ${i + 1} - ${timestamp}`,
      Back: `${prefix} Back ${i + 1} - ${timestamp}`,
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
export async function unsuspendCards(cardIds: number[]): Promise<boolean | null> {
  return ankiConnect("unsuspend", { cards: cardIds });
}