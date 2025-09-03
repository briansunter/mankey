# Anki MCP Server

A Model Context Protocol (MCP) server for Anki, providing 45 tools for managing your Anki collection via Anki-Connect.

## Quick Start

### Prerequisites
1. **[Anki](https://apps.ankiweb.net/)** - Desktop application
2. **Anki-Connect** - Install via Anki → Tools → Add-ons → Get Add-ons → Code: `2055492159`
3. **[Bun](https://bun.sh)** - JavaScript runtime

### Installation
```bash
git clone <repository-url>
cd anky
bun install
```

### Configuration
Add to your MCP client config (e.g., Claude Desktop):
```json
{
  "mcpServers": {
    "anki": {
      "command": "bun",
      "args": ["run", "/path/to/anky/src/index.ts"]
    }
  }
}
```

## Core Features

✅ **45 comprehensive tools** covering all Anki operations  
✅ **Smart normalization** - Handles tags/IDs in any format  
✅ **Pagination** - Efficiently handle large collections  
✅ **Queue priority** - Respects Anki's learning system  
✅ **Auto-batching** - Splits large operations automatically  
✅ **TypeScript + Zod** - Full type safety and validation  

## Tool Categories

### 📇 Cards (15 tools)
- **Query**: `findCards` - Find with pagination, supports `deck:current`
- **Info**: `cardsInfo`, `cardsModTime`, `getIntervals`, `getEaseFactors`
- **State**: `suspend`, `unsuspend`, `areSuspended`, `areDue`
- **Actions**: `answerCards`, `forgetCards`, `relearnCards`, `setEaseFactors`
- **Queue**: `getNextCards` ⭐, `getDueCardsDetailed` ⭐

### 📝 Notes (10 tools)
- **CRUD**: `addNote`, `addNotes`, `updateNote`, `deleteNotes`
- **Query**: `findNotes`, `notesInfo` (auto-batched)
- **Tags**: `addTags`, `removeTags`, `getTags`, `replaceTags`

### 📚 Decks (7 tools)
- **Manage**: `createDeck`, `deleteDecks`, `deckNames`, `deckNamesAndIds`
- **Config**: `getDeckConfig`, `saveDeckConfig`, `getDeckStats`

### 🎨 Models (5 tools)
- **Query**: `modelNames`, `modelNamesAndIds`, `modelFieldNames`
- **Create**: `createModel`, `updateModelTemplates`

### 🖼️ Media (3 tools)
- `storeMediaFile`, `retrieveMediaFile`, `getMediaFilesNames`

### 📊 Stats & GUI (5 tools)
- **Stats**: `getNumCardsReviewedToday`, `getCollectionStatsHTML`, `sync`
- **GUI**: `guiBrowse`, `guiAddCards`

## Key Capabilities

### Pagination
```json
{
  "query": "deck:current is:due",
  "offset": 0,
  "limit": 100
}
// Returns: cards + {total, hasMore, nextOffset}
```

### Queue Priority
Learning → Review → New cards (via `getNextCards`)

### Auto-batching
Operations >100 items split automatically

### Flexible IDs
Both `[1234]` and `["1234"]` work

## Testing

```bash
# Core tests
bun bin/test-anki-connect.ts      # Connectivity
bun bin/test-real-operations.ts   # All operations
bun bin/test-queue-priority.ts    # Queue system
bun bin/test-pagination.ts        # Pagination

# Validation tests  
bun bin/test-fixes.ts             # Return values
bun bin/test-tags.ts              # Tag handling
```

## Project Structure

```
anky/
├── src/index.ts           # MCP server (45 tools)
├── bin/                   # Test scripts
├── docs/                  # Documentation
└── package.json          # Dependencies
```

## Troubleshooting

**Cannot connect**: Ensure Anki is running with Anki-Connect installed  
**Permission dialog**: Click "Yes" on first connection  
**macOS background**: Disable App Nap if needed:
```bash
defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
```

## Environment Variables

- `ANKI_CONNECT_URL` - Default: `http://127.0.0.1:8765`
- `ANKI_API_KEY` - Optional, if configured in Anki-Connect

## API Patterns

| Operation | Returns |
|-----------|---------|
| CREATE | ID (number/string) |
| UPDATE/DELETE/ACTION | `true` on success |
| GET | Data or `null` |

## Links

- [Anki-Connect Docs](https://github.com/FooSoft/anki-connect)
- [MCP Specification](https://modelcontextprotocol.io)
- [Anki Forums](https://forums.ankiweb.net)

## License

MIT