# Anki-Connect API createModel Action Research

**Research Date:** 2025-10-17
**Researcher:** Claude (Sonnet 4.5)
**Task:** Research the Anki-Connect API documentation for the createModel action

## Executive Summary

The `createModel` action in Anki-Connect creates a new note type (model) in Anki. Based on multiple sources including Go implementations, MCP servers, and code examples, I've identified the correct request format and common implementation issues.

## Official API Specification

### Action Name
`createModel`

### Required Parameters

1. **modelName** (string)
   - The name of the new model/note type
   - Must be unique (Anki will error if a model with this name already exists)

2. **inOrderFields** (array of strings)
   - Ordered list of field names for the model
   - Example: `["Front", "Back"]` or `["Hanzi", "Pinyin", "English", "Audio"]`
   - Field order matters and defines the display order in Anki

3. **cardTemplates** (array of objects)
   - Array of card template definitions
   - Each template object must have:
     - `Name` (string): Template name (e.g., "Card 1", "WordDefinition")
     - `Front` (string): HTML template for the question side
     - `Back` (string): HTML template for the answer side

### Optional Parameters

4. **css** (string, optional)
   - CSS styling applied to all cards of this model
   - Shared across all templates
   - Default: Basic Anki styling if not provided

5. **isCloze** (boolean, optional)
   - Whether this is a cloze deletion model
   - Default: `false`

## Working Example Requests

### Example 1: Basic Model (Front/Back)

```json
{
  "action": "createModel",
  "version": 6,
  "params": {
    "modelName": "Basic Custom",
    "inOrderFields": ["Front", "Back"],
    "cardTemplates": [
      {
        "Name": "Card 1",
        "Front": "{{Front}}",
        "Back": "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}"
      }
    ],
    "css": ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}\n"
  }
}
```

### Example 2: Language Learning Model with Audio

```json
{
  "action": "createModel",
  "version": 6,
  "params": {
    "modelName": "Chinese Vocabulary",
    "inOrderFields": ["Hanzi", "Pinyin", "English", "Audio"],
    "cardTemplates": [
      {
        "Name": "Recognition",
        "Front": "{{Hanzi}}\n\n{{Audio}}",
        "Back": "{{FrontSide}}\n\n<hr id=answer>\n\n{{Pinyin}}<br>{{English}}"
      },
      {
        "Name": "Production",
        "Front": "{{English}}",
        "Back": "{{FrontSide}}\n\n<hr id=answer>\n\n{{Hanzi}}<br>{{Pinyin}}\n\n{{Audio}}"
      }
    ],
    "css": ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n}\n.hanzi { font-size: 40px; }\n"
  }
}
```

### Example 3: From Chrome Extension (Real-World)

Based on the Chrome Anki plugin example found:

```json
{
  "action": "createModel",
  "version": 6,
  "params": {
    "modelName": "WordDefinition",
    "inOrderFields": ["word", "speech", "definition"],
    "cardTemplates": [
      {
        "Name": "WordDefinition",
        "Front": "<span class=\"jp\">{{furigana:word}}</span> {{speech}}",
        "Back": "{{FrontSide}}\n\n<hr id=answer>\n\n{{definition}}"
      }
    ]
  }
}
```

## cardTemplates Structure

### Field Details

The `cardTemplates` parameter is an **array of objects**, where each object represents one card template:

```typescript
cardTemplates: Array<{
  Name: string;      // Template name (required)
  Front: string;     // Front side HTML (required)
  Back: string;      // Back side HTML (required)
}>
```

### Template Syntax

Templates use Anki's template syntax:

- `{{FieldName}}` - Insert field content
- `{{FrontSide}}` - Include entire front side (only valid on Back template)
- `{{#FieldName}}...{{/FieldName}}` - Conditional display (only if field has content)
- `{{^FieldName}}...{{/FieldName}}` - Negative conditional (only if field is empty)
- `{{furigana:FieldName}}` - Special formatting for Japanese furigana
- `<hr id=answer>` - Standard separator between question and answer

### Multiple Templates

- Each template in the array creates a different card type
- For a note with 2 templates, each added note generates 2 cards
- Useful for bidirectional cards (e.g., English→Chinese and Chinese→English)

## CSS and Fields Structure

### CSS Parameter

```json
"css": ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n}\n"
```

- Optional parameter
- Applied to all card templates in the model
- Use `\n` for newlines in JSON
- Can include custom classes referenced in templates

### inOrderFields Parameter

```json
"inOrderFields": ["Front", "Back", "Extra", "Source"]
```

- Array of strings
- Defines all fields available in the note type
- Order determines display order in Anki's note editor
- Field names are case-sensitive
- Must be referenced exactly in templates (e.g., `{{Front}}` requires field named "Front")

## Common Errors and Solutions

### Error 1: "Model already exists"

**Problem:** Trying to create a model with a name that already exists

**Solution:**
- Check existing models first with `modelNames` action
- Use unique model names or append version numbers

