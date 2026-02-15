# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anki-AI** is an MCP server and CLI for Anki integration via Anki-Connect. It provides 96 tools across 8 categories for creating flashcards, managing reviews, analyzing learning data, and automating Anki workflows. Ships compiled JS via npm (`npx anki-ai`), uses Bun for development.

## Runtime & Commands

Use **Bun** (not Node.js) for all operations:

```bash
# Development
bun bin/anki-ai.ts mcp             # Start MCP server (Bun, fast)
bun run dev                       # Watch mode MCP server
bun run build                     # Compile to dist/ (tsc)
bun run typecheck                 # Type checking only

# CLI (development)
bun bin/anki-ai.ts deck list       # Use Bun entry point
bun bin/anki-ai.ts tools           # List all 96 tools
bun bin/anki-ai.ts run version     # Run any tool

# CLI (published, Node.js)
npx anki-ai deck list              # Uses compiled dist/main.js
npx anki-ai tools

# Testing
bun test                          # Run all tests
bun test tests/test-NAME.test.ts  # Run specific test file
bun test --watch                  # Watch mode
bun test:e2e                      # All E2E tests

# Code Quality
bun run lint                      # Run Biome linter
bun run lint:fix                  # Auto-fix linting issues

# Publishing (automated via release-please)
git commit -m "fix: description"  # Triggers patch release
git commit -m "feat: description" # Triggers minor release
git push                          # GitHub Actions publishes to npm
```

## Architecture

### Core Components

```
bin/anki-ai.ts              # Bun development entry point (#!/usr/bin/env bun)
src/
  main.ts                  # CLI entry point → compiles to dist/main.js (#!/usr/bin/env node)
  index.ts                 # MCP-only entry point (backward compat)
  shared/
    config.ts              # ANKI_CONNECT_URL, VERSION, DEBUG, debug()
    anki-connect.ts        # ankiConnect() + AnkiConnectError
    normalize.ts           # normalizeTags(), normalizeFields(), _encodeBase64()
    schema.ts              # zodToJsonSchema() (bug-sensitive, single while loop)
    types.ts               # ToolDef interface, AnkiConnectResponses
  tools/
    index.ts               # Aggregates all 96 tools from category files
    decks.ts (6)           # deckNames, createDeck, getDeckStats, etc.
    notes.ts (16)          # addNote, findNotes, notesInfo, updateNote, etc.
    cards.ts (19)          # findCards, getNextCards, cardsInfo, answerCards, etc.
    models.ts (9)          # modelNames, createModel, modelFieldNames, etc.
    media.ts (5)           # storeMediaFile, retrieveMediaFile, etc.
    stats.ts (7)           # getNumCardsReviewedToday, getDueCardsDetailed, etc.
    gui.ts (17)            # guiBrowse, guiAddCards, guiDeckReview, etc.
    system.ts (17)         # sync, exportPackage, multi, setDueDate, etc.
  cli/
    index.ts               # createProgram() factory with Commander.js
    run.ts                 # Generic: anki-ai run <tool> [json]
    tools-list.ts          # anki-ai tools [--category X] [--json]
    decks.ts, notes.ts, cards.ts, models.ts, stats.ts  # Category subcommands
  mcp/
    server.ts              # createServer() factory
    start.ts               # startMcpServer() with stdio transport
```

**Key design**: Tool handlers throw `AnkiConnectError` (not McpError). The MCP layer catches and wraps. CLI layer catches and prints.

Each tool has: `description`, `schema` (Zod), `handler` (async function). Smart features:
- **Auto-batching**: Operations >100 items split automatically
- **Pagination**: `findCards`, `findNotes`, `deckNames`, etc. support offset/limit
- **Queue priority**: `getNextCards` respects Learning > Review > New order
- **Smart normalization**: Tags/IDs work in any format

### Key Architectural Patterns

#### 1. Flexible Input Normalization
All tools accept multiple input formats for tags and IDs:
```typescript
// Tags can be:
["tag1", "tag2"]           // Array
"tag1 tag2"                // Space-separated string
'["tag1", "tag2"]'         // JSON string

// IDs can be:
[1234, 5678]               // Number array
["1234", "5678"]           // String array
```

#### 2. Pagination Pattern
```typescript
// Request:
{ query: "deck:current", offset: 0, limit: 100 }

// Response includes:
{
  cards: [...],
  pagination: {
    total: 500,
    offset: 0,
    limit: 100,
    hasMore: true,
    nextOffset: 100
  }
}
```

#### 3. Auto-batching Pattern
Operations automatically split when >100 items:
```typescript
// notesInfo with 250 IDs → splits into 3 requests of 100, 100, 50
await ankiConnect("notesInfo", { notes: [250 IDs] });
// Internally: batch1(100) + batch2(100) + batch3(50)
```

## Testing Architecture

### Test Categories

**tests/test-utils.ts** - Shared utilities:
- `ankiConnect()` - Direct Anki-Connect client with pagination support
- `setupTestEnvironment()` - Verifies Anki is running
- `createTestNotes()` - Batch create notes for testing
- `cleanupTestData()` - Remove test notes/decks

**Integration Tests** (require Anki running):
- `test-anki-connect.test.ts` - Basic connectivity, CRUD operations
- `test-tags.test.ts` - Tag normalization, bulk operations
- `test-pagination.test.ts` - Pagination edge cases
- `test-queue-priority.test.ts` - Learning queue ordering
- `test-real-operations.test.ts` - Complex multi-step workflows

