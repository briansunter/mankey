import { test, expect, describe } from "bun:test";
import { z } from "zod";

// Duplicate the zodToJsonSchema function for testing
function zodToJsonSchema(schema: z.ZodObject<any>): any {
  const shape = schema._def.shape();
  const properties: any = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    let field = value as z.ZodTypeAny;
    let isRequired = true;
    let description: string | undefined;

    // Unwrap all wrapper types (ZodOptional, ZodDefault) in any order
    while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
      if (field instanceof z.ZodOptional) {
        isRequired = false;
        field = field._def.innerType;
      } else if (field instanceof z.ZodDefault) {
        field = field._def.innerType;
      }
    }

    // Extract description
    if (field._def.description) {
      description = field._def.description;
    }

    // Handle different Zod types
    if (field instanceof z.ZodString) {
      const minLength = field._def.checks?.find((c: any) => c.kind === "min")?.value;
      properties[key] = { type: "string", description };
      if (minLength !== undefined) {
        properties[key].minLength = minLength;
      }
    } else if (field instanceof z.ZodNumber) {
      properties[key] = { type: "number", description };
    } else if (field instanceof z.ZodBoolean) {
      properties[key] = { type: "boolean", description };
    } else if (field instanceof z.ZodArray) {
      const innerField = field._def.type;
      let items: any;

      if (innerField instanceof z.ZodString) {
        items = { type: "string" };
      } else if (innerField instanceof z.ZodNumber) {
        items = { type: "number" };
      } else if (innerField instanceof z.ZodBoolean) {
        items = { type: "boolean" };
      } else if (innerField instanceof z.ZodObject) {
        // Recursively convert nested object schema
        items = zodToJsonSchema(innerField);
      } else if (innerField instanceof z.ZodUnion) {
        items = { type: "string" };
      } else {
        items = { type: "object" };
      }

      const minItems = field._def.minLength?.value;
      properties[key] = { type: "array", items, description };
      if (minItems !== undefined) {
        properties[key].minItems = minItems;
      }
    } else if (field instanceof z.ZodObject) {
      properties[key] = zodToJsonSchema(field);
    } else if (field instanceof z.ZodUnion) {
      const options = field._def.options;
      const types = options.map((opt: any) => {
        if (opt instanceof z.ZodLiteral) {
          return opt._def.value;
        }
        return "string";
      });
      properties[key] = { type: "string", enum: types, description };
    } else {
      properties[key] = { type: "string", description };
    }

    if (isRequired) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

describe("Boolean fields with .optional().default() chain", () => {
  test("should correctly type boolean field with .optional().default(false)", () => {
    const schema = z.object({
      isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
    });

    const result = zodToJsonSchema(schema);

    console.log("Result for isCloze:", JSON.stringify(result, null, 2));

    // This test SHOULD pass but currently FAILS
    expect(result.properties.isCloze.type).toBe("boolean");
    expect(result.required).not.toContain("isCloze");
  });

  test("should correctly type boolean field with .default(false).optional()", () => {
    const schema = z.object({
      isCloze: z.boolean().default(false).optional().describe("Whether this is a cloze deletion model"),
    });

    const result = zodToJsonSchema(schema);

    console.log("Result for isCloze (reversed):", JSON.stringify(result, null, 2));

    expect(result.properties.isCloze.type).toBe("boolean");
    expect(result.required).not.toContain("isCloze");
  });

  test("should correctly type boolean field with only .optional()", () => {
    const schema = z.object({
      enabled: z.boolean().optional().describe("Whether feature is enabled"),
    });

    const result = zodToJsonSchema(schema);

    expect(result.properties.enabled.type).toBe("boolean");
    expect(result.required).not.toContain("enabled");
  });

  test("should correctly type boolean field with only .default()", () => {
    const schema = z.object({
      enabled: z.boolean().default(true).describe("Whether feature is enabled"),
    });

    const result = zodToJsonSchema(schema);

    console.log("Result for enabled with default:", JSON.stringify(result, null, 2));

    // With .default() but no .optional(), this is interesting...
    // Zod treats it as required because you must provide it or use the default
    expect(result.properties.enabled.type).toBe("boolean");
  });

  test("should correctly type plain boolean field", () => {
    const schema = z.object({
      enabled: z.boolean().describe("Whether feature is enabled"),
    });

    const result = zodToJsonSchema(schema);

    expect(result.properties.enabled.type).toBe("boolean");
    expect(result.required).toContain("enabled");
  });
});

describe("Wrapper unwrapping order", () => {
  test("should handle ZodDefault(ZodOptional(ZodBoolean))", () => {
    // This is what .optional().default() creates
    const innerBoolean = z.boolean();
    const withOptional = innerBoolean.optional();
    const withDefault = withOptional.default(false);

    const schema = z.object({
      field: withDefault,
    });

    const result = zodToJsonSchema(schema);

    console.log("Unwrapping test result:", JSON.stringify(result, null, 2));
    console.log("Field type:", typeof (schema._def.shape().field));
    console.log("Is ZodDefault:", schema._def.shape().field instanceof z.ZodDefault);
    console.log("Inner type:", schema._def.shape().field._def.innerType);
    console.log("Is inner ZodOptional:", schema._def.shape().field._def.innerType instanceof z.ZodOptional);

    expect(result.properties.field.type).toBe("boolean");
  });
});
