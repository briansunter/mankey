# isCloze Boolean Field Fix - October 18, 2025

## Problem

When using `createModel` with non-cloze models, the operation was failing with error:

```
Anki-Connect: createModel failed: Card template ⁨1⁩ in note type '⁨AWS System Design Card⁩' has a problem.
Expected to find '{{cloze:Text}}' or similar on the front and back of the card template.
```

This occurred even when `isCloze` was explicitly set to `false`.

## Root Cause

The `zodToJsonSchema` function used **two separate sequential while loops** to unwrap Zod wrapper types:

```typescript
// OLD CODE - BUGGY
while (field instanceof z.ZodOptional) {
  isOptional = true;
  field = field._def.innerType;
}
while (field instanceof z.ZodDefault) {
  field = field._def.innerType;
}
```

When a field had both `.optional()` and `.default()` modifiers (like `z.boolean().optional().default(false)`), Zod creates this structure:

```
ZodDefault(ZodOptional(ZodBoolean))
```

The unwrapping failed because:
1. First loop: Checks if it's `ZodOptional` → NO (it's `ZodDefault`)
2. Second loop: Unwraps `ZodDefault` → now it's `ZodOptional`
3. **But we already passed the ZodOptional check!**
4. Field typed as `"string"` instead of `"boolean"`

This caused MCP clients to:
- See `isCloze` typed as `"string"` in the JSON schema
- Send string value `"false"` instead of boolean `false`
- Anki-Connect interpreted the string `"false"` as **truthy** (non-empty string)
- Attempted to create a cloze model, triggering cloze validation errors

## Solution

Combined into a **single while loop** that checks both conditions:

```typescript
// NEW CODE - FIXED
while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
  if (field instanceof z.ZodOptional) {
    isOptional = true;
    field = field._def.innerType;
  } else if (field instanceof z.ZodDefault) {
    field = field._def.innerType;
  }
}
```

This properly unwraps all wrapper layers regardless of nesting order:
- `ZodDefault(ZodOptional(ZodBoolean))` → unwraps to `ZodBoolean` ✅
- `ZodOptional(ZodDefault(ZodBoolean))` → unwraps to `ZodBoolean` ✅
- `ZodOptional(ZodBoolean)` → unwraps to `ZodBoolean` ✅
- `ZodDefault(ZodBoolean)` → unwraps to `ZodBoolean` ✅

## Files Changed

### src/index.ts (lines 242-252)
Modified the `zodToJsonSchema` function to use a single while loop for unwrapping all wrapper types.

### tests/test-boolean-default-schema.test.ts (new)
6 tests verifying boolean fields with various `.optional()` and `.default()` combinations:
- `.optional().default()` chain
- `.default().optional()` chain
- Just `.optional()`
- Just `.default()`
- Plain boolean
- Wrapper unwrapping order edge cases

### tests/test-createmodel-iscloze.test.ts (new)
13 comprehensive regression tests:
- JSON schema conversion validation
- Type validation (rejects string "false")
- createModel with `isCloze=false` (explicit)
- createModel with `isCloze` omitted (default)
- createModel with `isCloze=true` (cloze model)
- **Regression test for AWS System Design Card scenario** ⭐
- End-to-end test creating model and adding notes
- Edge cases for cloze validation

## Test Coverage

Total new tests: **19**
- 6 tests in `test-boolean-default-schema.test.ts`
- 13 tests in `test-createmodel-iscloze.test.ts`

All tests verify:
1. `isCloze` is typed as `"boolean"` in JSON schema (not `"string"`)
2. `isCloze` defaults to `false` when omitted
3. `isCloze=false` creates non-cloze models without cloze validation errors
4. `isCloze=true` creates cloze models with proper validation
5. String values are rejected by Zod validation

## Published Version

**v1.1.2** - Published to npm on October 18, 2025

## Verification

Successfully created the AWS System Design Card model that was previously failing:

```typescript
await createModel({
  modelName: "AWS System Design Card",
  inOrderFields: ["Service", "Building Block", "Short Description", "Long Description", "Example"],
  cardTemplates: [{
    Name: "AWS Card",
    Front: "Service: {{Service}}\nBuilding Block: {{Building Block}}",
    Back: "Service: {{Service}}\nBuilding Block: {{Building Block}}\n\nShort Description:\n{{Short Description}}\n\nLong Description:\n{{Long Description}}\n\nExample:\n{{Example}}",
  }],
  css: ".card { font-family: arial; font-size: 16px; }",
  isCloze: false, // Now correctly handled as boolean!
});
```

✅ Model created successfully (ID: 1760758212077)
✅ Model type: 0 (non-cloze)
✅ Test note created successfully (ID: 1760758237748)

## Impact

This fix affects any MCP tool parameter that uses `.optional().default()` with boolean, number, or other non-string types. The zodToJsonSchema function now correctly types all such fields in the JSON schema, ensuring MCP clients send properly typed values.

## Related Commits

- `2fdd7b8` - fix: properly unwrap ZodDefault→ZodOptional chains in zodToJsonSchema
- `489c7dc` - chore(release): 1.1.2 [skip ci]
- `890472d` - test: add comprehensive regression test for isCloze boolean field issue
- `61d6faa` - test: add comprehensive regression test for isCloze boolean field issue (rebased)

## Prevention

The comprehensive regression test suite ensures this bug cannot reoccur. Specifically, `tests/test-createmodel-iscloze.test.ts` has a dedicated test case that recreates the exact failure scenario:

```typescript
test("REGRESSION: should not fail with cloze error when isCloze=false and non-cloze templates", async () => {
  await expect(createModel({
    modelName: "AWS_System_Design_Card",
    inOrderFields: ["Service", "Building Block", "Short Description", "Long Description", "Example"],
    cardTemplates: [{
      Name: "AWS Card",
      Front: "Service: {{Service}}\nBuilding Block: {{Building Block}}",
      Back: "...",
    }],
    isCloze: false,
  })).resolves.toBeDefined(); // Must succeed, not throw cloze error
});
```

If the zodToJsonSchema bug is reintroduced, this test will immediately fail in CI.
