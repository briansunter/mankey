# Anki MCP E2E Tests

Comprehensive end-to-end tests for the Anki MCP server against a real Anki instance.

## Prerequisites

1. **Anki Desktop** must be running
2. **Anki-Connect** plugin installed (code: `2055492159`)
3. **Bun** runtime installed

## Running Tests

```bash
# Run all E2E tests
bun test:e2e

# Run specific test suite
bun test:e2e:basic      # Basic connectivity tests
bun test:e2e:tags       # Tag handling tests
bun test:e2e:fixes      # Return value consistency tests
bun test:e2e:real       # Real operations tests
bun test:e2e:pagination # Pagination tests
bun test:e2e:queue      # Queue priority tests

# Run with test runner (includes connection check)
bun test:e2e:all

# Watch mode for development
bun test:e2e:watch
```

## Test Suites

### 1. Basic Connectivity (`test-anki-connect.test.ts`)
- Anki-Connect connection verification
- Basic CRUD operations for notes, cards, decks
- Model and media operations
- Collection statistics

### 2. Tag Handling (`test-tags.test.ts`)
- Tag normalization (arrays, JSON strings, space-separated)
- Bulk tag operations
- Tag replacement and cleanup
- Edge cases (special characters, duplicates)

### 3. Return Value Consistency (`test-fixes.test.ts`)
- Verifies all operations return correct types
- Tests `true`/`false` returns for success operations
- Validates array returns for batch operations
- Checks ID returns for creation operations

### 4. Real Operations (`test-real-operations.test.ts`)
- Complete lifecycle tests (create → update → delete)
- Bulk operations with large datasets
- Card state management (suspend, learning, review)
- Error handling for invalid operations

### 5. Pagination (`test-pagination.test.ts`)
- Tests pagination for `findCards` and `findNotes`
- Verifies offset/limit functionality
- Tests edge cases (zero limit, beyond total)
- Performance with large datasets

### 6. Queue Priority (`test-queue-priority.test.ts`)
- Learning → Review → New card priority
- Queue state transitions
- Deck-specific queue management
- Suspended/buried card handling

## Test Utilities (`test-utils.ts`)

Shared helper functions for all tests:
- `ankiConnect()` - Direct Anki-Connect API calls
- `createTestNote()` - Create test notes with cleanup
- `createTestDeck()` - Create test decks
- `setupTestEnvironment()` - Initialize test environment
- `normalizeTags()` - Tag format normalization
- Various card/note management helpers

## Environment Variables

```bash
ANKI_CONNECT_URL=http://127.0.0.1:8765  # Anki-Connect URL
ANKI_API_KEY=your_api_key              # Optional API key
```

## Test Structure

Each test suite follows Jest/Bun test patterns:
```typescript
describe("Suite Name", () => {
  beforeAll(async () => {
    // Setup
  });
  
  test("should do something", async () => {
    // Test logic
    expect(result).toBe(expected);
  });
  
  afterAll(async () => {
    // Cleanup
  });
});
```

## Coverage

Run tests with coverage:
```bash
bun test --coverage
```

## Troubleshooting

### Cannot connect to Anki-Connect
1. Ensure Anki is running
2. Install Anki-Connect: Tools → Add-ons → Get Add-ons → Code: `2055492159`
3. Restart Anki after installation
4. Accept permission dialog on first connection

### Tests timeout
- Increase timeout in `bunfig.toml`
- Check Anki isn't frozen
- Verify no modal dialogs blocking Anki

### macOS specific issues
Disable App Nap if Anki stops responding in background:
```bash
defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
```