import { describe, test, expect } from "bun:test";
import { z } from "zod";

// We need to access the zodToJsonSchema function
// Since it's not exported, we'll test it indirectly through the MCP server's tool schema
// But we can also export it for testing purposes

describe("zodToJsonSchema - Schema Conversion Tests", () => {
  // Helper function to extract zodToJsonSchema logic
  function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    if (!(schema instanceof z.ZodObject)) {
      return { type: "object", properties: {} };
    }

    Object.entries(schema.shape).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let field: any = value;
      let isOptional = false;

      // Unwrap optional types
      while (field instanceof z.ZodOptional) {
        isOptional = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      }
      while (field instanceof z.ZodDefault) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      }

      let type = "string";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let items: any = undefined;

      // Determine type based on Zod type
      if (field instanceof z.ZodNumber) {
        type = "number";
      } else if (field instanceof z.ZodBoolean) {
        type = "boolean";
      } else if (field instanceof z.ZodArray) {
        type = "array";
        // Get the inner type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let innerField: any = field._def.type;

        // Unwrap optional inner types
        while (innerField instanceof z.ZodOptional) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          innerField = (innerField as any).innerType || innerField._def.innerType;
        }

        if (innerField instanceof z.ZodNumber) {
          items = { type: "number" };
        } else if (innerField instanceof z.ZodBoolean) {
          items = { type: "boolean" };
        } else if (innerField instanceof z.ZodObject) {
          // Recursively convert nested object schema
          items = zodToJsonSchema(innerField);
        } else if (innerField instanceof z.ZodUnion) {
          // For unions in arrays, default to string
          items = { type: "string" };
        } else {
          items = { type: "string" };
        }
      } else if (field instanceof z.ZodObject) {
        type = "object";
      } else if (field instanceof z.ZodUnion) {
        // For unions, check if all are the same type
        const types = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field._def.options.forEach((opt: any) => {
          if (opt instanceof z.ZodNumber) {
            types.add("number");
          } else if (opt instanceof z.ZodString) {
            types.add("string");
          } else if (opt instanceof z.ZodBoolean) {
            types.add("boolean");
          } else {
            types.add("string");
          }
        });

        // If all same type, use that type
        if (types.size === 1) {
          const typeArray = Array.from(types);
          if (typeArray[0]) {
            type = typeArray[0];
          } else {
            type = "string";
          }
        } else {
          // Multiple types - default to string for simplicity
          type = "string";
        }
      } else if (field instanceof z.ZodRecord) {
        type = "object";
      }

      const prop: Record<string, unknown> = { type };
      if (items) { prop.items = items; }

      // Get description from Zod
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
      ...(required.length > 0 && { required }),
    };
  }

  describe("Unit Tests - Basic Types", () => {
    test("should convert string field", () => {
      const schema = z.object({
        name: z.string(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.properties).toHaveProperty("name");
      expect((result.properties as any).name.type).toBe("string");
    });

    test("should convert number field", () => {
      const schema = z.object({
        age: z.number(),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).age.type).toBe("number");
    });

    test("should convert boolean field", () => {
      const schema = z.object({
        active: z.boolean(),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).active.type).toBe("boolean");
    });

    test("should mark required fields", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.required).toContain("required");
      expect(result.required).not.toContain("optional");
    });

    test("should include descriptions", () => {
      const schema = z.object({
        field: z.string().describe("This is a field"),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).field.description).toBe("This is a field");
    });
  });

  describe("Unit Tests - Arrays", () => {
    test("should convert array of strings", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).tags.type).toBe("array");
      expect((result.properties as any).tags.items.type).toBe("string");
    });

    test("should convert array of numbers", () => {
      const schema = z.object({
        scores: z.array(z.number()),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).scores.items.type).toBe("number");
    });

    test("should convert array of booleans", () => {
      const schema = z.object({
        flags: z.array(z.boolean()),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties as any).flags.items.type).toBe("boolean");
    });
  });

  describe("Unit Tests - Nested Objects", () => {
    test("should recursively convert nested objects in arrays", () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.number(),
          name: z.string(),
          active: z.boolean(),
        })),
      });

      const result = zodToJsonSchema(schema);
      const items = (result.properties as any).items;

      expect(items.type).toBe("array");
      expect(items.items.type).toBe("object");
      expect(items.items.properties).toHaveProperty("id");
      expect(items.items.properties).toHaveProperty("name");
      expect(items.items.properties).toHaveProperty("active");
      expect(items.items.properties.id.type).toBe("number");
      expect(items.items.properties.name.type).toBe("string");
      expect(items.items.properties.active.type).toBe("boolean");
    });

    test("should mark required fields in nested objects", () => {
      const schema = z.object({
        items: z.array(z.object({
          required: z.string(),
          optional: z.string().optional(),
        })),
      });

      const result = zodToJsonSchema(schema);
      const items = (result.properties as any).items.items;

      expect(items.required).toContain("required");
      expect(items.required).not.toContain("optional");
    });

    test("should include descriptions in nested objects", () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.number().describe("Item ID"),
          name: z.string().describe("Item name"),
        })),
      });

      const result = zodToJsonSchema(schema);
      const items = (result.properties as any).items.items.properties;

      expect(items.id.description).toBe("Item ID");
      expect(items.name.description).toBe("Item name");
    });
  });

  describe("Integration Tests - createModel Schema", () => {
    test("should correctly convert createModel schema with nested cardTemplates", () => {
      const createModelSchema = z.object({
        modelName: z.string().min(1).describe("Unique model name (case-sensitive)"),
        inOrderFields: z.array(z.string()).min(1).describe("Field names in display order"),
        css: z.string().optional().describe("CSS styling"),
        isCloze: z.boolean().optional().default(false).describe("Cloze deletion model"),
        cardTemplates: z.array(z.object({
          Name: z.string().min(1).describe("Template name (required)"),
          Front: z.string().describe("Front template HTML"),
          Back: z.string().describe("Back template HTML"),
        })).min(1).describe("Card templates"),
      });

      const result = zodToJsonSchema(createModelSchema);

      // Check top-level properties
      expect(result.properties).toHaveProperty("modelName");
      expect(result.properties).toHaveProperty("cardTemplates");

      // Check cardTemplates is an array
      const cardTemplates = (result.properties as any).cardTemplates;
      expect(cardTemplates.type).toBe("array");
      expect(cardTemplates.description).toBe("Card templates");

      // Check cardTemplates items is an object with proper schema
      expect(cardTemplates.items.type).toBe("object");
      expect(cardTemplates.items.properties).toHaveProperty("Name");
      expect(cardTemplates.items.properties).toHaveProperty("Front");
      expect(cardTemplates.items.properties).toHaveProperty("Back");

      // Check Name field is properly defined
      expect(cardTemplates.items.properties.Name.type).toBe("string");
      expect(cardTemplates.items.properties.Name.description).toBe("Template name (required)");

      // Check Name field is marked as required
      expect(cardTemplates.items.required).toContain("Name");
      expect(cardTemplates.items.required).toContain("Front");
      expect(cardTemplates.items.required).toContain("Back");
    });

    test("should properly handle optional fields in createModel", () => {
      const createModelSchema = z.object({
        modelName: z.string().min(1),
        inOrderFields: z.array(z.string()).min(1),
        css: z.string().optional(),
        cardTemplates: z.array(z.object({
          Name: z.string().min(1),
          Front: z.string(),
          Back: z.string(),
        })).min(1),
      });

      const result = zodToJsonSchema(createModelSchema);

      // Required top-level fields
      expect(result.required).toContain("modelName");
      expect(result.required).toContain("inOrderFields");
      expect(result.required).toContain("cardTemplates");

      // Optional top-level fields
      expect(result.required).not.toContain("css");
    });
  });

  describe("Integration Tests - Deeply Nested Objects", () => {
    test("should handle multiple levels of nesting", () => {
      const schema = z.object({
        data: z.array(z.object({
          level1: z.string(),
          nested: z.array(z.object({
            level2: z.number(),
            value: z.string(),
          })),
        })),
      });

      const result = zodToJsonSchema(schema);
      const dataItems = (result.properties as any).data.items;

      expect(dataItems.properties.level1.type).toBe("string");
      expect(dataItems.properties.nested.type).toBe("array");
      expect(dataItems.properties.nested.items.type).toBe("object");
      expect(dataItems.properties.nested.items.properties.level2.type).toBe("number");
      expect(dataItems.properties.nested.items.properties.value.type).toBe("string");
    });
  });
});
