import { z } from "zod";

// Simplified Zod to JSON Schema converter
// CRITICAL: Uses single while loop to unwrap ZodOptional and ZodDefault wrappers.
// See docs/iscloze-boolean-fix-2025-10-18.md for full bug analysis.
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (!(schema instanceof z.ZodObject)) {
    return { type: "object", properties: {} };
  }

  Object.entries(schema.shape).forEach(([key, value]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let field: any = value;
    let isOptional = false;

    // Unwrap all wrapper types (ZodOptional, ZodDefault) in any order
    while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
      if (field instanceof z.ZodOptional) {
        isOptional = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      } else if (field instanceof z.ZodDefault) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field = (field as any).innerType || field._def.innerType;
      }
    }

    let type = "string";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any;

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
    if (items) {
      prop.items = items;
    }

    // Get description from Zod
    const fieldDef = (value as { _def?: { description?: string } })._def;
    if (fieldDef?.description) {
      prop.description = fieldDef.description;
    }

    properties[key] = prop;

    // Check if field is required (not optional)
    if (!isOptional && !(value instanceof z.ZodOptional)) {
      required.push(key);
    }
  });

  return {
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
  };
}
