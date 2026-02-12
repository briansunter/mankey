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
      "Get due cards with detailed categorization by queue type (learning vs review). Use 'current' for current deck",
    schema: z.object({
      deck: z.string().describe("Deck name (or 'current' for current deck)").optional(),
    }),
    handler: async ({ deck }: { deck?: string }) => {
      // Query for different card states
      const baseQuery = deck === "current" ? "deck:current" : deck ? `deck:"${deck}"` : "";

      // Learning cards (queue 1 or 3, due soon)
      const learningQuery = baseQuery ? `${baseQuery} (queue:1 OR queue:3)` : "(queue:1 OR queue:3)";
      const learningCards = await ankiConnect("findCards", { query: learningQuery });

      // Review cards (queue 2, due today or overdue)
      const reviewQuery = baseQuery ? `${baseQuery} is:due` : "is:due";
      const reviewCards = await ankiConnect("findCards", { query: reviewQuery });

      // Get info for all cards
      const allCardIds = [...learningCards, ...reviewCards];
      if (allCardIds.length === 0) {
        return { learning: [], review: [], total: 0 };
      }

      const cardInfo = await ankiConnect("cardsInfo", { cards: allCardIds });

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

      return {
        learning: learning,
        review: review,
        total: learning.length + review.length,
        note: "Learning cards (including relearning) are shown before review cards in Anki",
      };
    },
  },

  getNumCardsReviewedByDay: {
    description:
      "Gets number of reviews performed on a specific day. Date format: Unix timestamp (seconds since epoch). Returns total review count including new, learning, and review cards. Useful for tracking study patterns and consistency. Historical data available since collection creation",
    schema: z.object({}),
    handler: async () => ankiConnect("getNumCardsReviewedByDay"),
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
      "Gets complete review history for specified cards. Returns array of review arrays, each containing: reviewTime, cardID, ease, interval, lastInterval, factor, reviewDuration. Essential for analyzing learning patterns, identifying problem cards, or exporting review data. Large histories may be substantial",
    schema: z.object({
      deck: z.string().describe("Deck name"),
      startID: z.number().describe("Start review ID"),
    }),
    handler: async ({ deck, startID }: { deck: string; startID: number }) =>
      ankiConnect("cardReviews", { deck, startID }),
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
      "Gets review entries for specific cards from the review log. More targeted than cardReviews. Returns review entries with timestamps, ease ratings, and intervals. Useful for detailed card analysis or custom statistics. Handles multiple cards efficiently",
    schema: z.object({
      cards: z.array(z.union([z.number(), z.string()])).describe("Card IDs"),
    }),
    handler: async ({ cards }: { cards: Array<number | string> }) =>
      ankiConnect("getReviewsOfCards", {
        cards: cards.map((id: string | number) => (typeof id === "string" ? parseInt(id, 10) : id)),
      }),
  },
} satisfies Record<string, ToolDef>;
