import type { Command } from "commander";
import { statsTools } from "../tools/stats.js";

export function registerStatsCommands(program: Command): void {
  const stats = program.command("stats").description("Review statistics");

  stats
    .command("today")
    .description("Get today's review count")
    .action(async () => {
      const result = await statsTools.getNumCardsReviewedToday.handler();
      console.log(JSON.stringify(result, null, 2));
    });

  stats
    .command("due")
    .description("Get due cards with details")
    .option("--deck <deck>", "Deck name")
    .option("--offset <n>", "Starting position", "0")
    .option("--limit <n>", "Maximum cards to return", "50")
    .action(async (options: { deck?: string; offset?: string; limit?: string }) => {
      const result = await statsTools.getDueCardsDetailed.handler({
        deck: options.deck,
        offset: parseInt(options.offset || "0", 10),
        limit: parseInt(options.limit || "50", 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  stats
    .command("collection")
    .description("Get collection statistics")
    .action(async () => {
      const result = await statsTools.getCollectionStatsHTML.handler({ wholeCollection: true });
      console.log(JSON.stringify(result, null, 2));
    });
}
