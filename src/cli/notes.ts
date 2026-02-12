import type { Command } from "commander";
import { noteTools } from "../tools/notes.js";

export function registerNoteCommands(program: Command): void {
  const note = program.command("note").description("Note operations");

  note
    .command("add")
    .description("Add a new note")
    .requiredOption("--deck <deck>", "Target deck name")
    .requiredOption("--model <model>", "Note type (e.g., Basic, Cloze)")
    .requiredOption("--front <front>", "Front field content")
    .requiredOption("--back <back>", "Back field content")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--allow-duplicate", "Allow duplicate notes")
    .action(
      async (options: {
        deck: string;
        model: string;
        front: string;
        back: string;
        tags?: string;
        allowDuplicate?: boolean;
      }) => {
        const tags = options.tags ? options.tags.split(",").map((t) => t.trim()) : [];
        const result = await noteTools.addNote.handler({
          deckName: options.deck,
          modelName: options.model,
          fields: { Front: options.front, Back: options.back },
          tags,
          allowDuplicate: options.allowDuplicate || false,
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  note
    .command("find <query>")
    .description("Find notes by query")
    .option("--offset <n>", "Starting position", "0")
    .option("--limit <n>", "Maximum results", "100")
    .action(async (query: string, options: { offset: string; limit: string }) => {
      const result = await noteTools.findNotes.handler({
        query,
        offset: parseInt(options.offset, 10),
        limit: parseInt(options.limit, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  note
    .command("info <ids...>")
    .description("Get note information")
    .action(async (ids: string[]) => {
      const result = await noteTools.notesInfo.handler({
        notes: ids.map((id) => parseInt(id, 10)),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  note
    .command("update <id>")
    .description("Update a note")
    .option("--fields <json>", "Fields to update as JSON")
    .option("--tags <tags>", "Comma-separated tags (replaces existing)")
    .action(async (id: string, options: { fields?: string; tags?: string }) => {
      const args: { id: number; fields?: Record<string, string>; tags?: string[] } = {
        id: parseInt(id, 10),
      };
      if (options.fields) {
        args.fields = JSON.parse(options.fields);
      }
      if (options.tags) {
        args.tags = options.tags.split(",").map((t) => t.trim());
      }
      const result = await noteTools.updateNote.handler(args);
      console.log(JSON.stringify(result, null, 2));
    });

  note
    .command("delete <ids...>")
    .description("Delete notes")
    .action(async (ids: string[]) => {
      const result = await noteTools.deleteNotes.handler({
        notes: ids.map((id) => parseInt(id, 10)),
      });
      console.log(JSON.stringify(result, null, 2));
    });

  note
    .command("tags <id>")
    .description("Get tags for a note")
    .action(async (id: string) => {
      const result = await noteTools.getNoteTags.handler({
        note: parseInt(id, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    });
}
