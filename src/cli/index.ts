import { createRequire } from "node:module";
import { Command } from "commander";
import { setAnkiConnectUrl } from "../shared/config.js";
import { registerCardCommands } from "./cards.js";
import { registerDeckCommands } from "./decks.js";
import { registerModelCommands } from "./models.js";
import { registerNoteCommands } from "./notes.js";
import { registerRunCommand } from "./run.js";
import { registerStatsCommands } from "./stats.js";
import { registerToolsCommand } from "./tools-list.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

export function createProgram(): Command {
  const program = new Command();

  program
    .name("mankey")
    .description("MCP server and CLI for Anki integration via Anki-Connect")
    .version(version)
    .option("--url <url>", "Anki-Connect server URL (env: ANKI_CONNECT_URL)")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.url) {
        setAnkiConnectUrl(opts.url);
      }
    });

  // MCP server subcommand
  program
    .command("mcp")
    .description("Start the MCP server (default when no args)")
    .action(async () => {
      const { startMcpServer } = await import("../mcp/start.js");
      await startMcpServer();
    });

  // Register all CLI subcommands
  registerRunCommand(program);
  registerToolsCommand(program);
  registerDeckCommands(program);
  registerNoteCommands(program);
  registerCardCommands(program);
  registerModelCommands(program);
  registerStatsCommands(program);

  return program;
}
