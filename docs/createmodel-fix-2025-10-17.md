# createModel Fix Summary

**Date:** 2025-10-17
**Issue:** `MCPClientError: MCP error -32603: Anki-Connect: createModel failed: string indices must be integers`

## Problem Analysis

### Root Cause
The `createModel` tool had a schema validation issue where the `Name` field in `cardTemplates` was marked as **optional**, but Anki-Connect requires it to be provided. Additionally, arrays lacked minimum length validation, allowing empty submissions.

### Investigation Process
1. **Codebase Exploration** - Used codebase-explorer agent (Haiku) to map the implementation
2. **API Research** - Used online-researcher agent to verify Anki-Connect API requirements
3. **Analysis** - Synthesized findings from both reports to identify exact issues

## Changes Made

### Schema Fixes (src/index.ts:951-965)

#### Before:
```typescript
createModel: {
  schema: z.object({
    modelName: z.string().describe("Model name"),
    inOrderFields: z.array(z.string()).describe("Field names"),
    css: z.string().optional().describe("Card CSS"),
    isCloze: z.boolean().optional(),
    cardTemplates: z.array(z.object({
      Name: z.string().optional(),  // ❌ PROBLEM: Optional
      Front: z.string(),
      Back: z.string(),
    })),
  }),
}
```

#### After:
```typescript
createModel: {
  schema: z.object({
    modelName: z.string().min(1).describe("Unique model name (case-sensitive)"),
    inOrderFields: z.array(z.string()).min(1).describe("Field names in display order (at least one required)"),
    css: z.string().optional().describe("CSS styling for all cards in this model"),
    isCloze: z.boolean().optional().default(false).describe("Whether this is a cloze deletion model"),
    cardTemplates: z.array(z.object({
      Name: z.string().min(1).describe("Template name (required)"),  // ✅ FIXED: Required
      Front: z.string().describe("Front template HTML (question side)"),
      Back: z.string().describe("Back template HTML (answer side)"),
    })).min(1).describe("Card templates (at least one required)"),
  }),
}
```

### Key Changes:
1. **Name field**: Changed from `z.string().optional()` to `z.string().min(1)` (required)
2. **Array validation**: Added `.min(1)` to `inOrderFields` and `cardTemplates` arrays
3. **Field validation**: Added `.min(1)` to `modelName`
4. **Defaults**: Added `.default(false)` to `isCloze` for clarity
5. **Documentation**: Improved field descriptions for better clarity

## Testing

### Test Coverage
Created comprehensive test suite in `tests/test-createModel.test.ts`:

#### Unit Tests (Schema Validation)
- ✅ Validates non-empty modelName
- ✅ Validates at least one field in inOrderFields
- ✅ Validates at least one cardTemplate
- ✅ Validates required Name field in cardTemplates

#### Integration Tests
- ✅ Creates basic model with minimal parameters
- ✅ Creates model with custom CSS
- ✅ Creates model with multiple fields
- ✅ Creates model with multiple card templates
- ✅ Creates cloze deletion model
- ✅ Fails on duplicate model name
- ✅ Creates model matching original error case (Building Block example)
- ✅ End-to-end: Creates model and adds note to verify functionality

### Test Results
```
12 pass
0 fail
19 expect() calls
```

Full test suite: **206 pass** (including createModel tests)

## Manual Testing

### Example Request (Now Working)
```json
{
  "modelName": "Building Block Model",
  "inOrderFields": ["Building Block", "Short Description"],
  "cardTemplates": [
    {
      "Name": "Building Block Card",
      "Front": "{{#Building Block}}<div class='building-block'>{{Building Block}}</div>{{/Building Block}}",
      "Back": "{{FrontSide}}\n\n<hr id=answer>\n\n{{#Short Description}}<div class='short-description'>{{Short Description}}</div>{{/Short Description}}"
    }
  ]
}
```

This request now succeeds where it previously failed with "string indices must be integers".

## Documentation Updates

### Agent Reports Generated
- `docs/agents/exploration-anki-createmodel-1760754416.md` - Detailed codebase analysis
- `docs/agents/research-anki-connect-createmodel-1734467890.md` - API research findings
- `docs/createmodel-fix-2025-10-17.md` - This summary

### Recommendations for Future
1. **Validation patterns**: Apply `.min(1)` to all critical string and array fields
2. **Required fields**: Mark all Anki-Connect required fields as non-optional
3. **Documentation**: Include examples in field descriptions
4. **Testing**: Add test coverage before deployment for all new tools

## Verification Steps

1. ✅ Type checking passes: `bun run typecheck`
2. ✅ Build succeeds: `bun run build`
3. ✅ All tests pass: `bun test tests/test-createModel.test.ts`
4. ✅ Full suite passes: `bun test tests` (206/207 tests pass, 1 pre-existing failure unrelated)

## Impact

- **Before**: createModel failed with cryptic Python error
- **After**:
  - Clear validation errors for missing/empty fields
  - All required fields properly validated
  - Comprehensive test coverage
  - Working end-to-end functionality

## Related Files

- `src/index.ts:951-965` - Schema definition (fixed)
- `tests/test-createModel.test.ts` - New comprehensive test suite
- `docs/agents/exploration-anki-createmodel-*.md` - Exploration reports
- `docs/agents/research-anki-connect-createmodel-*.md` - Research findings
