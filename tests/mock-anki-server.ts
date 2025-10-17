#!/usr/bin/env bun

/**
 * Mock Anki-Connect server for CI/CD testing
 * Provides stub responses for all Anki-Connect API endpoints
 */

const PORT = 8765;
const MOCK_DATA = {
  deckNames: ["Default"],
  modelNames: ["Basic", "Basic (and reversed card)", "Cloze"],
  tags: ["test", "integration"],
  notes: new Map<number, { noteId: number; modelName: string; tags: string[]; fields: Record<string, { value: string; order: number }>; cards: number[] }>(),
  cards: new Map<number, { cardId: number; noteId: number; deckName: string; queue: number; interval: number; due: number; reps: number; factor: number }>(),
  nextNoteId: 1000,
  nextCardId: 2000,
};

interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
  key?: string;
}

interface AnkiConnectResponse {
  result: unknown;
  error: string | null;
}

function mockResponse(action: string, params?: Record<string, unknown>): unknown {
  switch (action) {
    case "version":
      return 6;

    case "requestPermission":
      return { permission: "granted", requireApikey: false, version: 6 };

    case "deckNames":
      return MOCK_DATA.deckNames;

    case "deckNamesAndIds":
      return { "Default": 1 };

    case "getDeckStats": {
      const decks = (params?.decks || ["Default"]) as string[];
      const stats: Record<string, unknown> = {};

      decks.forEach(deckName => {
        // Count cards by queue state for this deck
        const deckCards = Array.from(MOCK_DATA.cards.values())
          .filter(c => c.deckName === deckName);

        const new_count = deckCards.filter(c => c.queue === 0).length;
        const learn_count = deckCards.filter(c => c.queue === 1).length;
        const review_count = deckCards.filter(c => c.queue === 2).length;

        stats[deckName] = {
          new_count,
          learn_count,
          review_count,
          total_in_deck: deckCards.length
        };
      });

      return stats;
    }

    case "getDeckConfig":
      return {
        name: "Default",
        new: { perDay: 20 },
        rev: { perDay: 100 }
      };

    case "modelNames":
      return MOCK_DATA.modelNames;

    case "modelNamesAndIds":
      return {
        "Basic": 1234567890,
        "Basic (and reversed card)": 1234567891,
        "Cloze": 1234567892
      };

    case "modelFieldNames":
      if (params?.modelName === "Basic") {
        return ["Front", "Back"];
      }
      return ["Front", "Back"];

    case "modelStyling":
      return { css: ".card { font-family: arial; }" };

    case "modelTemplates":
      return {
        "Card 1": {
          Front: "{{Front}}",
          Back: "{{FrontSide}}<hr id=answer>{{Back}}"
        }
      };

    case "addNote": {
      const noteId = MOCK_DATA.nextNoteId++;
      const cardId = MOCK_DATA.nextCardId++;
      const note = params?.note as { deckName: string; modelName: string; fields: Record<string, string>; tags?: string[] };

      MOCK_DATA.notes.set(noteId, {
        noteId,
        modelName: note.modelName,
        tags: note.tags || [],
        fields: Object.entries(note.fields).reduce((acc, [key, value], order) => {
          acc[key] = { value, order };
          return acc;
        }, {} as Record<string, { value: string; order: number }>),
        cards: [cardId]
      });

      MOCK_DATA.cards.set(cardId, {
        cardId,
        noteId,
        deckName: note.deckName,
        queue: 0,
        interval: 0,
        due: 0,
        reps: 0,
        factor: 2500
      });

      return noteId;
    }

    case "addNotes": {
      const notes = (params?.notes || []) as Array<{ deckName: string; modelName: string; fields: Record<string, string>; tags?: string[] }>;
      return notes.map(note => {
        const noteId = MOCK_DATA.nextNoteId++;
        const cardId = MOCK_DATA.nextCardId++;

        MOCK_DATA.notes.set(noteId, {
          noteId,
          modelName: note.modelName,
          tags: note.tags || [],
          fields: Object.entries(note.fields).reduce((acc, [key, value], order) => {
            acc[key] = { value, order };
            return acc;
          }, {} as Record<string, { value: string; order: number }>),
          cards: [cardId]
        });

        MOCK_DATA.cards.set(cardId, {
          cardId,
          noteId,
          deckName: note.deckName,
          queue: 0,
          interval: 0,
          due: 0,
          reps: 0,
          factor: 2500
        });

        return noteId;
      });
    }

    case "findNotes": {
      const query = (params?.query || "") as string;
      const allNoteIds = Array.from(MOCK_DATA.notes.keys());

      // Simple query parsing
      if (query.includes("tag:")) {
        const tag = query.replace("tag:", "").trim();
        return allNoteIds.filter(id => {
          const note = MOCK_DATA.notes.get(id);
          return note?.tags.includes(tag);
        });
      }
      if (query.includes("nid:")) {
        const nid = parseInt(query.replace("nid:", "").trim());
        return MOCK_DATA.notes.has(nid) ? [nid] : [];
      }
      if (query === "*") {
        return allNoteIds;
      }
      return allNoteIds;
    }

    case "findCards": {
      const query = (params?.query || "") as string;
      const allCardIds = Array.from(MOCK_DATA.cards.keys());

      // Simple query parsing
      if (query.includes("tag:")) {
        const tag = query.replace("tag:", "").trim();
        return allCardIds.filter(id => {
          const card = MOCK_DATA.cards.get(id);
          if (!card) {
            return false;
          }
          const note = MOCK_DATA.notes.get(card.noteId);
          return note?.tags.includes(tag);
        });
      }
      if (query.includes("nid:")) {
        const nid = parseInt(query.replace("nid:", "").trim());
        return allCardIds.filter(id => {
          const card = MOCK_DATA.cards.get(id);
          return card?.noteId === nid;
        });
      }
      if (query.includes("is:due")) {
        return allCardIds.filter(id => {
          const card = MOCK_DATA.cards.get(id);
          return card && card.queue === 2;
        });
      }
      if (query === "*") {
        return allCardIds;
      }
      return allCardIds;
    }

    case "notesInfo": {
      const noteIds = (params?.notes || []) as number[];
      return noteIds.map(id => MOCK_DATA.notes.get(id) || null);
    }

    case "cardsInfo": {
      const cardIds = (params?.cards || []) as number[];
      return cardIds.map(id => {
        const card = MOCK_DATA.cards.get(id);
        if (!card) {
          return null;
        }
        const note = MOCK_DATA.notes.get(card.noteId);
        return {
          ...card,
          note: card.noteId,
          fields: note?.fields || {}
        };
      });
    }

    case "updateNote":
    case "updateNoteFields": {
      const noteData = params?.note as { id: number; fields?: Record<string, string>; tags?: string[] };
      const note = MOCK_DATA.notes.get(noteData.id);
      if (note && noteData.fields) {
        Object.entries(noteData.fields).forEach(([key, value]) => {
          if (note.fields[key]) {
            note.fields[key].value = value;
          }
        });
      }
      if (note && noteData.tags) {
        note.tags = noteData.tags;
      }
      return null;
    }

    case "addTags": {
      const noteIds = (params?.notes || []) as number[];
      const tags = (params?.tags || "") as string;
      const newTags = tags.split(" ").filter(t => t.trim());
      noteIds.forEach(id => {
        const note = MOCK_DATA.notes.get(id);
        if (note) {
          note.tags = [...new Set([...note.tags, ...newTags])];
        }
      });
      return null;
    }

    case "removeTags": {
      const noteIds = (params?.notes || []) as number[];
      const tags = (params?.tags || "") as string;
      const removeTags = tags.split(" ").filter(t => t.trim());
      noteIds.forEach(id => {
        const note = MOCK_DATA.notes.get(id);
        if (note) {
          note.tags = note.tags.filter(t => !removeTags.includes(t));
        }
      });
      return null;
    }

    case "deleteNotes": {
      const noteIds = (params?.notes || []) as number[];
      noteIds.forEach(id => {
        const note = MOCK_DATA.notes.get(id);
        if (note) {
          note.cards.forEach(cardId => MOCK_DATA.cards.delete(cardId));
          MOCK_DATA.notes.delete(id);
        }
      });
      return null;
    }

    case "suspend": {
      const cardIds = (params?.cards || []) as number[];
      cardIds.forEach(id => {
        const card = MOCK_DATA.cards.get(id);
        if (card) {
          card.queue = -1; // Suspended
        }
      });
      return true;
    }

    case "unsuspend": {
      const cardIds = (params?.cards || []) as number[];
      cardIds.forEach(id => {
        const card = MOCK_DATA.cards.get(id);
        if (card) {
          card.queue = 0; // Restore to new
        }
      });
      return null;
    }

    case "areSuspended": {
      const cardIds = (params?.cards || []) as number[];
      return cardIds.map(id => {
        const card = MOCK_DATA.cards.get(id);
        return card ? card.queue === -1 : false;
      });
    }

    case "areDue": {
      const cardIds = (params?.cards || []) as number[];
      return cardIds.map(() => false);
    }

    case "getIntervals": {
      const cardIds = (params?.cards || []) as number[];
      return cardIds.map(id => {
        const card = MOCK_DATA.cards.get(id);
        return card?.interval || 0;
      });
    }

    case "getEaseFactors": {
      const cardIds = (params?.cards || []) as number[];
      return cardIds.map(id => {
        const card = MOCK_DATA.cards.get(id);
        return card?.factor || 0;
      });
    }

    case "setEaseFactors": {
      const cardIds = (params?.cards || []) as number[];
      const easeFactors = (params?.easeFactors || []) as number[];
      cardIds.forEach((id, i) => {
        const card = MOCK_DATA.cards.get(id);
        if (card && easeFactors[i]) {
          card.factor = easeFactors[i];
        }
      });
      return cardIds.map(() => true);
    }

    case "forgetCards":
    case "relearnCards":
      return null;

    case "getTags":
      return MOCK_DATA.tags;

    case "getNoteTags": {
      const noteId = params?.note as number;
      const note = MOCK_DATA.notes.get(noteId);
      return note ? note.tags : [];
    }

    case "getMediaFilesNames":
      return [];

    case "getMediaDirPath":
      return "/tmp/mock-anki-media";

    case "storeMediaFile": {
      const filename = params?.filename as string;
      const data = params?.data as string;
      if (filename && data) {
        // Store the media data for later retrieval
        MOCK_DATA.notes.set(-1, {
          noteId: -1,
          modelName: "MediaStorage",
          tags: [filename],
          fields: { [filename]: { value: data, order: 0 } },
          cards: []
        });
      }
      return filename || "test.txt";
    }

    case "retrieveMediaFile": {
      const filename = params?.filename as string;
      // Try to retrieve stored media
      const mediaNote = MOCK_DATA.notes.get(-1);
      if (mediaNote && filename && mediaNote.fields[filename]) {
        return mediaNote.fields[filename].value;
      }
      // Fallback for basic test
      return "SGVsbG8gV29ybGQ="; // "Hello World" in base64
    }

    case "deleteMediaFile":
      return null;

    case "getNumCardsReviewedToday":
      return 0;

    case "getCollectionStatsHTML":
      return "<html><body>Mock Stats</body></html>";

    case "getLatestReviewID":
      return 12345;

    default:
      console.error(`Mock server: Unhandled action: ${action}`);
      return null;
  }
}

const _server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // CORS headers for browser compatibility
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await req.json() as AnkiConnectRequest;
      const { action, params } = body;

      console.error(`[Mock Anki-Connect] ${action}`, params ? JSON.stringify(params).substring(0, 100) : "");

      const result = mockResponse(action, params);
      const response: AnkiConnectResponse = {
        result,
        error: null
      };

      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    } catch (error) {
      console.error("[Mock Anki-Connect] Error:", error);
      const response: AnkiConnectResponse = {
        result: null,
        error: error instanceof Error ? error.message : "Unknown error"
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  }
});

console.log(`Mock Anki-Connect server running on http://127.0.0.1:${PORT}`);
console.log("Press Ctrl+C to stop");
