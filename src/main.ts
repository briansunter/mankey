#!/usr/bin/env node

import { createProgram } from "./cli/index.js";
import { startMcpServer } from "./mcp/start.js";

async function main() {
  // No args → start MCP server for backward compat
  const args = process.argv.slice(2);
  if (args.length === 0) {
    await startMcpServer();
    return;
  }

  const program = createProgram();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
