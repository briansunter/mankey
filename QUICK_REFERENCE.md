# Mankey - Quick Reference Guide

## Project at a Glance

**What**: MCP (Model Context Protocol) server for Anki integration  
**Status**: Production-ready, published on npm  
**Size**: 1 main file (1,732 lines TypeScript)  
**Compiled Size**: 146.9 kB  
**Runtime**: Node.js >=18.0.0  

## Installation & Execution

### Install Locally
```bash
npm install mankey
```

### Run via npx (recommended)
```bash
npx mankey
```

### Run via bunx (Bun runtime)
```bash
bunx mankey
```

### Integration with Claude Desktop
```json
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["mankey"]
    }
  }
}
```

## Build Commands

```bash
bun run build           # Compile TypeScript to JavaScript
bun run typecheck       # Type check without building
bun run dev             # Watch mode development
bun test                # Run all tests
bun run lint            # Check code style
bun run lint:fix        # Auto-fix code style
```

## Key Files

| Path | Purpose |
|------|---------|
| `/src/index.ts` | Main source (1,732 lines) |
| `/dist/index.js` | Compiled executable with shebang |
| `/dist/index.d.ts` | TypeScript declarations |
| `/package.json` | Package config with bin entry |
| `/tsconfig.json` | TypeScript compiler settings |
| `/tests/` | 8 test suites |

## Entry Points (package.json)

```json
{
  "main": "dist/index.js",        // CLI executable (npx/bunx)
  "module": "src/index.ts",       // For bundlers
  "types": "dist/index.d.ts",     // Type definitions
  "bin": { "mankey": "dist/index.js" }  // CLI command
}
```

## What Gets Published to npm

```
dist/
├── index.js         (Executable with shebang)
├── index.d.ts       (Type definitions)
├── index.js.map     (Source map)
└── index.d.ts.map   (Declaration map)
README.md
LICENSE
```

## Tool Categories (45 total)

- **Decks** (7): Create, delete, get stats, config
- **Notes** (10): Add, update, find, tag operations
- **Cards** (15): Find, suspend, get info, answer
- **Models** (5): Get names, fields, templates
- **Media** (3): Store, retrieve, delete files
- **Stats** (5): Review counts, HTML stats
- **GUI** (5): Browse, add cards, answer cards

## Dependencies

**Runtime** (2 only):
- `@modelcontextprotocol/sdk` - MCP protocol
- `zod` - Schema validation

**Dev** (13 total):
- TypeScript, ESLint, Husky, semantic-release, etc.

## Configuration

### Environment Variables
```bash
ANKI_CONNECT_URL=http://127.0.0.1:8765    # Default Anki port
DEBUG=true                                   # Enable debug logging
```

### Node.js Requirements
```json
{
  "node": ">=18.0.0",
  "bun": ">=1.0.0"   // Optional, for development
}
```

## How It Works

1. **TypeScript Source**: `src/index.ts`
   - Contains shebang: `#!/usr/bin/env node`
   - 45 MCP tools for Anki operations
   - MCP server on stdio transport

2. **Build**: Compiles to `dist/index.js`
   - ES2022 modules (import/export)
   - Full source maps and type declarations
   - Shebang preserved for executable

3. **Distribution**: Published to npm
   - Only `dist/`, README, LICENSE included
   - 146.9 kB total size
   - Works with npx/bunx/npm install

4. **Execution**: When run via npx
   - Node.js executes `dist/index.js`
   - Shebang starts Node.js process
   - MCP server connects to Anki-Connect
   - Listens for MCP protocol messages on stdio

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `command not found: mankey` | Try `npx mankey` instead |
| Connection refused | Ensure Anki is running with Anki-Connect |
| Permission denied | Check Node.js version >= 18 |
| ES module error | Verify `"type": "module"` in package.json |

## Verification

### Check build output
```bash
head -1 dist/index.js        # Should see: #!/usr/bin/env node
file dist/index.js           # Should show: script executable
```

### Test execution
```bash
npm run build                # Compile
node dist/index.js           # Run directly (will hang, that's normal)
```

### Run tests
```bash
bun test                     # All tests
bun test:e2e:basic          # Basic connectivity
bun test:e2e:coverage       # With coverage
```

## Recommendations

1. **For Production**: Use `npx mankey` in Claude Desktop config
2. **For Development**: Use `bun run dev` for watch mode
3. **Before Release**: Run `bun test && bun run lint`
4. **Version Bump**: Uses semantic-release (automatic)

## Links

- Repository: https://github.com/briansunter/mankey
- npm Package: https://www.npmjs.com/package/mankey
- MCP Spec: https://modelcontextprotocol.io
- Anki-Connect: https://github.com/FooSoft/anki-connect

## Summary

Mankey is a well-structured, production-ready MCP server:
- Single focused source file (1,732 lines)
- Minimal dependencies (2 runtime)
- Comprehensive test coverage
- Proper npm/npx/bunx configuration
- Successfully published and maintained

**Status**: Ready to use ✅
