import type { Command } from "commander";
import { deckTools } from "../tools/decks.js";

export function registerDeckCommands(program: Command): void {
  const deck = program.command("deck").description("Deck operations");

  deck
    .command("list")
    .description("List all decks")
    .option("--offset <n>", "Starting position", "0")
    .option("--limit <n>", "Maximum decks to return", "1000")
    .action(async (options: { offset: string; limit: string }) => {
      const result = await deckTools.deckNames.handler({
        offset: parseInt(options.offset, 10),
        limit: parseInt(options.limit, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  deck
    .command("create <name>")
    .description("Create a new deck")
    .action(async (name: string) => {
      const result = await deckTools.createDeck.handler({ deck: name });
      console.log(JSON.stringify(result, null, 2));
    });

  deck
    .command("stats <names...>")
    .description("Get deck statistics")
    .action(async (names: string[]) => {
      const result = await deckTools.getDeckStats.handler({ decks: names });
      console.log(JSON.stringify(result, null, 2));
    });

  deck
    .command("delete <names...>")
    .description("Delete decks")
    .action(async (names: string[]) => {
      const result = await deckTools.deleteDecks.handler({ decks: names, cardsToo: true });
      console.log(JSON.stringify(result, null, 2));
    });
}
