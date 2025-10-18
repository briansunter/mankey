# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mankey** is an MCP (Model Context Protocol) server that connects AI assistants to Anki via Anki-Connect. It provides 45 comprehensive tools for creating flashcards, managing reviews, analyzing learning data, and automating Anki workflows.

## Runtime & Commands

Use **Bun** (not Node.js) for all operations:

```bash
# Development
bun run src/index.ts              # Start MCP server
bun --watch src/index.ts          # Development with watch mode
bun run build                     # Build to dist/
bun run typecheck                 # Type checking only

# Testing
bun test                          # Run all tests
bun test tests/test-NAME.test.ts  # Run specific test file
bun test --watch                  # Watch mode
bun test:e2e                      # All E2E tests
bun test:e2e:basic                # Just connectivity tests
bun test:e2e:tags                 # Just tag handling tests

# Code Quality
bun run lint                      # Run ESLint
bun run lint:fix                  # Auto-fix linting issues

# Publishing (automated via semantic-release)
git commit -m "fix: description"  # Triggers patch release
git commit -m "feat: description" # Triggers minor release
git push                          # GitHub Actions publishes to npm
```

## Architecture

### Core Components

**src/index.ts** (~2000 lines) - Single-file MCP server containing:

1. **Anki-Connect Client** (lines 1-200)
   - `ankiConnect()` - HTTP client for Anki-Connect API
   - `normalizeTags()` - Handles tags as arrays, strings, or JSON
   - `normalizeFields()` - Handles fields as objects or JSON strings
   - `normalizeIds()` - Converts between string/number IDs

2. **zodToJsonSchema Converter** (lines 228-344)
   - Converts Zod schemas to JSON Schema for MCP clients
   - **CRITICAL**: Uses single while loop to unwrap `ZodOptional` and `ZodDefault` wrappers
   - Must handle `.optional().default()` chains correctly (see tests/test-boolean-default-schema.test.ts)
   - Bug history: Separate loops caused boolean→string type conversion (v1.1.2 fix)

3. **Tool Definitions** (lines 346-1800)
   - 45 tools organized by category: Decks, Notes, Cards, Models, Media, Stats
   - Each tool has: `description`, `schema` (Zod), `handler` (async function)
   - Smart features:
     - **Auto-batching**: Operations >100 items split automatically (e.g., `notesInfo`, `cardsInfo`)
     - **Pagination**: `findCards`, `findNotes`, `deckNames`, etc. support offset/limit
     - **Queue priority**: `getNextCards` respects Learning → Review → New order
     - **Smart normalization**: Tags/IDs work in any format

4. **MCP Server Setup** (lines 1800-2000)
   - Registers all tools with MCP SDK
   - Handles `tools/list` and `tools/call` requests
   - stdio transport for communication

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

3. Verify: `npm view mankey version`

**Known Issue**: Commitlint footer length
- Semantic-release generates long URLs that exceed 100 chars
- Solution: `commitlint.config.cjs` disables `footer-max-line-length`

## Common Development Tasks

### Adding a New Tool

1. Define in `src/index.ts` tool definitions section:
```typescript
toolName: {
  description: "Clear description for AI",
  schema: z.object({
    param: z.string().describe("What this param does"),
  }),
  handler: async (args) => {
    // Normalize inputs if needed
    const normalized = normalizeTags(args.tags);

    // Call Anki-Connect
    return ankiConnect("ankiAction", args);
  },
}
```

2. Add to `AnkiConnectResponses` type if needed

3. Write tests in `tests/test-NAME.test.ts`

4. Update tool count in README.md

### Fixing a Bug

1. Write failing test first in appropriate test file
2. Fix in `src/index.ts`
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
- `zod` - Schema validation and type inference

**Development**:
- `typescript` - Type checking
- `eslint` - Linting
- `semantic-release` - Automated publishing
- `husky` - Git hooks for commitlint

No frontend dependencies - this is a CLI tool that runs as MCP server.
