# Anki-AI Tests

This directory contains the test suite for the Anki-AI MCP server.

## Mock Anki-Connect Server

For CI/CD environments where Anki is not available, we provide a mock Anki-Connect server that implements stub responses for all API endpoints.

### Usage

Start the mock server:

```bash
bun tests/mock-anki-server.ts
```

The server will run on http://127.0.0.1:8765 (the same port as the real Anki-Connect).

### Running Tests

With a real Anki instance:

```bash
# Ensure Anki is running with Anki-Connect addon installed
bun test
```

With the mock server (for CI/CD):

```bash
# Start mock server in background
bun tests/mock-anki-server.ts &
MOCK_PID=$!

# Run tests
bun test

# Clean up
kill $MOCK_PID
```

### Mock Server Features

The mock server provides:

- Full CRUD operations for notes and cards
- In-memory storage that persists for the server's lifetime
- Support for all major Anki-Connect API endpoints
- Realistic response formats matching Anki-Connect v6

### Limitations

The mock server is designed for testing basic functionality and does not:

- Persist data between restarts
- Implement Anki's complex scheduling algorithms
- Validate deck/model relationships as strictly as real Anki
- Support all edge cases and error conditions

For comprehensive testing, use a real Anki instance.

## Test Categories

- `test-anki-connect.test.ts` - Core Anki-Connect API integration tests
- `test-edge-cases.test.ts` - Edge case handling
- `test-fixes.test.ts` - Regression tests for bug fixes
- `test-pagination.test.ts` - Pagination functionality
- `test-queue-priority.test.ts` - Card queue and priority testing
- `test-real-operations.test.ts` - Real-world operation workflows
- `test-tags.test.ts` - Tag management
- `test-utils.test.ts` - Utility function tests
- `test-npm-packaging.test.ts` - NPM package validation

## CI/CD Integration

The GitHub Actions workflow automatically:

1. Starts the mock Anki-Connect server before tests
2. Runs all tests against the mock server
3. Cleans up the mock server after tests complete

This ensures tests can run in any environment without requiring Anki installation.
