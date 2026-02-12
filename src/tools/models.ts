import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const modelTools = {
  modelNames: {
    description:
      "Lists all available note types (models) in the collection. Common built-in models: 'Basic' (Front/Back fields), 'Basic (and reversed card)', 'Cloze' (for cloze deletions), 'Basic (type in the answer)'. Custom models show user-defined names. Essential for addNote operations. Returns paginated results for collections with many models",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum models to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }: { offset?: number; limit?: number }) => {
      const allModels = await ankiConnect("modelNames");
      const total = allModels.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedModels = allModels.slice(offset, offset + effectiveLimit);

      return {
        models: paginatedModels,
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        },
      };
    },
  },

  modelFieldNames: {
    description:
      "Gets ordered list of field names for a specific model. Field names are case-sensitive and must match exactly when creating/updating notes. Common fields: 'Front', 'Back' (Basic), 'Text', 'Extra' (Cloze). Order matters for some operations. Essential for validating note data before creation",
    schema: z.object({
      modelName: z.string().describe("Note type name"),
    }),
    handler: async ({ modelName }: { modelName: string }) => ankiConnect("modelFieldNames", { modelName }),
  },

  modelNamesAndIds: {
    description:
      "Gets mapping of model names to their internal IDs. Model IDs are timestamps of creation and never change. Useful for operations requiring model IDs or checking if models exist. IDs are stable across syncs. Returns object with model names as keys, IDs as values. Paginated for large collections",
    schema: z.object({
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(1000).describe("Maximum entries to return (default 1000, max 10000)"),
    }),
    handler: async ({ offset = 0, limit = 1000 }: { offset?: number; limit?: number }) => {
      const allModels = await ankiConnect("modelNamesAndIds");
      const entries = Object.entries(allModels);
      const total = entries.length;
      const effectiveLimit = Math.min(limit, 10000);
      const paginatedEntries = entries.slice(offset, offset + effectiveLimit);

      return {
        models: Object.fromEntries(paginatedEntries),
        pagination: {
          offset,
          limit: effectiveLimit,
          total,
          hasMore: offset + effectiveLimit < total,
          nextOffset: offset + effectiveLimit < total ? offset + effectiveLimit : null,
        },
      };
    },
  },

  createModel: {
    description:
      "Creates a custom note type with specified fields and card templates. Requires careful template syntax: {{Field}} for replacements, {{#Field}}...{{/Field}} for conditionals. Templates generate cards from notes. CSS styling is shared across all templates. Model name must be unique. Returns created model object. Complex operation - consider cloning existing models instead",
    schema: z.object({
      modelName: z.string().min(1).describe("Unique model name (case-sensitive)"),
      inOrderFields: z.array(z.string()).min(1).describe("Field names in display order (at least one required)"),
      css: z.string().optional().describe("CSS styling for all cards in this model"),
      isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
      cardTemplates: z
        .array(
          z.object({
            Name: z.string().min(1).describe("Template name (required)"),
            Front: z.string().describe("Front template HTML (question side)"),
            Back: z.string().describe("Back template HTML (answer side)"),
          }),
        )
        .min(1)
        .describe("Card templates (at least one required)"),
    }),
    handler: async (args: {
      modelName: string;
      inOrderFields: string[];
      css?: string;
      isCloze?: boolean;
      cardTemplates: Array<{ Name: string; Front: string; Back: string }>;
    }) => ankiConnect("createModel", args),
  },

  modelFieldsOnTemplates: {
    description:
      "Analyzes which fields are actually used in each card template. Returns mapping of template names to field arrays. Helps identify unused fields or understand template dependencies. Essential for model optimization or safe field deletion. Only shows fields referenced in templates",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }: { modelName: string }) => ankiConnect("modelFieldsOnTemplates", { modelName }),
  },

  modelTemplates: {
    description:
      "Gets all card templates for a model. Each template defines how cards are generated from notes. Returns object with template names as keys and template definitions (Front/Back format strings) as values. Templates use {{Field}} syntax with conditionals {{#Field}}...{{/Field}}. Essential for understanding card generation",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }: { modelName: string }) => ankiConnect("modelTemplates", { modelName }),
  },

  modelStyling: {
    description:
      "Gets CSS styling that applies to all cards of this model type. Returns CSS string that controls card appearance during review. Includes fonts, colors, alignment, and custom classes. Shared across all templates of the model. Understanding CSS required for modifications",
    schema: z.object({
      modelName: z.string().describe("Model name"),
    }),
    handler: async ({ modelName }: { modelName: string }) => {
      const result = await ankiConnect("modelStyling", { modelName });
      return result.css;
    },
  },

  updateModelTemplates: {
    description:
      "Updates card generation templates for a model. CAUTION: Affects all existing notes using this model. May delete cards if templates removed, or create cards if added. Template syntax errors can break card generation. Test changes on copy first. Returns updated template object",
    schema: z.object({
      model: z.object({
        name: z.string(),
        templates: z.record(
          z.object({
            Front: z.string(),
            Back: z.string(),
          }),
        ),
      }),
    }),
    handler: async ({
      model,
    }: {
      model: { name: string; templates: Record<string, { Front: string; Back: string }> };
    }) => ankiConnect("updateModelTemplates", { model }),
  },

  updateModelStyling: {
    description:
      "Updates CSS styling for all cards of a model type. Changes apply immediately to all cards during review. Invalid CSS may break card display. Affects all notes using this model. Consider model-specific classes to avoid conflicts. Test thoroughly before applying to important decks",
    schema: z.object({
      model: z.object({
        name: z.string(),
        css: z.string(),
      }),
    }),
    handler: async ({ model }: { model: { name: string; css: string } }) =>
      ankiConnect("updateModelStyling", { model }),
  },
} satisfies Record<string, ToolDef>;
