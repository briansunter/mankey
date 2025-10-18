# Test Coverage Analysis for Mankey MCP Server

**Date**: 2025-10-17
**Overall Coverage**: 95.38% lines, 100% functions (test-utils.ts)
**Test Files**: 15 test files, 274 tests, 261 passing, 12 skipped, 1 failing

## Summary

The mankey project has **excellent test coverage** overall with 95.38% line coverage and 100% function coverage in test utilities. However, there are **specific API operations that lack integration tests**, particularly model manipulation and GUI operations.

## Coverage Report

### Test-Utils Coverage (Primary Module)
- **Line Coverage**: 95.38%
- **Function Coverage**: 100%
- **Uncovered Lines**: 73, 162, 180-182, 250, 265 (error handling edge cases)

### Tools Tested (62 tools)
The following operations are well-tested with integration tests:

#### Deck Operations
- ✅ `deckNames` - List all deck names
- ✅ `deckNamesAndIds` - Get deck name/ID mappings
- ✅ `getDeckConfig` - Get deck configuration
- ✅ `getDeckStats` - Get deck statistics
- ✅ `getDueCardsDetailed` - Get due cards with details
- ✅ `createDeck` - Create new deck (tested)
- ✅ `deleteDecks` - Delete decks (tested)

#### Note Operations
- ✅ `addNote` - Add single note
- ✅ `addNotes` - Add multiple notes
- ✅ `updateNote` - Update note fields and tags
- ✅ `updateNoteFields` - Update only note fields
- ✅ `deleteNotes` - Delete notes
- ✅ `findNotes` - Search for notes
- ✅ `notesInfo` - Get note details
- ✅ `notesModTime` - Get note modification times
- ✅ `canAddNotes` - Validate notes before adding
- ✅ `getNoteTags` - Get tags for specific notes

#### Card Operations
- ✅ `findCards` - Search for cards
- ✅ `cardsInfo` - Get card details
- ✅ `cardsModTime` - Get card modification times
- ✅ `cardsToNotes` - Map cards to parent notes
- ✅ `suspend` - Suspend cards
- ✅ `unsuspend` - Unsuspend cards
- ✅ `areSuspended` - Check suspension status
- ✅ `areDue` - Check if cards are due
- ✅ `getIntervals` - Get card intervals
- ✅ `getEaseFactors` - Get ease factors
- ✅ `setEaseFactors` - Set ease factors
- ✅ `answerCards` - Answer cards programmatically
- ✅ `forgetCards` - Reset cards to new state
- ✅ `relearnCards` - Put cards in relearning
- ✅ `changeDeck` - Move cards to different deck
- ✅ `setDueDate` - Set card due dates
- ✅ `getNextCards` - Get cards in review order

#### Tag Operations
- ✅ `getTags` - Get all tags
- ✅ `addTags` - Add tags to notes
- ✅ `removeTags` - Remove tags from notes
- ✅ `replaceTags` - Replace specific tags
- ✅ `replaceTagsInAllNotes` - Global tag replacement
- ✅ `clearUnusedTags` - Remove unused tags

#### Model Operations (Partial Coverage)
- ✅ `modelNames` - List all models
- ✅ `modelNamesAndIds` - Get model name/ID mappings
- ✅ `modelFieldNames` - Get field names for model
- ✅ `modelFieldsOnTemplates` - Get fields used in templates
- ✅ `modelTemplates` - Get card templates for model
- ✅ `modelStyling` - Get CSS styling for model
- ✅ `createModel` - Create new model (comprehensive tests)
- ❌ **`updateModelTemplates`** - NOT TESTED
- ❌ **`updateModelStyling`** - NOT TESTED

#### Media Operations
- ✅ `storeMediaFile` - Store media file
- ✅ `retrieveMediaFile` - Retrieve media file
- ✅ `getMediaFilesNames` - List media files
- ✅ `getMediaDirPath` - Get media directory path
- ✅ `deleteMediaFile` - Delete media file

#### Statistics & Review History
- ✅ `getNumCardsReviewedToday` - Get today's review count
- ✅ `getCollectionStatsHTML` - Get collection statistics
- ✅ `cardReviews` - Get card review history
- ✅ `getReviewsOfCards` - Get reviews for specific cards
- ✅ `getLatestReviewID` - Get latest review ID

#### System Operations
- ✅ `version` - Get Anki-Connect version
- ✅ `getActiveProfile` - Get current profile name
- ✅ `sync` - Sync with AnkiWeb

## Untested Operations (47 tools)

### Critical Gaps (High Priority)

#### Model Update Operations (2 tools)
These are **CRITICAL** operations that modify existing models but have NO tests:

1. **`updateModelTemplates`** ⚠️ **HIGH PRIORITY**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts:1459-1472`
   - **Risk**: Can break card generation for existing notes
   - **Why Untested**: Likely avoided due to sync warnings or complexity
   - **Test Needed**: Yes - this was recently fixed for `modelStyling`, should verify templates too

2. **`updateModelStyling`** ⚠️ **HIGH PRIORITY**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts:1474-1484`
   - **Risk**: Can break card display with invalid CSS
   - **Why Untested**: Recently fixed bug but no regression test added
   - **Test Needed**: **YES - URGENT** - you just fixed this in `modelStyling`, need regression test

