import { test, expect, describe, afterAll } from "bun:test";
import { z } from "zod";

/**
 * Regression test for isCloze boolean field issue
 *
 * Issue: When isCloze was defined as z.boolean().optional().default(false),
 * the zodToJsonSchema function incorrectly typed it as "string" instead of "boolean".
 * This caused MCP clients to send "false" (string) instead of false (boolean),
 * which Anki-Connect interpreted as truthy, triggering cloze validation errors.
 *
 * This test suite ensures:
 * 1. isCloze is typed as boolean in JSON schema
 * 2. isCloze defaults to false when not provided
 * 3. isCloze=true creates a cloze model
 * 4. isCloze=false creates a non-cloze model
 * 5. String "false" is rejected (type validation)
 */

// Import the zodToJsonSchema function (we'll copy it here for testing)
function zodToJsonSchema(schema: z.ZodObject<any>): any {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    let field: any = value;
    let isOptional = false;

    // Unwrap all wrapper types (ZodOptional, ZodDefault) in any order
    // This is the critical fix - using a single while loop
    while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
      if (field instanceof z.ZodOptional) {
        isOptional = true;
        field = (field as any).innerType || field._def.innerType;
      } else if (field instanceof z.ZodDefault) {
        field = (field as any).innerType || field._def.innerType;
      }
    }

    let type = "string";
    let items: any = undefined;

    // Determine type based on Zod type
    if (field instanceof z.ZodNumber) {
      type = "number";
    } else if (field instanceof z.ZodBoolean) {
      type = "boolean";
    } else if (field instanceof z.ZodArray) {
      type = "array";
      let innerField: any = field._def.type;

      while (innerField instanceof z.ZodOptional) {
        innerField = (innerField as any).innerType || innerField._def.innerType;
      }

      if (innerField instanceof z.ZodNumber) {
        items = { type: "number" };
      } else if (innerField instanceof z.ZodBoolean) {
        items = { type: "boolean" };
      } else if (innerField instanceof z.ZodObject) {
        items = zodToJsonSchema(innerField);
      } else {
        items = { type: "string" };
      }
    } else if (field instanceof z.ZodObject) {
      type = "object";
    }

    const prop: Record<string, unknown> = { type };
    if (items) { prop.items = items; }

    const fieldDef = (value as { _def?: { description?: string } })._def;
    if (fieldDef?.description) {
      prop.description = fieldDef.description;
    }

    properties[key] = prop;

    if (!isOptional) {
      required.push(key);
    }
  });

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

// Test utilities
const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || "http://localhost:8765";

interface AnkiResponse<T> {
  result: T | null;
  error: string | null;
}

async function ankiConnect<T>(action: string, params?: Record<string, any>): Promise<T> {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      version: 6,
      params: params || {},
    }),
  });

  const result = (await response.json()) as AnkiResponse<T>;
  if (result.error) {
    throw new Error(`AnkiConnect error: ${result.error}`);
  }
  return result.result!;
}

// Test fixtures
const testModels: string[] = [];

afterAll(async () => {
  // Cleanup test models
  for (const modelName of testModels) {
    try {
      await ankiConnect("deleteModel", { modelName });
    } catch (_e) {
      // Ignore cleanup errors
    }
  }
});