### Error 2: "cardTemplates must be an array"

**Problem:** Passing cardTemplates as a single object instead of array

**Solution:**
```javascript
// ❌ Wrong
cardTemplates: {
  Name: "Card 1",
  Front: "{{Front}}",
  Back: "{{Back}}"
}

// ✅ Correct
cardTemplates: [{
  Name: "Card 1",
  Front: "{{Front}}",
  Back: "{{Back}}"
}]
```

### Error 3: Missing required fields in cardTemplates

**Problem:** Omitting `Name`, `Front`, or `Back` from template objects

**Solution:**
- All three fields are required for each template
- `Name` can be optional in some implementations but recommended to always include

### Error 4: Field name mismatch

**Problem:** Template references `{{front}}` but field is named `Front`

**Solution:**
- Field names are case-sensitive
- Ensure template placeholders exactly match `inOrderFields` entries

## Comparison with Current Implementation

### Current Implementation (from /Users/briansunter/code/mankey/src/index.ts)

```typescript
createModel: {
  description: "Creates a custom note type...",
  schema: z.object({
    modelName: z.string().describe("Model name"),
    inOrderFields: z.array(z.string()).describe("Field names"),
    css: z.string().optional().describe("Card CSS"),
    isCloze: z.boolean().optional(),
    cardTemplates: z.array(z.object({
      Name: z.string().optional(),  // ⚠️ ISSUE: Should be required
      Front: z.string(),
      Back: z.string(),
    })),
  }),
  handler: async (args) => ankiConnect("createModel", args),
}
```

### Issues Identified

1. **Name field marked as optional**
   - While some Anki-Connect versions may auto-generate names, best practice is to require it
   - Recommendation: Make `Name` required in schema

2. **Missing validation**
   - No validation that cardTemplates array is non-empty
   - No validation that inOrderFields is non-empty
   - Recommendation: Add `.min(1)` to array schemas

3. **Limited documentation**
   - Description could be more explicit about template syntax
   - No examples in the description
   - Recommendation: Expand description with template syntax examples

## Recommended Implementation Changes

```typescript
createModel: {
  description: `Creates a custom note type with specified fields and card templates.

Template Syntax:
- {{FieldName}} - Insert field content
- {{FrontSide}} - Include entire front (Back template only)
- {{#Field}}...{{/Field}} - Conditional display

Example:
{
  "modelName": "Basic Custom",
  "inOrderFields": ["Front", "Back"],
  "cardTemplates": [{
    "Name": "Card 1",
    "Front": "{{Front}}",
    "Back": "{{FrontSide}}\\n\\n<hr id=answer>\\n\\n{{Back}}"
  }]
}`,
  schema: z.object({
    modelName: z.string().min(1).describe("Unique model name"),
    inOrderFields: z.array(z.string()).min(1).describe("Field names (case-sensitive)"),
    css: z.string().optional().describe("CSS styling for all cards"),
    isCloze: z.boolean().optional().default(false).describe("Cloze deletion model"),
    cardTemplates: z.array(z.object({
      Name: z.string().min(1).describe("Template name"),  // Now required
      Front: z.string().describe("Front template HTML"),
      Back: z.string().describe("Back template HTML"),
    })).min(1).describe("At least one card template required"),
  }),
  handler: async (args) => ankiConnect("createModel", args),
}
```

## Additional Resources

1. **Go Implementation Reference**
   - Package: `github.com/atselvan/ankiconnect`
   - Struct definitions show exact field requirements
   - URL: https://pkg.go.dev/github.com/atselvan/ankiconnect

2. **MCP Server Implementation**
   - Project: `nietus/anki-mcp`
   - Shows working createModel implementation
   - URL: https://github.com/nietus/anki-mcp

3. **Official Anki Template Documentation**
   - URL: https://docs.ankiweb.net/templates/intro.html
   - Explains template syntax and field replacements

## Testing Recommendations

1. **Test with minimal model:**
   ```json
   {
     "modelName": "Test_Basic",
     "inOrderFields": ["Front", "Back"],
     "cardTemplates": [{
       "Name": "Card 1",
       "Front": "{{Front}}",
       "Back": "{{Back}}"
     }]
   }
   ```

2. **Test with multiple templates:**
   - Create a model with 2 templates
   - Verify both card types are created when adding a note

3. **Test error handling:**
   - Try creating duplicate model names
   - Try empty arrays
   - Try mismatched field names in templates

4. **Test optional parameters:**
   - Create with and without CSS
   - Create with and without isCloze

## Conclusion

The `createModel` action requires:
1. `modelName`: Unique string identifier
2. `inOrderFields`: Non-empty array of field names
3. `cardTemplates`: Non-empty array with `Name`, `Front`, `Back` objects

The current implementation is mostly correct but should:
- Make `Name` required in cardTemplates schema
- Add minimum length/count validations
- Expand documentation with examples

All evidence points to `cardTemplates` being an array of objects with all three fields required, which matches the current implementation structure but not the optional nature of the `Name` field.
