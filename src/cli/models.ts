import type { Command } from "commander";
import { modelTools } from "../tools/models.js";

export function registerModelCommands(program: Command): void {
  const model = program.command("model").description("Model (note type) operations");

  model
    .command("list")
    .description("List all models")
    .option("--offset <n>", "Starting position", "0")
    .option("--limit <n>", "Maximum models to return", "1000")
    .action(async (options: { offset: string; limit: string }) => {
      const result = await modelTools.modelNames.handler({
        offset: parseInt(options.offset, 10),
        limit: parseInt(options.limit, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  model
    .command("fields <name>")
    .description("Get field names for a model")
    .action(async (name: string) => {
      const result = await modelTools.modelFieldNames.handler({ modelName: name });
      console.log(JSON.stringify(result, null, 2));
    });

  model
    .command("create")
    .description("Create a new model")
    .requiredOption("--name <name>", "Model name")
    .requiredOption("--fields <fields>", "Comma-separated field names")
    .requiredOption("--templates <json>", "Card templates as JSON")
    .option("--css <css>", "CSS styling")
    .option("--cloze", "Create as cloze model")
    .action(async (options: { name: string; fields: string; templates: string; css?: string; cloze?: boolean }) => {
      const result = await modelTools.createModel.handler({
        modelName: options.name,
        inOrderFields: options.fields.split(",").map((f) => f.trim()),
        cardTemplates: JSON.parse(options.templates),
        css: options.css,
        isCloze: options.cloze || false,
      });
      console.log(JSON.stringify(result, null, 2));
    });
}