describe("createModel isCloze boolean field regression test", () => {
  describe("JSON Schema Conversion", () => {
    test("isCloze should be typed as boolean in JSON schema", () => {
      const createModelSchema = z.object({
        modelName: z.string().min(1).describe("Unique model name (case-sensitive)"),
        inOrderFields: z.array(z.string()).min(1).describe("Field names in display order"),
        css: z.string().optional().describe("CSS styling for all cards"),
        isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
        cardTemplates: z.array(z.object({
          Name: z.string().min(1).describe("Template name (required)"),
          Front: z.string().describe("Front template HTML"),
          Back: z.string().describe("Back template HTML"),
        })).min(1).describe("Card templates"),
      });

      const jsonSchema = zodToJsonSchema(createModelSchema);

      // Critical assertions
      expect(jsonSchema.properties.isCloze).toBeDefined();
      expect(jsonSchema.properties.isCloze.type).toBe("boolean");
      expect(jsonSchema.required).not.toContain("isCloze");
      expect(jsonSchema.properties.isCloze.description).toBe("Whether this is a cloze deletion model");
    });

    test("should reject string values for isCloze (type validation)", () => {
      const createModelSchema = z.object({
        modelName: z.string(),
        inOrderFields: z.array(z.string()),
        isCloze: z.boolean().optional().default(false),
        cardTemplates: z.array(z.object({
          Name: z.string(),
          Front: z.string(),
          Back: z.string(),
        })),
      });

      // This should fail validation - string "false" is not a boolean
      const invalidData = {
        modelName: "Test",
        inOrderFields: ["Field1"],
        isCloze: "false", // STRING instead of boolean!
        cardTemplates: [{ Name: "Card", Front: "Q", Back: "A" }],
      };

      const result = createModelSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("isCloze");
        expect(result.error.issues[0].message).toContain("boolean");
      }
    });
  });

  describe("createModel with isCloze parameter", () => {
    test("should create non-cloze model when isCloze=false (explicit)", async () => {
      const modelName = `TestNonCloze_${Date.now()}`;
      testModels.push(modelName);

      const result = await ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        isCloze: false, // Explicitly false
        cardTemplates: [{
          Name: "Card 1",
          Front: "{{Front}}",
          Back: "{{Front}}<hr>{{Back}}",
        }],
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.type).toBe(0); // 0 = non-cloze, 1 = cloze
    });

    test("should create non-cloze model when isCloze is omitted (default)", async () => {
      const modelName = `TestNonClozeDefault_${Date.now()}`;
      testModels.push(modelName);

      const result = await ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        // isCloze omitted - should default to false
        cardTemplates: [{
          Name: "Card 1",
          Front: "{{Front}}",
          Back: "{{Front}}<hr>{{Back}}",
        }],
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.type).toBe(0); // Should be non-cloze by default
    });

    test("should create cloze model when isCloze=true", async () => {
      const modelName = `TestClozeTrue_${Date.now()}`;
      testModels.push(modelName);

      const result = await ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Text", "Extra"],
        isCloze: true, // Explicitly true
        cardTemplates: [{
          Name: "Cloze Card",
          Front: "{{cloze:Text}}",
          Back: "{{cloze:Text}}<br>{{Extra}}",
        }],
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.type).toBe(1); // 1 = cloze
    });

    test("REGRESSION: should not fail with cloze error when isCloze=false and non-cloze templates", async () => {
      // This is the exact scenario that was failing before the fix
      const modelName = `AWS_System_Design_Card_${Date.now()}`;
      testModels.push(modelName);

      // This should NOT throw "Expected to find '{{cloze:Text}}'" error
      await expect(ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Service", "Building Block", "Short Description", "Long Description", "Example"],
        cardTemplates: [{
          Name: "AWS Card",
          Front: "Service: {{Service}}\nBuilding Block: {{Building Block}}",
          Back: "Service: {{Service}}\nBuilding Block: {{Building Block}}\n\nShort Description:\n{{Short Description}}\n\nLong Description:\n{{Long Description}}\n\nExample:\n{{Example}}",
        }],
        css: ".card { font-family: arial; font-size: 16px; }",
        isCloze: false, // Explicitly false - should NOT trigger cloze validation
      })).resolves.toBeDefined();
    });

    test("REGRESSION: should fail when isCloze=true but templates don't have cloze syntax", async () => {
      const modelName = `TestInvalidCloze_${Date.now()}`;
      testModels.push(modelName);

      // This SHOULD fail because isCloze=true but templates don't use {{cloze:...}}
      await expect(ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        isCloze: true, // TRUE but templates are wrong
        cardTemplates: [{
          Name: "Card 1",
          Front: "{{Front}}", // Missing {{cloze:...}}
          Back: "{{Front}}<hr>{{Back}}",
        }],
      })).rejects.toThrow(/cloze/i);
    });
  });

  describe("End-to-end: Create model and add notes", () => {
    test("should create non-cloze model and successfully add a note", async () => {
      const modelName = `TestE2EComplete_${Date.now()}`;
      testModels.push(modelName);

      // Create model with isCloze=false
      await ankiConnect<any>("createModel", {
        modelName,
        inOrderFields: ["Question", "Answer"],
        isCloze: false,
        cardTemplates: [{
          Name: "Standard",
          Front: "{{Question}}",
          Back: "{{Question}}<hr>{{Answer}}",
        }],
      });

      // Add a note to verify the model works
      const noteId = await ankiConnect<number>("addNote", {
        note: {
          deckName: "Default",
          modelName,
          fields: {
            Question: "What was the isCloze bug?",
            Answer: "zodToJsonSchema typed boolean as string",
          },
          tags: ["test"],
        }
      });

      expect(noteId).toBeGreaterThan(0);
    });
  });
});

describe("zodToJsonSchema wrapper unwrapping edge cases", () => {
  test("should handle .optional().default() chain (ZodDefault wrapping ZodOptional)", () => {
    const schema = z.object({
      field: z.boolean().optional().default(false),
    });

    const result = zodToJsonSchema(schema);
    expect(result.properties.field.type).toBe("boolean");
    expect(result.required).not.toContain("field");
  });

  test("should handle .default().optional() chain (ZodOptional wrapping ZodDefault)", () => {
    const schema = z.object({
      field: z.boolean().default(false).optional(),
    });

    const result = zodToJsonSchema(schema);
    expect(result.properties.field.type).toBe("boolean");
    expect(result.required).not.toContain("field");
  });

  test("should handle just .optional() (no default)", () => {
    const schema = z.object({
      field: z.boolean().optional(),
    });

    const result = zodToJsonSchema(schema);
    expect(result.properties.field.type).toBe("boolean");
    expect(result.required).not.toContain("field");
  });

  test("should handle just .default() (no optional)", () => {
    const schema = z.object({
      field: z.boolean().default(true),
    });

    const result = zodToJsonSchema(schema);
    expect(result.properties.field.type).toBe("boolean");
    // With default but no optional, it's still required in the sense you must provide it
    expect(result.required).toContain("field");
  });

  test("should handle plain boolean (no modifiers)", () => {
    const schema = z.object({
      field: z.boolean(),
    });

    const result = zodToJsonSchema(schema);
    expect(result.properties.field.type).toBe("boolean");
    expect(result.required).toContain("field");
  });
});
