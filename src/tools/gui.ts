import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const guiTools = {
  guiBrowse: {
    description:
      "Opens Anki's Browse window with optional search query. Query uses same syntax as findCards/findNotes. Useful for complex manual review or bulk operations. Browser allows editing, tagging, suspending, and more. Returns array of note IDs initially shown. Requires Anki GUI running",
    schema: z.object({
      query: z.string().describe("Search query"),
      reorderCards: z
        .object({
          order: z.enum(["ascending", "descending"]).optional(),
          columnId: z.string().optional(),
        })
        .optional(),
    }),
    handler: async (args: { query: string; reorderCards?: { order?: string; columnId?: string } }) =>
      ankiConnect("guiBrowse", args),
  },

  guiAddCards: {
    description:
      "Opens Add Cards dialog pre-filled with specified content. Allows user to review and modify before adding. Useful for semi-automated card creation where human review is needed. CloseAfterAdding option controls dialog behavior. Returns note ID if card was added (null if cancelled). Requires GUI",
    schema: z.object({
      note: z.object({
        deckName: z.string(),
        modelName: z.string(),
        fields: z.record(z.string()),
        tags: z.array(z.string()).optional(),
      }),
    }),
    handler: async ({
      note,
    }: {
      note: { deckName: string; modelName: string; fields: Record<string, string>; tags?: string[] };
    }) => ankiConnect("guiAddCards", { note }),
  },

  guiCurrentCard: {
    description:
      "Gets information about the card currently being reviewed in the main window. Returns null if not in review mode. Includes card ID, question/answer content, buttons available, and more. Useful for integration with review session or automated review helpers. Requires active review session",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCurrentCard"),
  },

  guiAnswerCard: {
    description:
      "Answers the current review card programmatically. Ease values: 1=Again (fail), 2=Hard, 3=Good, 4=Easy. Affects scheduling based on chosen ease. Only works during active review session. Automatically shows next card. Useful for automated review or accessibility tools. Returns true on success",
    schema: z.object({
      ease: z.number().min(1).max(4).describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
    }),
    handler: async ({ ease }: { ease: number }) => ankiConnect("guiAnswerCard", { ease }),
  },

  guiDeckOverview: {
    description:
      "Opens deck overview screen showing study options and statistics for specified deck. Displays new/learning/review counts and study buttons. User can start studying from this screen. Useful for navigating to specific deck programmatically. Requires GUI running",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }: { name: string }) => ankiConnect("guiDeckOverview", { name }),
  },

  guiExitAnki: {
    description:
      "Closes Anki application completely. Saves all changes before exiting. Use with caution - terminates the Anki process. No confirmation dialog shown. Useful for automated workflows that need clean shutdown. Connection to Anki-Connect will be lost",
    schema: z.object({}),
    handler: async () => ankiConnect("guiExitAnki"),
  },

  guiSelectedNotes: {
    description:
      "Gets note IDs currently selected in the Browse window. Returns empty array if browser not open or nothing selected. Useful for creating tools that operate on user's selection. Requires browser window to be open. Selection can be from search or manual",
    schema: z.object({}),
    handler: async () => ankiConnect("guiSelectedNotes"),
  },

  guiSelectCard: {
    description:
      "Selects and scrolls to a specific card in the Browse window. Opens browser if not already open. Card is highlighted and details shown in preview pane. Useful for navigating to specific cards programmatically or showing search results. Returns true on success",
    schema: z.object({
      card: z.union([z.number(), z.string()]).describe("Card ID"),
    }),
    handler: async ({ card }: { card: number | string }) =>
      ankiConnect("guiSelectCard", {
        card: typeof card === "string" ? parseInt(card, 10) : card,
      }),
  },

  guiEditNote: {
    description:
      "Opens the Edit Current Note dialog for a specific note. Shows all fields and tags in editable form. User can modify and save changes. Blocks until dialog closed. Returns modified note fields after save, or null if cancelled. Requires GUI running",
    schema: z.object({
      note: z.union([z.number(), z.string()]).describe("Note ID"),
    }),
    handler: async ({ note }: { note: number | string }) =>
      ankiConnect("guiEditNote", {
        note: typeof note === "string" ? parseInt(note, 10) : note,
      }),
  },

  guiStartCardTimer: {
    description:
      "Starts the review timer for current card. Timer tracks time spent on card for statistics. Usually starts automatically but can be triggered manually. Only works during active review session. Returns true if timer started successfully",
    schema: z.object({}),
    handler: async () => ankiConnect("guiStartCardTimer"),
  },

  guiShowQuestion: {
    description:
      "Shows the question (front) side of current review card. Hides answer if visible. Resets timer if configured. Only works during review session. Useful for custom review interfaces or accessibility tools. Returns true on success",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowQuestion"),
  },

  guiShowAnswer: {
    description:
      "Reveals the answer (back) side of current review card. Shows rating buttons for ease selection. Timer continues running. Only works during review with question shown. Essential for custom review flows. Returns true on success",
    schema: z.object({}),
    handler: async () => ankiConnect("guiShowAnswer"),
  },

  guiUndo: {
    description:
      "Undoes the last reviewable action in Anki. Can undo: card answers, note edits, note additions, deletions. Limited undo history (typically last 10 actions). Not all operations can be undone. Returns true if undo successful, false if nothing to undo",
    schema: z.object({}),
    handler: async () => ankiConnect("guiUndo"),
  },

  guiDeckBrowser: {
    description:
      "Opens the main deck browser screen showing all decks with statistics. This is Anki's home screen. Shows new/learning/due counts for each deck. User can select decks to study from here. Returns true when opened successfully",
    schema: z.object({}),
    handler: async () => ankiConnect("guiDeckBrowser"),
  },

  guiDeckReview: {
    description:
      "Starts review session for specified deck. Opens review screen and shows first card. Follows configured order: learning, review, then new cards. User reviews with spacebar and number keys. Returns name of deck being reviewed. Requires GUI",
    schema: z.object({
      name: z.string().describe("Deck name"),
    }),
    handler: async ({ name }: { name: string }) => ankiConnect("guiDeckReview", { name }),
  },

  guiCheckDatabase: {
    description:
      "Runs database integrity check and optimization. Checks for: corruption, missing media, invalid cards, orphaned notes. Fixes problems when possible. Shows progress dialog. May take time on large collections. Returns status message with problems found/fixed",
    schema: z.object({}),
    handler: async () => ankiConnect("guiCheckDatabase"),
  },

  guiImportFile: {
    description:
      "Opens import dialog for user to select and import files. Supports: .apkg (deck packages), .colpkg (collection), .txt/.csv (notes). Shows import options and progress. User controls duplicate handling. Returns import summary or null if cancelled. Requires GUI",
    schema: z.object({
      path: z.string().optional().describe("File path to import"),
    }),
    handler: async ({ path }: { path?: string }) => ankiConnect("guiImportFile", { path }),
  },
} satisfies Record<string, ToolDef>;
