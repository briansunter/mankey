import type { ToolDef } from "../shared/types.js";
import { cardTools } from "./cards.js";
import { deckTools } from "./decks.js";
import { guiTools } from "./gui.js";
import { mediaTools } from "./media.js";
import { modelTools } from "./models.js";
import { noteTools } from "./notes.js";
import { statsTools } from "./stats.js";
import { systemTools } from "./system.js";

export { cardTools } from "./cards.js";
// Re-export individual categories
export { deckTools } from "./decks.js";
export { guiTools } from "./gui.js";
export { mediaTools } from "./media.js";
export { modelTools } from "./models.js";
export { noteTools } from "./notes.js";
export { statsTools } from "./stats.js";
export { systemTools } from "./system.js";

// Category mapping for CLI tools listing
export const toolCategories: Record<string, Record<string, ToolDef>> = {
  deck: deckTools,
  note: noteTools,
  card: cardTools,
  model: modelTools,
  media: mediaTools,
  stats: statsTools,
  gui: guiTools,
  system: systemTools,
};

// Merged record of all tools
export const tools: Record<string, ToolDef> = {
  ...deckTools,
  ...noteTools,
  ...cardTools,
  ...modelTools,
  ...mediaTools,
  ...statsTools,
  ...guiTools,
  ...systemTools,
};
