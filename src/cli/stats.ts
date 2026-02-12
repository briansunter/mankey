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
    .action(async (options: { deck?: string }) => {
      const result = await statsTools.getDueCardsDetailed.handler({
        deck: options.deck,
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
