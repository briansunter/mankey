#!/usr/bin/env node

import { startMcpServer } from "./mcp/start.js";

startMcpServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
