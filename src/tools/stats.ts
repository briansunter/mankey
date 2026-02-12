import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const statsTools = {
  getNumCardsReviewedToday: {
    description: "Get today's review count",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedToday"),
  },

  getDueCardsDetailed: {
    description:
      "Get due cards with detailed categorization by queue type (learning vs review). Use 'current' for current deck. Returns paginated results",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(50).describe("Maximum cards to return (default 50, max 500)"),
    }),
    handler: async ({ deck, offset = 0, limit = 50 }: { deck?: string; offset?: number; limit?: number }) => {
      const clampedLimit = Math.min(limit, 500);

      // Query for different card states
      const baseQuery = deck === "current" ? "deck:current" : deck ? `deck:"${deck}"` : "";

      // Learning cards (queue 1 or 3, due soon)
      const learningQuery = baseQuery ? `${baseQuery} (queue:1 OR queue:3)` : "(queue:1 OR queue:3)";
      const learningCardIds = await ankiConnect("findCards", { query: learningQuery });

      // Review cards (queue 2, due today or overdue)
      const reviewQuery = baseQuery ? `${baseQuery} is:due` : "is:due";
      const reviewCardIds = await ankiConnect("findCards", { query: reviewQuery });

      const totalLearning = learningCardIds.length;
      const totalReview = reviewCardIds.length;
      const total = totalLearning + totalReview;

      if (total === 0) {
        return {
          learning: [],
          review: [],
          total: 0,
          pagination: { offset: 0, limit: clampedLimit, total: 0, hasMore: false, nextOffset: null },
        };
      }

      // Combined IDs: learning first, then review (matching Anki's order)
      const allCardIds = [...learningCardIds, ...reviewCardIds];
      const pageIds = allCardIds.slice(offset, offset + clampedLimit);

      if (pageIds.length === 0) {
        return {
          learning: [],
          review: [],
          total,
          pagination: { offset, limit: clampedLimit, total, hasMore: false, nextOffset: null },
        };
      }

      const cardInfo = await ankiConnect("cardsInfo", { cards: pageIds });

      // Separate by actual queue type
      const learning: Array<{
        cardId: number;
        front: string;
        interval: number;
        due: number;
        queue: string;
        reps: number;
      }> = [];
      const review: Array<{
        cardId: number;
        front: string;
        interval: number;
        due: number;
        queue: string;
        ease: number;
      }> = [];

      for (const card of cardInfo) {
        // Queue meanings:
        // 0 = new, 1 = learning, 2 = review, 3 = relearning
        if (card.queue === 1 || card.queue === 3) {
          learning.push({
            cardId: card.cardId,
            front: card.fields?.Front?.value || card.fields?.Simplified?.value || "N/A",
            interval: card.interval,
            due: card.due,
            queue: card.queue === 1 ? "learning" : "relearning",
            reps: card.reps,
          });
        } else if (card.queue === 2 && card.due <= Math.floor(Date.now() / 1000 / 86400)) {
          review.push({
            cardId: card.cardId,
            front: card.fields?.Front?.value || card.fields?.Simplified?.value || "N/A",
            interval: card.interval,
            due: card.due,
            queue: "review",
            ease: card.factor,
          });
        }
      }

      // Sort learning by due time (most urgent first)
      learning.sort((a, b) => a.due - b.due);

      // Sort review by due date
      review.sort((a, b) => a.due - b.due);

      const hasMore = offset + clampedLimit < total;
      return {
        learning,
        review,
        total,
        totalLearning,
        totalReview,
        pagination: {
          offset,
          limit: clampedLimit,
          total,
          hasMore,
          nextOffset: hasMore ? offset + clampedLimit : null,
        },
      };
    },
  },

  getNumCardsReviewedByDay: {
    description:
      "Gets number of reviews performed per day. Returns paginated entries sorted by date. Useful for tracking study patterns and consistency. Historical data available since collection creation",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum entries to return (default 100, max 1000)"),
    }),
    handler: async ({ offset = 0, limit = 100 }: { offset?: number; limit?: number }) => {
      const clampedLimit = Math.min(limit, 1000);
      const data: Record<string, number> = await ankiConnect("getNumCardsReviewedByDay");
      const allEntries = Object.entries(data);
      const total = allEntries.length;
      const entries = allEntries.slice(offset, offset + clampedLimit);
      const hasMore = offset + clampedLimit < total;
      return {
        entries: Object.fromEntries(entries),
        pagination: {
          offset,
          limit: clampedLimit,
          total,
          hasMore,
          nextOffset: hasMore ? offset + clampedLimit : null,
        },
      };
    },
  },

  getCollectionStatsHTML: {
    description:
      "Gets comprehensive collection statistics as formatted HTML including: total cards/notes, daily averages, retention rates, mature vs young cards, time spent studying, forecast, and more. Same statistics shown in Anki's Stats window. HTML includes embedded CSS for proper rendering. Useful for dashboards and reporting",
    schema: z.object({
      wholeCollection: z.boolean().optional().default(true),
    }),
    handler: async ({ wholeCollection }: { wholeCollection?: boolean }) =>
      ankiConnect("getCollectionStatsHTML", { wholeCollection }),
  },

  cardReviews: {
    description:
      "Gets review history for a deck starting from a review ID. Returns paginated array of review entries containing: reviewTime, cardID, ease, interval, lastInterval, factor, reviewDuration. Essential for analyzing learning patterns",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      startID: z.number().describe("Start review ID"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum reviews to return (default 100, max 1000)"),
    }),
    handler: async ({
      deck,
      startID,
      offset = 0,
      limit = 100,
    }: {
      deck: string;
      startID: number;
      offset?: number;
      limit?: number;
    }) => {
      const clampedLimit = Math.min(limit, 1000);
      const allReviews = await ankiConnect("cardReviews", { deck, startID });
      const total = allReviews.length;
      const reviews = allReviews.slice(offset, offset + clampedLimit);
      const hasMore = offset + clampedLimit < total;
      return {
        reviews,
        pagination: {
          offset,
          limit: clampedLimit,
          total,
          hasMore,
          nextOffset: hasMore ? offset + clampedLimit : null,
        },
      };
    },
  },

  getLatestReviewID: {
    description:
      "Gets the ID of the most recent review in collection. Review IDs increment monotonically. Useful for tracking new reviews since last check, implementing review sync, or monitoring study activity. Returns integer ID or null if no reviews",
    schema: z.object({
      deck: z.string().describe("Deck name"),
    }),
    handler: async ({ deck }: { deck: string }) => ankiConnect("getLatestReviewID", { deck }),
  },

  getReviewsOfCards: {
    description:
      "Gets review entries for specific cards from the review log. More targeted than cardReviews. Returns paginated review entries with timestamps, ease ratings, and intervals. Useful for detailed card analysis or custom statistics",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum reviews to return (default 100, max 1000)"),
    }),
    handler: async ({
      cards,
      offset = 0,
      limit = 100,
    }: {
      cards: Array<number | string>;
      offset?: number;
      limit?: number;
    }) => {
      const clampedLimit = Math.min(limit, 1000);
      const allReviews = await ankiConnect("getReviewsOfCards", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      });
      const total = allReviews.length;
      const page = allReviews.slice(offset, offset + clampedLimit);
      const hasMore = offset + clampedLimit < total;
      return {
        reviews: page,
        pagination: {
          offset,
          limit: clampedLimit,
          total,
          hasMore,
          nextOffset: hasMore ? offset + clampedLimit : null,
        },
      };
    },
  },
} satisfies Record<string, ToolDef>;
