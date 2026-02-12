import type { Command } from "commander";
import { cardTools } from "../tools/cards.js";

export function registerCardCommands(program: Command): void {
  const card = program.command("card").description("Card operations");

  card
    .command("find <query>")
    .description("Find cards by query")
    .option("--offset <n>", "Starting position", "0")
    .option("--limit <n>", "Maximum results", "100")
    .action(async (query: string, options: { offset: string; limit: string }) => {
      const result = await cardTools.findCards.handler({
        query,
        offset: parseInt(options.offset, 10),
        limit: parseInt(options.limit, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  card
    .command("info <ids...>")
    .description("Get card information")
    .action(async (ids: string[]) => {
      const result = await cardTools.cardsInfo.handler({
        cards: ids.map((id) => parseInt(id, 10)),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  card
    .command("suspend <ids...>")
    .description("Suspend cards")
    .action(async (ids: string[]) => {
      const result = await cardTools.suspend.handler({
        cards: ids.map((id) => parseInt(id, 10)),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  card
    .command("unsuspend <ids...>")
    .description("Unsuspend cards")
    .action(async (ids: string[]) => {
      const result = await cardTools.unsuspend.handler({
        cards: ids.map((id) => parseInt(id, 10)),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  card
    .command("answer <cardId> <ease>")
    .description("Answer a card (ease: 1=Again, 2=Hard, 3=Good, 4=Easy)")
    .action(async (cardId: string, ease: string) => {
      const result = await cardTools.answerCards.handler({
        answers: [{ cardId: parseInt(cardId, 10), ease: parseInt(ease, 10) }],
      });
      console.log(JSON.stringify(result, null, 2));
    });

  card
    .command("next")
    .description("Get next cards due for review")
    .option("--deck <deck>", "Deck name")
    .option("--limit <n>", "Maximum cards", "10")
    .action(async (options: { deck?: string; limit: string }) => {
      const result = await cardTools.getNextCards.handler({
        deck: options.deck,
        limit: parseInt(options.limit, 10),
        offset: 0,
      });
      console.log(JSON.stringify(result, null, 2));
    });
}
