import type { Command } from "commander";
import { tools } from "../tools/index.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run <tool> [json]")
    .description("Run any tool by name with optional JSON arguments")
    .action(async (toolName: string, json?: string) => {
      const tool = tools[toolName];
      if (!tool) {
        console.error(`Error: Unknown tool "${toolName}"`);
        console.error(`Run "mankey tools" to see available tools.`);
        process.exit(1);
      }

      let rawArgs = {};
      if (json) {
        try {
          rawArgs = JSON.parse(json);
        } catch (e) {
          console.error(`Error: Invalid JSON argument: ${e instanceof Error ? e.message : e}`);
          process.exit(1);
        }
      }

      // Validate args against the tool's Zod schema
      const parsed = tool.schema.safeParse(rawArgs);
      if (!parsed.success) {
        console.error(`Validation error for "${toolName}":`);
        for (const issue of parsed.error.issues) {
          const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
          console.error(`  ${path}: ${issue.message}`);
        }
        process.exit(1);
      }

      try {
        const result = await tool.handler(parsed.data);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
