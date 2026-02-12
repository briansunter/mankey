import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const cardTools = {
  findCards: {
    description:
      "Search for cards using Anki's query syntax. Returns card IDs (not note IDs). Common queries: 'deck:DeckName' (cards in deck), 'is:due' (due for review today), 'is:new' (never studied), 'is:learn' (in learning phase), 'is:suspended' (suspended cards), 'prop:due<=0' (overdue), 'rated:1:1' (reviewed today, answered Hard). Note: 'is:due' excludes learning cards - use getNextCards for actual review order. IMPORTANT: Deck names with '::' hierarchy need quotes: 'deck:\"Parent::Child\"'. Returns paginated results",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'deck:current', 'deck:Default is:due', 'tag:japanese')"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum cards to return (default 100, max 1000)"),
    }),
    handler: async ({ query, offset = 0, limit = 100 }: { query: string; offset?: number; limit?: number }) => {
      try {
        const allCards = await ankiConnect("findCards", { query });
        const total = Array.isArray(allCards) ? allCards.length : 0;
        const effectiveLimit = Math.min(limit, 1000);
        const paginatedCards = Array.isArray(allCards) ? allCards.slice(offset, offset + effectiveLimit) : [];

        return {
          cards: paginatedCards,
          pagination: {
            offset,
            limit: effectiveLimit,
            total,
            hasMore: offset + effectiveLimit < total,
            nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
          },
        };
      } catch (_error) {
        // Return empty result set on error
        return {
          cards: [],
          pagination: {
            offset,
            limit: Math.min(limit, 1000),
            total: 0,
            hasMore: false,
            nextOffset: null,
          },
        };
      }
    },
  },

  getNextCards: {
    description:
      "Gets cards in the exact order they'll appear during review, following Anki's scheduling algorithm. Priority: 1) Cards in learning (red - failed or recently learned), 2) Review cards due today (green), 3) New cards up to daily limit (blue). Critical for simulating actual review session. Use deck:current for current deck or provide deck name. Includes suspended:false by default. Returns with scheduling metadata",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
      limit: z.number().describe("Maximum cards to return (default 10, max 100)").default(10),
      offset: z.number().describe("Starting position for pagination").default(0).optional(),
    }),
    handler: async ({ deck, limit, offset = 0 }: { deck?: string; limit: number; offset?: number }) => {
      // Build deck prefix for queries
      const deckPrefix = deck === "current" ? "deck:current" : deck ? `deck:"${deck}"` : "";

      // Get learning cards first (queue=1 or queue=3)
      const learningQuery = deckPrefix ? `${deckPrefix} (queue:1 OR queue:3)` : "(queue:1 OR queue:3)";
      const learningCards = await ankiConnect("findCards", { query: learningQuery });

      // Get review cards (queue=2 and due)
      const reviewQuery = deckPrefix ? `${deckPrefix} is:due` : "is:due";
      const reviewCards = await ankiConnect("findCards", { query: reviewQuery });

      // Get new cards if needed (queue=0)
      const newQuery = deckPrefix ? `${deckPrefix} is:new` : "is:new";
      const newCards = await ankiConnect("findCards", { query: newQuery });

      // Combine in priority order
      const allCards = [...learningCards, ...reviewCards, ...newCards];
      const total = allCards.length;
      const effectiveLimit = Math.min(limit, 100);
      const paginatedCards = allCards.slice(offset, offset + effectiveLimit);

      if (paginatedCards.length === 0) {
        return {
          cards: [],
          message: "No cards due for review",
          pagination: {
            offset,
            limit: effectiveLimit,
            total,
            hasMore: false,
          },
        };
      }

      // Get detailed info for these cards
      const cardInfo = await ankiConnect("cardsInfo", { cards: paginatedCards });

      // Categorize by queue type
      const categorized = {
        learning: [] as Array<{ cardId: number; queue: number }>,
        review: [] as Array<{ cardId: number; queue: number }>,
        new: [] as Array<{ cardId: number; queue: number }>,
      };

      for (const card of cardInfo) {
        if (card.queue === 1 || card.queue === 3) {
          categorized.learning.push(card);
        } else if (card.queue === 2) {
          categorized.review.push(card);
        } else if (card.queue === 0) {
          categorized.new.push(card);
        }
      }

      return {
        cards: cardInfo,
        breakdown: {
          learning: categorized.learning.length,
          review: categorized.review.length,
          new: categorized.new.length,
        },
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        },
        queueOrder: "Learning cards shown first, then reviews, then new cards",
      };
    },
  },

  cardsInfo: {
    description:
      "Gets comprehensive card information including: cardId, noteId, deckName, modelName, question/answer HTML, scheduling data (due date, interval, ease factor, reviews, lapses), queue status, modification time, and more. Essential for understanding card state and history. Automatically handles string/number ID conversion and paginates large requests. Returns detailed objects for each card",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs (automatically batched if >100)"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) => {
      const cardIds = cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id));

      // Batch process if more than 100 cards
      if (cardIds.length <= 100) {
        return ankiConnect("cardsInfo", { cards: cardIds });
      }

      // Process in batches of 100
      const batchSize = 100;
      const results = [];

      for (let i = 0; i < cardIds.length; i += batchSize) {
        const batch = cardIds.slice(i, i + batchSize);
        const batchResult = await ankiConnect("cardsInfo", { cards: batch });
        results.push(...batchResult);
      }

      return {
        cards: results,
        metadata: {
          total: results.length,
          batches: Math.ceil(cardIds.length / batchSize),
          batchSize,
        },
      };
    },
  },

  suspend: {
    description:
      "Suspends cards, removing them from review queue while preserving all scheduling data. Suspended cards won't appear in reviews but remain in collection. Useful for temporarily hiding problematic or irrelevant cards. Can be reversed with unsuspend. Cards show yellow background in browser when suspended",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to suspend"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("suspend", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  unsuspend: {
    description:
      "Restores suspended cards to active review queue with all scheduling data intact. Cards resume from where they left off - due cards become immediately due, learning cards continue learning phase. No scheduling information is lost during suspension period. Returns true on success",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to unsuspend"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) => {
      const result = await ankiConnect("unsuspend", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      });
      return result === null ? true : result; // Normalize null to true
    },
  },

  getEaseFactors: {
    description:
      "Gets ease factors (difficulty multipliers) for cards. Ease affects interval growth: default 250% (2.5x), minimum 130%, Hard decreases by 15%, Easy increases by 15%. Lower ease = more frequent reviews. Useful for identifying difficult cards (ease < 200%) that may need reformulation. Returns array of ease values",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("getEaseFactors", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  setEaseFactors: {
    description:
      "Manually sets ease factors for cards. Use with caution - can disrupt spaced repetition algorithm. Typical range: 130-300%. Setting ease to 250% resets to default. Lower values increase review frequency, higher values decrease it. Useful for manually adjusting difficult cards. Changes take effect on next review",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      easeFactors: z.array(z.number()).describe("Ease factors (1.3-2.5)"),
    }),
    handler: async ({ cards, easeFactors }: { cards: Array<number | string>; easeFactors: number[] }) =>
      ankiConnect("setEaseFactors", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        easeFactors,
      }),
  },

  canAddNotes: {
    description:
      "Validates if notes can be added without actually creating them. Checks for: valid model name, valid deck name, required fields filled, duplicate detection (if not allowing duplicates). Returns array of booleans matching input array. Essential for validation before bulk operations. True means note can be added",
    schema: z.object({
      notes: z
        .array(
          z.object({
            deckName: z.string(),
            modelName: z.string(),
            fields: z.record(z.string()),
            tags: z.array(z.string()).optional(),
          }),
        )
        .describe("Notes to check"),
    }),
    handler: async ({
      notes,
    }: {
      notes: Array<{ deckName: string; modelName: string; fields: Record<string, string>; tags?: string[] }>;
    }) => ankiConnect("canAddNotes", { notes }),
  },

  areSuspended: {
    description:
      "Checks suspension status for multiple cards. Returns array of booleans (true=suspended). Order matches input card ID array. More efficient than cardsInfo for just checking suspension. Useful for filtering active cards or managing suspended cards in bulk",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("areSuspended", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  areDue: {
    description:
      "Checks if cards are due for review today. Returns array of booleans. Due means: new cards within daily limit, learning cards ready for next step, or review cards due today or overdue. Does not check suspension status. Order matches input array. Useful for filtering reviewable cards",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to check"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("areDue", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  getIntervals: {
    description:
      "Gets current intervals (days until next review) for cards. Returns array of intervals in days. Negative values indicate cards in learning phase (minutes/hours). Zero means due today. Useful for understanding card scheduling state and predicting future workload. Order matches input array",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      complete: z.boolean().optional().describe("Return complete history"),
    }),
    handler: async ({ cards, complete }: { cards: Array<number | string>; complete?: boolean }) =>
      ankiConnect("getIntervals", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        complete,
      }),
  },

  cardsToNotes: {
    description:
      "Converts card IDs to their parent note IDs. Multiple cards can belong to same note (e.g., Basic reversed, Cloze deletions). Returns array of note IDs matching input order. Useful when you have cards but need to operate on notes. Handles invalid IDs gracefully",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("cardsToNotes", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  cardsModTime: {
    description:
      "Gets last modification timestamps for cards in milliseconds since epoch. Much faster than cardsInfo when you only need modification times (15x speedup). Returns array matching input order. Useful for sync operations, change detection, or sorting by recent activity",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("cardsModTime", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  answerCards: {
    description:
      "Batch answers multiple cards without GUI. Each answer includes cardId and ease (1-4). Processes cards as if reviewed normally, updating scheduling. Does not require active review session. Returns array of booleans indicating success. Useful for automated review or importing review data. Use carefully - affects learning algorithm",
    schema: z.object({
      answers: z
        .array(
          z.object({
            cardId: z.union([z.number(), z.string()]),
            ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
          }),
        )
        .describe("Card answers"),
    }),
    handler: async ({ answers }: { answers: Array<{ cardId: number | string; ease: number }> }) =>
      ankiConnect("answerCards", {
        answers: answers.map((a: { cardId: string | number; ease: number }) => ({
          cardId: typeof a.cardId === "string" ? parseInt(a.cardId, 10) : a.cardId,
          ease: a.ease,
        })),
      }),
  },

  forgetCards: {
    description:
      "Resets cards to 'new' state, clearing all review history and scheduling data. Cards become blue (new) again. Interval, ease factor, and review count reset. Useful for re-learning forgotten material or resetting problematic cards. CAUTION: Destroys review history permanently",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to reset"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) => {
      const result = await ankiConnect("forgetCards", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      });
      return result === null ? true : result;
    },
  },

  relearnCards: {
    description:
      "Places cards into relearning queue (similar to pressing Again on mature cards). Cards enter red learning phase with steps defined in deck config. Preserves ease factor unlike forget. Useful for cards that need refreshing without complete reset. Returns array of success indicators",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) => {
      const result = await ankiConnect("relearnCards", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      });
      return result === null ? true : result;
    },
  },

  setSpecificValueOfCard: {
    description:
      "Directly modifies internal card properties. EXTREME CAUTION: Can break scheduling algorithm if misused. Keys include: 'due' (due date), 'ease' (ease factor), 'ivl' (interval), 'reps' (review count), 'lapses' (failure count). Values must match Anki's internal format. For advanced users only. Can cause unexpected behavior",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
      keys: z.array(z.string()).describe("Field keys to update"),
      newValues: z.array(z.string()).describe("New values for keys"),
      warningCheck: z.boolean().optional().describe("Required for dangerous fields"),
    }),
    handler: async ({
      card,
      keys,
      newValues,
      warningCheck,
    }: {
      card: number | string;
      keys: string[];
      newValues: string[];
      warningCheck?: boolean;
    }) =>
      ankiConnect("setSpecificValueOfCard", {
        card: typeof card === "string" ? parseInt(card, 10) : card,
        keys,
        newValues,
        warning_check: warningCheck,
      }),
  },

  getDecks: {
    description:
      "Gets deck names for specified cards. Returns array of deck names matching input card order. Useful for organizing cards by deck, moving cards between decks, or filtering cards by location. Handles cards from different decks in single call",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("getDecks", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },

  changeDeck: {
    description:
      "Moves cards to a different deck while preserving all scheduling information. Cards maintain their review state, intervals, and ease factors. Only deck location changes. Creates deck if it doesn't exist. Useful for reorganizing without losing progress. Returns success status",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs to move"),
      deck: z.string().describe("Target deck name"),
    }),
    handler: async ({ cards, deck }: { cards: Array<number | string>; deck: string }) => {
      const result = await ankiConnect("changeDeck", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
        deck,
      });
      return result === null ? true : result;
    },
  },
} satisfies Record<string, ToolDef>;
