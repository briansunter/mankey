# Anki createModel Implementation Analysis

**Timestamp**: TIMESTAMP_PLACEHOLDER  
**Explorer**: Codebase Analysis  
**Focus**: createModel implementation and "string indices must be integers" error

## Executive Summary

The `createModel` tool in mankey/src/index.ts passes arguments directly to Anki-Connect without transformation. The error "string indices must be integers" appears to come from the Python-based Anki-Connect server when processing the request structure.

## 1. Current Implementation

### Location
- **File**: `/Users/briansunter/code/mankey/src/index.ts`
- **Lines**: 951-965
- **Function**: `createModel` handler

### Code Structure
```typescript
createModel: {
  description: "Creates a custom note type with specified fields and card templates...",
  schema: z.object({
    modelName: z.string().describe("Model name"),
    inOrderFields: z.array(z.string()).describe("Field names"),
    css: z.string().optional().describe("Card CSS"),
    isCloze: z.boolean().optional(),
    cardTemplates: z.array(z.object({
      Name: z.string().optional(),
      Front: z.string(),
      Back: z.string(),
    })),
  }),
  handler: async (args) => ankiConnect("createModel", args),
},
```

### Request/Response Flow

**Request to Anki-Connect**:
```json
{
  "action": "createModel",
  "version": 6,
  "params": {
    "modelName": "string",
    "inOrderFields": ["string"],
    "css": "string (optional)",
    "isCloze": boolean,
    "cardTemplates": [
      {
        "Name": "string (optional)",
        "Front": "string",
        "Back": "string"
      }
    ]
  }
}
```

**Expected Response** (from Anki-Connect docs):
```typescript
// Type definition at line 123:
createModel: Record<string, unknown>;
```

## 2. Issue Analysis

### The "string indices must be integers" Error

This is a **Python error** that occurs in the Anki-Connect server when:
- Code tries to access a string using dictionary syntax: `string_var[key]`
- Instead of: `string_var[0]` (integer index)

**Root Cause Analysis**:

The error likely occurs because the Anki-Connect server's `createModel` handler expects a specific data structure, but the mankey implementation may be:

1. **Missing Parameter Transformation**: The raw `args` object is passed directly, but Anki-Connect may expect wrapped parameters
2. **Incorrect Field Structure**: The `cardTemplates` array structure doesn't match what Anki expects
3. **Type Mismatch**: Fields that should be arrays are being passed as objects or vice versa

### Comparison with Working Operations

Looking at other working operations like `addNote`:

```typescript
// Line 495-508
handler: async (args) => {
  const tags = args.tags ? normalizeTags(args.tags) : [];
  
  return ankiConnect("addNote", {
    note: {
      deckName: args.deckName,
      modelName: args.modelName,
      fields: args.fields,
      tags,
      options: { allowDuplicate: args.allowDuplicate || false },
    }
  });
},
```

**Key difference**: `addNote` WRAPS parameters in a `note` object before passing to ankiConnect.

### Current createModel Implementation Issue

The `createModel` handler does NOT wrap parameters:
```typescript
handler: async (args) => ankiConnect("createModel", args),
```

This directly passes the entire args object, but Anki-Connect's Python server expects the parameters in a specific format.

## 3. Expected Anki-Connect API Contract

From `/Users/briansunter/code/mankey/docs/README.md.txt` (lines 2904-2933):

```json
{
    "action": "createModel",
    "version": 6,
    "params": {
        "modelName": "newModelName",
        "inOrderFields": ["Field1", "Field2", "Field3"],
        "css": "Optional CSS with default to builtin css",
        "isCloze": false,
        "cardTemplates": [
            {
                "Name": "My Card 1",
                "Front": "Front html {{Field1}}",
                "Back": "Back html {{Field2}}"
            }
        ]
    }
}
```

The parameters should be flat at the `params` level, not nested further.

## 4. Critical Observations

### Schema Definition (Lines 953-963)
```typescript
schema: z.object({
  modelName: z.string().describe("Model name"),
  inOrderFields: z.array(z.string()).describe("Field names"),
  css: z.string().optional().describe("Card CSS"),
  isCloze: z.boolean().optional(),
  cardTemplates: z.array(z.object({
    Name: z.string().optional(),
    Front: z.string(),
    Back: z.string(),
  })),
}),
```

✅ **Schema matches the expected API** - all fields are at the correct level

### Handler Implementation (Line 964)
```typescript
handler: async (args) => ankiConnect("createModel", args),
```

❌ **PROBLEM**: This passes args directly without any preprocessing.

The `ankiConnect` function (lines 196-226) will:
1. Receive the action: `"createModel"`
2. Receive params: entire `args` object
3. Send to Anki-Connect as:
```json
{
  "action": "createModel",
  "version": 6,
  "params": { ...args }  // Direct pass-through
}
```

## 5. Data Structures Used

### Input Schema (TypeScript)
- `modelName`: string
- `inOrderFields`: string[]
- `css`: optional string
- `isCloze`: optional boolean
- `cardTemplates`: array of objects with `Name` (optional), `Front`, `Back`

