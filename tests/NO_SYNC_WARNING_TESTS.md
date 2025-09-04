# Anki MCP Tests - No Sync Warning Configuration

## Problem Fixed
Tests were triggering Anki's "full sync required" warning due to operations that modify the database structure.

## Operations That Cause Sync Warnings
The following operations require a full database upload and should be avoided in tests:
1. **Creating new decks** (`createDeck`)
2. **Deleting decks** (`deleteDecks`)
3. **Creating new models/note types** (`createModel`)
4. **Cloning deck configurations** (`cloneDeckConfigId`)
5. **Removing deck configurations** (`removeDeckConfigId`)

## Changes Made

### Test Utils (`test-utils.ts`)
- Deprecated `createTestDeck()` and `cleanupDeck()` functions
- Modified `setupTestEnvironment()` to verify Default deck/Basic model exist rather than creating them
- Added warnings to deprecated functions

### Test Files Updated
All test files now use the existing "Default" deck instead of creating new test decks:

1. **test-anki-connect.test.ts**
   - Removed deck creation/deletion tests
   - Tests now verify existing decks instead

2. **test-fixes.test.ts**
   - Removed deck/model creation tests
   - Tests now use Default deck only

3. **test-real-operations.test.ts**
   - Removed deck lifecycle tests
   - All operations now use Default deck

4. **test-queue-priority.test.ts**
   - Uses Default deck for all queue tests
   - Removed deck creation in setup

## Best Practices for Tests

### DO ✅
- Use the "Default" deck (always exists in Anki)
- Use the "Basic" model (standard Anki model)
- Create and delete notes only
- Modify note fields, tags, and card states
- Move cards between existing decks

### DON'T ❌
- Create new decks
- Delete decks
- Create new models/note types
- Clone or modify deck configurations
- Perform any operation that changes collection structure

## Running Tests Safely

```bash
# All tests should run without sync warnings
bun test

# Individual test suites
bun test:tags      # Safe - only modifies notes
bun test:fixes     # Safe - uses existing decks
bun test:real      # Safe - no deck creation
```

## Verification
To verify no sync warnings:
1. Run any test suite
2. Check Anki - no sync warning dialog should appear
3. Sync should work normally without requiring full upload

## Note for Future Development
If you need to test deck/model creation operations:
1. Create a separate test suite specifically for these operations
2. Warn users that these tests will require full sync
3. Run them separately from regular CI/CD tests
4. Consider using a dedicated test profile in Anki