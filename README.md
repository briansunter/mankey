# Mankey - Anki MCP Server

Supercharge your Anki workflow with MCP! A Model Context Protocol (MCP) server that connects to Anki, enabling AI-powered card creation, learning analytics, and intelligent review management through 45 comprehensive tools.

![Mankey](./screenshots/mankey.png)

## Quick Start

### Prerequisites
1. **[Anki](https://apps.ankiweb.net/)** - Desktop application
2. **Anki-Connect** - Install via Anki → Tools → Add-ons → Get Add-ons → Code: `2055492159`
3. **[Bun](https://bun.sh)** - JavaScript runtime

### Installation

This will automatically add the MCP server to your Claude Desktop configuration.

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

### Manual Configuration
```bash
npx mankey
```

## 🚀 What You Can Do

### 📚 **Create Learning Content from Any Source**
- "Create flashcards from this PDF about quantum physics"
- "Turn this article into language learning cards with audio"
- "Generate cloze deletions for these medical terms"
- "Make image occlusion cards from this anatomy diagram"

### 🎯 **Smart Review Management**
- "Show me my hardest cards and explain why I'm struggling"
- "Reschedule cards I've failed multiple times"
- "Optimize intervals for cards I know well"
- "Find and fix duplicate or similar cards"

### 📖 **Generate Stories & Mnemonics**
- "Create a story using my due Japanese vocabulary"
- "Make mnemonics for these chemical formulas"
- "Generate example sentences for difficult words"
- "Create memory palace descriptions for historical dates"

### 📊 **Learning Analytics**
- "Analyze my review patterns and suggest improvements"
- "Show cards I'm most likely to forget soon"
- "Find knowledge gaps in my study topics"
- "Track my progress on specific subjects"

### 🎨 **Custom Card Templates**
- "Create a template for medical case studies"
- "Design cards optimized for code snippets"
- "Make interactive cards with hints and explanations"
- "Build progressive disclosure templates"

### 🔧 **Bulk Operations**
- "Tag all cards about specific topics"
- "Move cards between decks based on performance"
- "Update formatting across all cards"
- "Clean up and standardize card content"

## Example Conversations

### Creating Cards from Content
```
You: "I'm reading about the French Revolution. Create cards for key events."
Claude: I'll create flashcards for major French Revolution events...
[Creates cards with dates, causes, key figures, and outcomes]
```

### Learning Optimization
```
You: "Find my most difficult Spanish vocabulary and create practice sentences"
Claude: I found 15 cards with <50% success rate. Here are contextual sentences...
[Generates sentences and updates cards with example usage]
```

### Study Analytics
```
You: "How am I doing with my medical terminology deck?"
Claude: You're reviewing 45 cards/day with 78% retention. Cards about prefixes 
need more work. I suggest focusing on these 10 challenging concepts...
```

## Core Features

✅ **45 comprehensive tools** covering all Anki operations  
✅ **AI-powered content generation** - Create cards from any text, PDF, or webpage  
✅ **Intelligent review scheduling** - Optimize intervals based on performance  
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
# Run all E2E tests
bun test:e2e

# Run specific test suites
bun test:e2e:basic      # Basic connectivity
bun test:e2e:tags       # Tag handling
bun test:e2e:fixes      # Return value consistency
bun test:e2e:real       # Real operations
bun test:e2e:pagination # Pagination support
bun test:e2e:queue      # Queue priority

# Run with test runner (includes connection check)
bun test:e2e:all

# Development
bun test:e2e:watch      # Watch mode
```

## Project Structure

```
anky/
├── src/index.ts           # MCP server (45 tools)
├── tests/                 # E2E integration tests
│   ├── *.test.ts         # Bun Jest test suites
│   ├── test-utils.ts     # Shared test utilities
│   └── run-tests.ts      # Test runner
├── scripts/               # Standalone test scripts
│   ├── test-*.ts         # Manual test scripts
│   └── test-*.sh         # Shell test scripts
├── docs/                  # Documentation
├── package.json          # Dependencies
└── bunfig.toml          # Bun configuration
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

## Common Use Cases

### 🌐 Language Learning
- Create vocabulary cards with example sentences
- Generate grammar pattern cards
- Build cards from reading materials

### 🔬 STEM Studies  
- Convert formulas into practice problems
- Create diagram-based cards
- Build concept relationship cards

### 💼 Professional Learning
- Create cards from documentation
- Build terminology databases
- Track skill progression

## Power User Tips

- **Web Content**: "Create cards from this article about machine learning"
- **Code Learning**: "Generate cards explaining this Python function"
- **Document Analysis**: "Extract key points from this PDF chapter"
- **Bulk Management**: "Tag all biology cards and optimize their intervals"

## Links

- [Anki-Connect Docs](https://github.com/FooSoft/anki-connect)
- [MCP Specification](https://modelcontextprotocol.io)
- [Anki Forums](https://forums.ankiweb.net)
- [Claude Desktop](https://claude.ai/download)

## Contributing

We welcome contributions! Please check out our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT