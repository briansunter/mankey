import type { Command } from "commander";
import { toolCategories, tools } from "../tools/index.js";

export function registerToolsCommand(program: Command): void {
  program
    .command("tools")
    .description("List all available tools")
    .option("--category <category>", "Filter by category (deck, note, card, model, media, stats, gui, system)")
    .option("--json", "Output as JSON")
    .action(async (options: { category?: string; json?: boolean }) => {
      let toolList: Array<{ name: string; category: string; description: string }>;

      if (options.category) {
        const catName = options.category;
        const category = toolCategories[catName];
        if (!category) {
          console.error(`Error: Unknown category "${catName}"`);
          console.error(`Available categories: ${Object.keys(toolCategories).join(", ")}`);
          process.exit(1);
        }
        toolList = Object.entries(category).map(([name, def]) => ({
          name,
          category: catName,
          description: def.description.split(".")[0] || def.description,
        }));
      } else {
        toolList = [];
        for (const [catName, catTools] of Object.entries(toolCategories)) {
          for (const [name, def] of Object.entries(catTools)) {
            toolList.push({
              name,
              category: catName,
              description: def.description.split(".")[0] || def.description,
            });
          }
        }
      }

      if (options.json) {
        console.log(JSON.stringify({ tools: toolList, total: toolList.length }, null, 2));
        return;
      }

      // Group by category for display
      const grouped: Record<string, typeof toolList> = {};
      for (const tool of toolList) {
        if (!grouped[tool.category]) {
          grouped[tool.category] = [];
        }
        const group = grouped[tool.category];
        if (group) {
          group.push(tool);
        }
      }

      for (const [category, categoryTools] of Object.entries(grouped)) {
        console.log(`\n${category.toUpperCase()} (${categoryTools.length} tools):`);
        for (const tool of categoryTools) {
          console.log(`  ${tool.name.padEnd(30)} ${tool.description}`);
        }
      }

      console.log(`\nTotal: ${Object.keys(tools).length} tools`);
    });
}