### Response Type (Line 123)
```typescript
createModel: Record<string, unknown>;
```

This is too generic - should match actual Anki model response structure.

## 6. Comparison with Similar Operations

### `updateModelTemplates` (lines 1451-1463)
```typescript
handler: async ({ model }) => 
  ankiConnect("updateModelTemplates", { model }),
```

**Wraps** the `model` object - shows conscious parameter wrapping.

### `modelNames` (lines 891-913)
```typescript
handler: async ({ offset = 0, limit = 1000 }) => {
  const allModels = await ankiConnect("modelNames");
  // ... pagination logic
}
```

**No wrapping needed** - this is a GET operation.

### Pattern Observation
Operations that **modify data** often need parameter wrapping, while **read operations** typically don't.

## 7. Potential Fixes

### Option 1: Direct Pass-Through (Current)
```typescript
handler: async (args) => ankiConnect("createModel", args),
```
- Only works if args structure exactly matches Anki-Connect expectations
- May fail due to how Anki-Connect Python code processes the parameters

### Option 2: Explicit Field Assignment
```typescript
handler: async ({ modelName, inOrderFields, css, isCloze, cardTemplates }) => 
  ankiConnect("createModel", { 
    modelName, 
    inOrderFields, 
    css, 
    isCloze, 
    cardTemplates 
  }),
```
- More explicit but essentially the same as current

### Option 3: Custom Normalization (Likely Needed)
```typescript
handler: async (args) => {
  const params: Record<string, unknown> = {
    modelName: args.modelName,
    inOrderFields: args.inOrderFields,
    cardTemplates: args.cardTemplates.map((template: any, i: number) => ({
      Name: template.Name || `Card ${i + 1}`,
      Front: template.Front,
      Back: template.Back,
    })),
  };
  if (args.css) params.css = args.css;
  if (args.isCloze !== undefined) params.isCloze = args.isCloze;
  return ankiConnect("createModel", params);
},
```

## 8. Untested Status

From `/Users/briansunter/code/mankey/docs/untested-tools.md`:
- ❌ `createModel` is NOT in the tested tools list
- Model operations section (lines 48-54) shows multiple untested model tools:
  - `modelNamesAndIds`
  - `modelFieldsOnTemplates`
  - `modelTemplates`
  - `modelStyling`
  - `updateModelTemplates`
  - **`createModel`** - specifically untested

## 9. No Existing Tests

**Search Results**:
- No `createModel` references in test files: `/Users/briansunter/code/mankey/tests/`
- 8 test files exist but none test model creation:
  - test-anki-connect.test.ts
  - test-tags.test.ts
  - test-edge-cases.test.ts
  - test-fixes.test.ts
  - test-queue-priority.test.ts
  - test-pagination.test.ts
  - test-real-operations.test.ts
  - test-utils.test.ts

## 10. Error Origin Analysis

The error "string indices must be integers" originates from:

1. **Anki-Connect's Python server** - not from mankey
2. **Suggests**: The parameter structure Anki-Connect receives has a field that should be an array or object but is being interpreted as a string
3. **Likely culprit**: The `cardTemplates` or `inOrderFields` processing in Anki's Python code

Possible scenarios:
- Anki-Connect tries to iterate or index into `cardTemplates` as if it were a string
- A field name is incorrectly passed as a string instead of being in an array
- The wrapping of parameters creates unexpected nesting

## 11. Files Involved

- `/Users/briansunter/code/mankey/src/index.ts` - Main implementation (951-965)
- `/Users/briansunter/code/mankey/docs/README.md.txt` - Anki-Connect API docs
- `/Users/briansunter/code/mankey/docs/untested-tools.md` - Tool testing status
- `/Users/briansunter/code/mankey/tests/` - Test files (no createModel tests)

## 12. Summary of Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| No parameter normalization | High | Direct `args` pass-through differs from working operations like `addNote` |
| No testing | High | Not in untested-tools.md, no test coverage |
| Generic response type | Medium | `Record<string, unknown>` vs specific model shape |
| Potential type mismatch | High | Python error suggests field structure issue |
| Missing field defaults | Medium | `Name` field in cardTemplates is optional but may be required |

## Recommendations

1. **Test first** - Create test case for createModel to isolate the error
2. **Normalize parameters** - Apply same pattern as `addNote` (wrap in appropriate structure)
3. **Add field defaults** - Ensure all required fields have sensible defaults
4. **Strengthen typing** - Replace generic `Record<string, unknown>` with specific response type
5. **Debug with Anki-Connect logs** - Check what structure Anki-Connect is receiving

## Code References

### ankiConnect Function (Lines 196-226)
```typescript
async function ankiConnect(
  action: string, 
  params: Record<string, unknown> = {}
): Promise<unknown> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
    });
    // ... error handling
  }
}
```

### normalizeTags (Lines 25-58)
```typescript
function normalizeTags(tags: unknown): string[] {
  // Handles: array, space-separated string, JSON string
}
```

Similar normalization should be applied to createModel parameters.