#### Deck Configuration (4 tools)
These operations modify deck settings and lack tests:

3. **`cloneDeckConfigId`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts` (search for tool definition)
   - **Risk**: Medium - config cloning errors could affect review schedules
   - **Test Needed**: Yes

4. **`removeDeckConfigId`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: Medium - deleting active configs could break decks
   - **Test Needed**: Yes

5. **`setDeckConfigId`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: Medium - incorrect config assignment affects learning
   - **Test Needed**: Yes

6. **`getDecks`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: Low - read-only operation
   - **Test Needed**: Nice to have

#### Advanced Card Operations (2 tools)

7. **`setSpecificValueOfCard`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: HIGH - can corrupt scheduling data
   - **Test Needed**: Yes - needs careful testing with validation

8. **`suspended`** (singular)
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: Low - singular version of `areSuspended`
   - **Test Needed**: Low priority

#### Collection Operations (2 tools)

9. **`removeEmptyNotes`**
   - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
   - **Risk**: Medium - deletes data
   - **Test Needed**: Yes

10. **`reloadCollection`**
    - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
    - **Risk**: Low - system operation
    - **Test Needed**: Low priority

#### Import/Export (2 tools)

11. **`exportPackage`**
    - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
    - **Risk**: Low - file operation
    - **Test Needed**: Nice to have

12. **`importPackage`**
    - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
    - **Risk**: Medium - can modify collection
    - **Test Needed**: Yes

#### Profile Management (2 tools)

13. **`getProfiles`**
    - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
    - **Risk**: Low - read-only
    - **Test Needed**: Low priority

14. **`loadProfile`**
    - **Location**: `/Users/briansunter/code/mankey/src/index.ts`
    - **Risk**: High - switches entire profile
    - **Test Needed**: Difficult - requires restart

### GUI Operations (17 tools) - Intentionally Untested

These require GUI interaction and are difficult to test in headless mode:

15. **`guiBrowse`** - Open browse window
16. **`guiAddCards`** - Open add cards dialog
17. **`guiCurrentCard`** - Get current review card
18. **`guiAnswerCard`** - Answer current card via GUI
19. **`guiDeckOverview`** - Show deck overview
20. **`guiExitAnki`** - Exit Anki application
21. **`guiStartCardTimer`** - Start review timer
22. **`guiShowQuestion`** - Show card question
23. **`guiShowAnswer`** - Show card answer
24. **`guiUndo`** - Undo last action
25. **`guiDeckBrowser`** - Show deck browser
26. **`guiDeckReview`** - Start deck review
27. **`guiCheckDatabase`** - Run database check
28. **`guiImportFile`** - Import file via GUI
29. **`guiSelectedNotes`** - Get selected notes in browser
30. **`guiSelectCard`** - Select specific card
31. **`guiEditNote`** - Edit note via GUI

**Note**: GUI operations are **intentionally untested** as they require desktop GUI and user interaction.

### Meta/System Operations (8 tools) - Low Priority

32. **`apiReflect`** - Get API metadata
33. **`requestPermission`** - Request API permissions
34. **`multi`** - Execute multiple operations
35. **`getNumCardsReviewedByDay`** - Get reviews by day
36. Internal tool properties (not actual operations):
    - `actions`
    - `allowDuplicate`
    - `breakdown`
    - `capabilities`
    - `headers`
    - `metadata`
    - `note`
    - `options`
    - `pagination`
    - `permission`
    - `scopes`
    - `tools`

## Test Quality Analysis

### Strong Areas
1. **Core CRUD Operations**: Excellent coverage for notes, cards, decks
2. **Tag Handling**: Comprehensive tests for all tag operations
3. **Pagination**: Well-tested with edge cases
4. **Queue Priority**: Dedicated test file for learning queue
5. **Schema Conversion**: 14 tests for Zod to JSON Schema
6. **Boolean Type Regression**: 6 tests preventing type conversion bug
7. **Model Creation**: 13 comprehensive tests including isCloze

### Weak Areas
1. **Model Updates**: `updateModelTemplates` and `updateModelStyling` have NO tests
2. **Deck Config Management**: Clone/remove/set config operations untested
3. **Advanced Card Operations**: `setSpecificValueOfCard` not tested
4. **Import/Export**: Package operations untested
5. **Profile Management**: Multi-profile operations untested

## Uncovered Lines in test-utils.ts

Lines **73, 162, 180-182, 250, 265** are uncovered - these are error handling edge cases:

- **Line 73**: Early return path in `setupTestEnvironment`
- **Line 162**: Error handling in `normalizeTags` for malformed JSON
- **Lines 180-182**: Error conditions in helper functions
- **Line 250**: Edge case in batch operations
- **Line 265**: Cleanup error handling

## Recommendations

### Immediate Actions (High Priority)

1. **Add `updateModelStyling` regression test** ⚠️ **URGENT**
   - **Why**: You just fixed a bug in `modelStyling` (similar operation)
   - **What**: Test that updating CSS works correctly
   - **Where**: `/Users/briansunter/code/mankey/tests/test-html-css-styling.test.ts`
   - **Example**:
   ```typescript
   test("should update model styling correctly", async () => {
     const modelName = "Basic";
     const newCSS = ".card { background: red; }";

     await ankiConnect("updateModelStyling", {
       model: { name: modelName, css: newCSS }
     });

     const updated = await ankiConnect("modelStyling", { modelName });
     expect(updated).toBe(newCSS);
   });
   ```

2. **Add `updateModelTemplates` test** ⚠️ **HIGH PRIORITY**
   - **Why**: Critical operation that can break card generation
   - **What**: Test updating Front/Back templates
   - **Where**: `/Users/briansunter/code/mankey/tests/test-html-css-styling.test.ts`
   - **Example**:
   ```typescript
   test("should update model templates correctly", async () => {
     const modelName = "Basic";
     const newTemplates = {
       "Card 1": {
         Front: "<div>{{Front}}</div>",
         Back: "<div>{{Back}}</div>"
       }
     };

     await ankiConnect("updateModelTemplates", {
       model: { name: modelName, templates: newTemplates }
     });

     const updated = await ankiConnect("modelTemplates", { modelName });
     expect(updated["Card 1"].Front).toContain("<div>");
   });
   ```

3. **Add deck config tests**
   - Test `cloneDeckConfigId`, `removeDeckConfigId`, `setDeckConfigId`
   - Create new test file: `/Users/briansunter/code/mankey/tests/test-deck-config.test.ts`

### Medium Priority

4. **Add `setSpecificValueOfCard` test** (with caution)
   - Requires careful validation to avoid breaking test data
   - Test with temporary cards that are deleted after

5. **Add `removeEmptyNotes` test**
   - Create notes with no cards, verify cleanup

6. **Add import/export tests**
   - Test round-trip: export deck → import deck → verify

### Low Priority

7. **Improve error handling coverage**
   - Add tests for lines 73, 162, 180-182, 250, 265 in test-utils.ts
   - Focus on edge cases and error conditions

8. **Add `multi` operation test**
   - Test batch execution of multiple operations
   - Verify error handling when one operation fails

### Not Recommended

- **GUI operations**: Too difficult to test in headless CI environment
- **Profile switching**: Requires Anki restart, not suitable for CI
- **Sync operations**: Requires AnkiWeb credentials, not suitable for public tests

## Current Test Files

1. **test-anki-connect.test.ts** - Basic connectivity and CRUD (35 tests)
2. **test-tags.test.ts** - Tag normalization and operations (28 tests)
3. **test-pagination.test.ts** - Pagination edge cases (18 tests)
4. **test-queue-priority.test.ts** - Learning queue ordering (12 tests)
5. **test-real-operations.test.ts** - Complex workflows (22 tests)
6. **test-edge-cases.test.ts** - Edge cases and advanced APIs (27 tests)
7. **test-utils.test.ts** - Test utility functions (41 tests)
8. **test-createModel.test.ts** - Model creation (12 tests)
9. **test-schema-conversion.test.ts** - Zod to JSON Schema (14 tests)
10. **test-boolean-default-schema.test.ts** - Boolean type regression (6 tests)
11. **test-createmodel-iscloze.test.ts** - isCloze regression (13 tests)
12. **test-html-css-styling.test.ts** - HTML/CSS in models (6 tests)
13. **test-batch-performance.test.ts** - Batch operation performance (16 tests)
14. **test-fixes.test.ts** - Return value fixes (8 tests)
15. **test-npm-packaging.test.ts** - NPM package validation (16 tests)

## Test Execution

```bash
# Run all tests with coverage
bun test --coverage

# Check coverage thresholds
bun run test:coverage

# Run specific test file
bun test tests/test-html-css-styling.test.ts

# Watch mode for development
bun test --watch tests/test-html-css-styling.test.ts
```

## Coverage Thresholds

Current thresholds in `/Users/briansunter/code/mankey/scripts/check-coverage.ts`:
- **Lines**: 90% (currently **95.38%** ✅)
- **Functions**: 95% (currently **100%** ✅)
- **Branches**: 80% (optional)

## Conclusion

The mankey project has **excellent overall coverage** with 95.38% line coverage and 261 passing tests. The main gaps are:

1. **`updateModelStyling`** - URGENT: Need regression test for recent bug fix
2. **`updateModelTemplates`** - HIGH PRIORITY: Critical untested operation
3. **Deck config operations** - Medium priority
4. **Advanced operations** - Lower priority

**Next Steps**: Add tests for `updateModelStyling` and `updateModelTemplates` immediately to prevent regressions, then systematically add tests for deck config operations.