**Regression Tests**:
- `test-createModel.test.ts` - Model creation (12 tests)
- `test-schema-conversion.test.ts` - zodToJsonSchema (14 tests)
- `test-boolean-default-schema.test.ts` - Boolean field type conversion (6 tests)
- `test-createmodel-iscloze.test.ts` - **CRITICAL**: isCloze regression (13 tests)
  - Prevents bug where boolean→string conversion caused cloze validation errors
  - Tests `.optional().default()` chain handling

### Running Tests

Tests require:
1. Anki Desktop running
2. Anki-Connect add-on installed (code: `2055492159`)
3. Default deck exists

```bash
# Run all tests
bun test

# Run single test file
bun test tests/test-tags.test.ts

# Run specific test
bun test -t "should normalize tags"

# Watch mode for development
bun test --watch tests/test-NAME.test.ts
```

## Critical Implementation Details

### zodToJsonSchema Unwrapping

**MUST use single while loop** to unwrap Zod wrappers:

```typescript
// CORRECT (current implementation)
while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
  if (field instanceof z.ZodOptional) {
    isOptional = true;
    field = field._def.innerType;
  } else if (field instanceof z.ZodDefault) {
    field = field._def.innerType;
  }
}

// WRONG (causes boolean→string bug)
while (field instanceof z.ZodOptional) { /* unwrap */ }
while (field instanceof z.ZodDefault) { /* unwrap */ }
```

Why: `.optional().default()` creates `ZodDefault(ZodOptional(ZodBoolean))`. Separate loops fail to fully unwrap, causing type to be "string" instead of "boolean".

See: `docs/iscloze-boolean-fix-2025-10-18.md` for full bug analysis.

### Anki-Connect API Patterns

```typescript
// CREATE operations return IDs
createDeck → number
addNote → number
createModel → { id: number, ... }

// UPDATE/DELETE operations return true
updateNote → true
deleteNotes → true
suspend → true

// GET operations return data or null
findNotes → number[]
notesInfo → Array<{...}> | null
```

### Tag Handling

Anki uses space-separated tags internally, but MCP tools accept arrays:
```typescript
// User sends:
{ tags: ["japanese", "N5", "vocabulary"] }

// Converted via normalizeTags() to:
"japanese N5 vocabulary"

// Sent to Anki-Connect
```

## Publishing & Releases

**Automated via semantic-release**:

1. Commit with conventional format:
   ```bash
   git commit -m "fix: description"   # → 1.1.2 → 1.1.3
   git commit -m "feat: description"  # → 1.1.2 → 1.2.0
   git commit -m "BREAKING CHANGE"    # → 1.1.2 → 2.0.0
   ```

2. Push to master triggers GitHub Actions:
   - Analyzes commits
   - Bumps version in package.json
   - Publishes to npm
   - Creates GitHub release
   - Updates CHANGELOG.md
   - Commits version bump with `chore(release): X.X.X [skip ci]`

3. Verify: `npm view anki-ai version`

**Known Issue**: Commitlint footer length
- Semantic-release generates long URLs that exceed 100 chars
- Solution: `commitlint.config.cjs` disables `footer-max-line-length`

## Common Development Tasks

### Adding a New Tool

1. Add to the appropriate category file in `src/tools/`:
```typescript
toolName: {
  description: "Clear description for AI",
  schema: z.object({
    param: z.string().describe("What this param does"),
  }),
  handler: async (args) => {
    const normalized = normalizeTags(args.tags);
    return ankiConnect("ankiAction", args);
  },
}
```

2. Add to `AnkiConnectResponses` type in `src/shared/types.ts` if needed

3. Write tests in `tests/test-NAME.test.ts`

4. Optionally add a CLI subcommand in `src/cli/`

### Fixing a Bug

1. Write failing test first in appropriate test file
2. Fix in the relevant `src/` module
3. Verify all tests pass: `bun test`
4. Document in `docs/` if significant
5. Commit with `fix:` prefix

### Modifying zodToJsonSchema

**ALWAYS**:
- Add test in `tests/test-schema-conversion.test.ts`
- Verify `tests/test-boolean-default-schema.test.ts` still passes
- Test with `.optional()`, `.default()`, and combined chains

## Bun-Specific Patterns

```typescript
// Bun's test framework
import { test, expect, describe, beforeAll, afterAll } from "bun:test";

// Bun's fetch (built-in, no need to import)
const response = await fetch(url);

// Type checking
bun run typecheck  // Uses tsc --noEmit
```

## Environment Variables

```bash
ANKI_CONNECT_URL=http://127.0.0.1:8765  # Default
ANKI_API_KEY=                           # Optional, if configured in Anki-Connect
DEBUG=true                              # Enable debug logging to stderr
```

## Dependencies

**Runtime**:
- `@modelcontextprotocol/sdk` - MCP server framework
- `commander` - CLI framework
- `zod` - Schema validation and type inference

**Development**:
- `typescript` - Type checking and compilation
- `@biomejs/biome` - Linting and formatting

No frontend dependencies - this is a CLI tool and MCP server.

## npm Packaging

- `bin/anki-ai.ts` - Bun-only entry (development)
- `dist/main.js` - Compiled Node.js entry (`#!/usr/bin/env node`) - this is what `npx anki-ai` runs
- `dist/index.js` - MCP-only entry for programmatic use
- `prepublishOnly` runs `tsc && chmod +x dist/main.js`
- Files shipped: `dist/`, `bin/`, `src/`, `README.md`, `LICENSE`
