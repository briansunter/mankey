# Anki MCP Server

A Model Context Protocol (MCP) server for Anki, providing seamless integration with Anki via the Anki-Connect plugin. This server exposes 45 comprehensive tools for managing your Anki collection programmatically.

## Features

### 🚀 Key Features
- **45 Comprehensive Tools** - Complete coverage of Anki operations
- **Pagination Support** - Handle large collections efficiently with offset/limit pagination
- **Queue-Based Retrieval** - Respect Anki's learning/review priority system
- **Current Deck Support** - Use `deck:current` syntax in queries
- **Auto-Batching** - Automatic batching for large operations (>100 items)
- **Type Safety** - Full TypeScript support with Zod validation
- **String/Number ID Conversion** - Automatic handling of both ID formats

## Prerequisites

1. **Anki** - Install from [apps.ankiweb.net](https://apps.ankiweb.net/)
2. **Anki-Connect Plugin** - Install via Anki:
   - Open Anki
   - Go to Tools → Add-ons → Get Add-ons...
   - Enter code: `2055492159`
   - Restart Anki
3. **Bun** - Install from [bun.sh](https://bun.sh)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd anky

# Install dependencies
bun install
```

## Configuration

### For MCP Clients (e.g., Claude Desktop)

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "anki": {
      "command": "bun",
      "args": ["run", "/path/to/anky/src/index.ts"],
      "env": {
        "ANKI_CONNECT_URL": "http://127.0.0.1:8765"
      }
    }
  }
}
```

## Complete Tool Reference

### 📇 Card Operations (15 tools)

#### `findCards`
Find cards matching a query with pagination support.
```json
{
  "query": "deck:current is:due",
  "offset": 0,
  "limit": 100
}
```
- **Pagination**: Returns cards with metadata (total, hasMore, nextOffset)
- **Max limit**: 1000 cards per request
- **Special syntax**: Supports `deck:current` for currently selected deck

#### `cardsInfo`
Get detailed information about specific cards. Auto-batches large requests.
```json
{
  "cards": [1393817670788, "1393817670789"]
}
```
- **Auto-batching**: Automatically splits requests >100 cards
- **ID support**: Accepts both numbers and strings

#### `suspend`
Suspend cards to temporarily remove from review.
```json
{
  "cards": [1393817670788]
}
```

#### `unsuspend`
Unsuspend cards to restore to review queue.
```json
{
  "cards": [1393817670788]
}
```

#### `areSuspended`
Check suspension status of cards.
```json
{
  "cards": [1393817670788]
}
```

#### `areDue`
Check if cards are due for review.
```json
{
  "cards": [1393817670788]
}
```

#### `getIntervals`
Get review intervals for cards (in days).
```json
{
  "cards": [1393817670788]
}
```

#### `getEaseFactors`
Get ease factors (difficulty multipliers) for cards.
```json
{
  "cards": [1393817670788]
}
```

#### `setEaseFactors`
Set ease factors for specific cards.
```json
{
  "cards": [1393817670788],
  "easeFactors": [2500]
}
```

#### `forgetCards`
Reset cards to new state, clearing review history.
```json
{
  "cards": [1393817670788]
}
```

#### `relearnCards`
Move cards to relearning queue.
```json
{
  "cards": [1393817670788]
}
```

#### `answerCards`
Answer cards programmatically with specific ease.
```json
{
  "answers": [
    {
      "cardId": 1393817670788,
      "ease": 3
    }
  ]
}
```
- **Ease values**: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)

#### `getNextCards` ⭐ NEW
Get next cards in Anki's queue priority order with pagination.
```json
{
  "deck": "current",
  "limit": 10,
  "offset": 0
}
```
- **Queue priority**: Learning → Review → New cards
- **Returns**: Cards with queue breakdown and pagination metadata
- **Deck support**: Use "current" for selected deck or specify deck name

#### `getDueCardsDetailed` ⭐ NEW
Get detailed breakdown of due cards by category.
```json
{
  "deck": "current"
}
```
- **Categories**: Separate learning and review cards
- **Details**: Includes queue type, due time, intervals
- **Deck support**: Optional deck filtering

#### `cardsModTime`
Get last modification time for cards.
```json
{
  "cards": [1393817670788]
}
```

### 📝 Note Operations (10 tools)

#### `addNote`
Create a single note with fields and tags.
```json
{
  "deckName": "Default",
  "modelName": "Basic",
  "fields": {
    "Front": "Question",
    "Back": "Answer"
  },
  "tags": ["tag1", "tag2"],
  "allowDuplicate": false
}
```

#### `addNotes`
Create multiple notes in batch.
```json
{
  "notes": [
    {
      "deckName": "Default",
      "modelName": "Basic",
      "fields": {
        "Front": "Q1",
        "Back": "A1"
      }
    }
  ]
}
```

#### `updateNote`
Update existing note fields and tags.
```json
{
  "id": 1393817670788,
  "fields": {
    "Back": "Updated answer"
  },
  "tags": ["updated"]
}
```

#### `deleteNotes`
Delete notes permanently.
```json
{
  "notes": [1393817670788]
}
```
- **ID support**: Accepts both numbers and strings

#### `findNotes`
Find notes matching a query with pagination.
```json
{
  "query": "deck:current tag:important",
  "offset": 0,
  "limit": 100
}
```
- **Pagination**: Returns note IDs with metadata
- **Special syntax**: Supports `deck:current`

#### `notesInfo`
Get detailed information about notes. Auto-batches large requests.
```json
{
  "notes": [1393817670788]
}
```
- **Auto-batching**: Splits requests >100 notes
- **Returns**: Fields, tags, model, cards

#### `addTags`
Add tags to existing notes.
```json
{
  "notes": [1393817670788],
  "tags": "tag1 tag2"
}
```

#### `removeTags`
Remove tags from notes.
```json
{
  "notes": [1393817670788],
  "tags": "tag1 tag2"
}
```

#### `getTags`
Get all tags in the collection.
```json
{}
```

#### `replaceTags`
Replace all tags on notes.
```json
{
  "notes": [1393817670788],
  "tag_to_replace": "oldtag",
  "replace_with_tag": "newtag"
}
```

### 📚 Deck Operations (7 tools)

#### `deckNames`
List all deck names.
```json
{}
```

#### `deckNamesAndIds`
Get deck names with their IDs.
```json
{}
```

#### `createDeck`
Create a new deck.
```json
{
  "deck": "My New Deck"
}
```

#### `deleteDecks`
Delete decks and their cards.
```json
{
  "decks": ["Unwanted Deck"],
  "cardsToo": true
}
```

#### `getDeckConfig`
Get configuration for a deck.
```json
{
  "deck": "Default"
}
```

#### `saveDeckConfig`
Save deck configuration.
```json
{
  "config": {
    "id": 1,
    "name": "Default",
    "new": {
      "perDay": 20
    }
  }
}
```

#### `getDeckStats`
Get statistics for specific decks.
```json
{
  "decks": ["Default", "Languages"]
}
```

### 🎨 Model Operations (5 tools)

#### `modelNames`
List all note type names.
```json
{}
```

#### `modelNamesAndIds`
Get model names with their IDs.
```json
{}
```

#### `modelFieldNames`
Get field names for a model.
```json
{
  "modelName": "Basic"
}
```

#### `createModel`
Create a custom note type.
```json
{
  "modelName": "Custom",
  "fields": ["Field1", "Field2"],
  "cardTemplates": [
    {
      "Name": "Card 1",
      "Front": "{{Field1}}",
      "Back": "{{Field2}}"
    }
  ]
}
```

#### `updateModelTemplates`
Update card templates for a model.
```json
{
  "model": {
    "name": "Basic",
    "templates": {
      "Card 1": {
        "Front": "{{Front}}",
        "Back": "{{FrontSide}}<hr>{{Back}}"
      }
    }
  }
}
```

### 🖼️ Media Operations (3 tools)

#### `storeMediaFile`
Store media file in collection.
```json
{
  "filename": "image.png",
  "data": "base64_encoded_data"
}
```

#### `retrieveMediaFile`
Get media file from collection.
```json
{
  "filename": "image.png"
}
```

#### `getMediaFilesNames`
List all media files.
```json
{
  "pattern": "*.png"
}
```

### 📊 Statistics Operations (3 tools)

#### `getNumCardsReviewedToday`
Get today's review count.
```json
{}
```

#### `getCollectionStatsHTML`
Get collection statistics as HTML.
```json
{
  "wholeCollection": true
}
```

#### `sync`
Trigger collection sync.
```json
{}
```

### 🖥️ GUI Operations (2 tools)

#### `guiBrowse`
Open browser with query.
```json
{
  "query": "is:due",
  "reorderCards": {
    "order": "ivl",
    "columnId": 0,
    "pos": 0
  }
}
```

#### `guiAddCards`
Open add cards dialog with preset values.
```json
{
  "note": {
    "deckName": "Default",
    "modelName": "Basic",
    "fields": {
      "Front": "Preset question"
    }
  }
}
```

## Advanced Features

### Pagination Support

All find operations support pagination to handle large collections efficiently:

```json
{
  "query": "deck:current",
  "offset": 0,
  "limit": 100
}
```

**Response includes pagination metadata:**
```json
{
  "cards": [...],
  "pagination": {
    "offset": 0,
    "limit": 100,
    "total": 500,
    "hasMore": true,
    "nextOffset": 100
  }
}
```

### Queue-Based Card Retrieval

The server respects Anki's queue priority system:
- **Queue 0**: New cards
- **Queue 1**: Learning cards (highest priority)
- **Queue 2**: Review cards
- **Queue 3**: Relearning cards (highest priority)

Use `getNextCards` to retrieve cards in Anki's natural order.

### Current Deck Support

Use `deck:current` in queries to target the currently selected deck:
```json
{
  "query": "deck:current is:due"
}
```

Or use the deck parameter:
```json
{
  "deck": "current",
  "limit": 10
}
```

### Auto-Batching

Large operations (>100 items) are automatically batched:
- `notesInfo`: Auto-batches when notes > 100
- `cardsInfo`: Auto-batches when cards > 100

Response includes batch metadata:
```json
{
  "results": [...],
  "metadata": {
    "batches": 3,
    "batchSize": 100,
    "total": 250
  }
}
```

### String/Number ID Flexibility

All ID-accepting tools handle both formats:
```json
// Both work identically
{ "cards": [1393817670788] }
{ "cards": ["1393817670788"] }
```

## Testing

### Test Scripts

```bash
# Test basic connectivity
bun bin/test-anki-connect.ts

# Test all MCP operations
bun bin/test-real-operations.ts

# Test queue-based retrieval
bun bin/test-queue-priority.ts

# Test deck:current syntax
bun bin/test-deck-current.ts

# Test pagination features
bun bin/test-pagination.ts

# Test string ID conversion
bun bin/test-string-ids.ts
```

### Project Structure
```
anky/
├── src/
│   └── index.ts              # Main MCP server (45 tools)
├── bin/                      # Test scripts
│   ├── test-anki-connect.ts  # Basic connectivity test
│   ├── test-real-operations.ts # Full operation test
│   ├── test-queue-priority.ts  # Queue retrieval test
│   ├── test-deck-current.ts    # Current deck test
│   ├── test-pagination.ts      # Pagination test
│   └── test-string-ids.ts      # ID conversion test
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Troubleshooting

### Cannot connect to Anki-Connect
1. Ensure Anki is running
2. Check Anki-Connect is installed (Tools → Add-ons)
3. Verify port 8765 is accessible
4. Check firewall settings

### Permission Errors
- On first use, Anki-Connect shows a permission dialog
- Click "Yes" to allow the connection

### macOS App Nap Issues
If Anki-Connect stops responding when Anki is in background:
```bash
defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
defaults write net.ichi2.anki NSAppSleepDisabled -bool true
defaults write org.qt-project.Qt.QtWebEngineCore NSAppSleepDisabled -bool true
```

### String ID Errors
The server automatically converts string IDs to numbers. If you encounter issues:
- Ensure IDs are valid integers (as strings or numbers)
- Check the ID exists in your collection

## Environment Variables

- `ANKI_CONNECT_URL` - Anki-Connect URL (default: `http://127.0.0.1:8765`)
- `ANKI_API_KEY` - Optional API key if configured in Anki-Connect

## Version History

### v1.1.0 (Current)
- Added pagination support for findCards and findNotes
- Added queue-based card retrieval (getNextCards, getDueCardsDetailed)
- Added deck:current syntax support
- Added auto-batching for large operations
- Fixed string ID conversion issues
- Total: 45 tools

### v1.0.0
- Initial release with 43 tools
- Full Anki-Connect API coverage

## API Reference

- [Anki-Connect Documentation](https://github.com/FooSoft/anki-connect)
- [Anki Manual](https://docs.ankiweb.net/)
- [MCP Specification](https://modelcontextprotocol.io)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## License

MIT

## Support

For issues:
- **This MCP server**: Open an issue in this repository
- **Anki-Connect**: Visit [github.com/FooSoft/anki-connect](https://github.com/FooSoft/anki-connect)
- **Anki**: Visit [forums.ankiweb.net](https://forums.ankiweb.net)

---

Built with [Bun](https://bun.sh) - A fast all-in-one JavaScript runtime.