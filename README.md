# Anki-AI - Anki MCP Server & CLI

[![npm version](https://img.shields.io/npm/v/anki-ai)](https://www.npmjs.com/package/anki-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```bash
npx skills add briansunter/anki-ai
```

MCP server and CLI for Anki integration via Anki-Connect. 96 tools across 8 categories for creating flashcards, managing reviews, analyzing learning data, and automating Anki workflows.

![Anki-AI](./screenshots/anki-ai.png)

## Install as Claude Skill

```bash
npx skills add briansunter/anki-ai
```

## Quick Start

### Prerequisites
1. **[Anki](https://apps.ankiweb.net/)** - Desktop application
2. **Anki-Connect** - Install via Anki > Tools > Add-ons > Get Add-ons > Code: `2055492159`

## Installing Anki-Connect

### Step 1: Install the Add-on
1. Open Anki Desktop
2. Go to **Tools → Add-ons → Get Add-ons...**
3. Enter code: `2055492159`
4. Click **OK**

### Step 2: Configure Permissions (Recommended)
By default, Anki-Connect only allows localhost connections. To use with MCP:

1. Go to **Tools → Add-ons → AnkiConnect → Config**
2. Replace the config with:

```json
{
  "webBrowserBind": false,
  "webBindAddress": "127.0.0.1",
  "webBindPort": 8765,
  "corsOriginList": ["http://localhost", "app://obsidian.md"]
}
```

3. Save and **restart Anki**

### Step 3: Verify Connection
Run this command to test:

```bash
curl localhost:8765 -d '{"action":"version","version":6}'
```

You should see: `{"result": 6, "error": null}`

## MCP Configuration

### Claude Desktop

| Platform | Config File |
|----------|-------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["anki-ai"]
    }
  }
}
```

Restart Claude Desktop after editing.

### Claude Code

Create `.mcp.json` in your project root:

```json
{
  "servers": {
    "anki": {
      "command": "npx",
      "args": ["anki-ai"]
    }
  }
}
```

## CLI

```bash
# List all decks
npx anki-ai deck list

# Create a note
npx anki-ai note add --deck Default --model Basic --front "Q" --back "A"

# Search notes
npx anki-ai note find "deck:Default"

# Run any of the 96 tools directly
npx anki-ai run findCards '{"query":"deck:Default is:due","limit":20}'

# List all available tools
npx anki-ai tools
```

## Common Workflows

### Quick Card Creation
```bash
# Create a vocabulary card
npx anki-ai note add --deck "Japanese::Vocab" --model Basic \
  --front "猫 (neko)" --back "cat" --tags japanese,N5

# Create multiple cards in a deck
npx anki-ai run addNotes '{"notes":[
  {"deckName":"Spanish","modelName":"Basic","fields":{"Front":"Hola","Back":"Hello"},"tags":["spanish"]},
  {"deckName":"Spanish","modelName":"Basic","fields":{"Front":"Adiós","Back":"Goodbye"},"tags":["spanish"]}
]}'
```

### Review Cards
```bash
# Get next 10 due cards in review order (Learning > Review > New)
npx anki-ai card next --limit 10

# Get due cards for a specific deck
npx anki-ai card next --deck "Japanese::Vocab" --limit 5

# Answer a card (1=Again, 2=Hard, 3=Good, 4=Easy)
npx anki-ai card answer 123456789 3
```

### Check Progress
```bash
# Today's review count
npx anki-ai stats today

# Due cards with breakdown by type
npx anki-ai stats due --deck "Japanese"

# Deck statistics (new/learn/review/total)
npx anki-ai deck stats "Japanese::Vocab"
```

## CLI Commands

### deck
| Command | Description |
|---------|-------------|
| `deck list` | List all deck names |
| `deck create <name>` | Create a deck (use `::` for nesting) |
| `deck stats <names...>` | Get new/learn/review/total counts |
| `deck delete <names...>` | Delete decks and their cards |

### note
| Command | Description |
|---------|-------------|
| `note add --deck D --model M --front F --back B [--tags t1,t2]` | Create a note |
| `note find <query> [--offset N] [--limit N]` | Search notes |
| `note info <ids...>` | Get note details |
| `note update <id> [--fields '{}'] [--tags t1,t2]` | Update a note |
| `note delete <ids...>` | Delete notes permanently |
| `note tags <id>` | Get tags for a note |

### card
| Command | Description |
|---------|-------------|
| `card find <query> [--offset N] [--limit N]` | Search cards |
| `card info <ids...>` | Get card details |
| `card suspend <ids...>` | Suspend cards |
| `card unsuspend <ids...>` | Unsuspend cards |
| `card answer <cardId> <ease>` | Answer card (1=Again 2=Hard 3=Good 4=Easy) |
| `card next [--deck D] [--limit N]` | Get next due cards in review order |

### model
| Command | Description |
|---------|-------------|
| `model list` | List all note types |
| `model fields <name>` | Get field names for a model |
| `model create --name N --fields f1,f2 --templates '<json>'` | Create model |

### stats
| Command | Description |
|---------|-------------|
| `stats today` | Today's review count |
| `stats due [--deck D]` | Due cards with learning/review breakdown |
| `stats collection` | Full collection statistics |

### Generic Runner

Any of the 96 tools can be called directly:

```bash
npx anki-ai run <toolName> '<jsonArgs>'
npx anki-ai run addNote '{"deckName":"Default","modelName":"Basic","fields":{"Front":"Hello","Back":"World"}}'
npx anki-ai run deckNames
```

## Tool Categories (96 tools)

| Category | Count | Examples |
|----------|-------|---------|
| Deck | 6 | deckNames, createDeck, getDeckStats, deleteDecks |
| Note | 16 | addNote, findNotes, notesInfo, updateNote, getTags |
| Card | 19 | findCards, getNextCards, cardsInfo, answerCards, suspend |
| Model | 9 | modelNames, modelFieldNames, createModel |
| Media | 5 | storeMediaFile, retrieveMediaFile, getMediaFilesNames |
| Stats | 7 | getNumCardsReviewedToday, getDueCardsDetailed |
| GUI | 17 | guiBrowse, guiAddCards, guiDeckReview |
| System | 17 | sync, exportPackage, importPackage, multi |

Run `npx anki-ai tools` for the full list, or `npx anki-ai tools --category deck` to filter.

## Key Features

- **96 tools** covering all Anki-Connect operations
- **CLI + MCP** - Every tool available as both CLI command and MCP tool
- **Pagination** - `offset`/`limit` on all list operations
- **Auto-batching** - Operations >100 items split automatically
- **Queue priority** - `getNextCards` respects Learning > Review > New order
- **Flexible input** - Tags/IDs accept arrays, strings, or JSON
- **TypeScript + Zod** - Full type safety and schema validation

## Configuration

| Option | Description |
|--------|-------------|
| `--url <url>` | Anki-Connect server URL |
| `ANKI_CONNECT_URL` | Environment variable (default: `http://127.0.0.1:8765`) |
| `ANKI_API_KEY` | Optional API key for Anki-Connect |

## Troubleshooting

### "Cannot connect" or "Connection refused"
1. Ensure Anki is running (not just in background)
2. Verify Anki-Connect is installed: **Tools → Add-ons**
3. Check Anki-Connect is listening:
   ```bash
   curl localhost:8765 -d '{"action":"version","version":6}'
   ```
4. If using a different port, set `ANKI_CONNECT_URL`:
   ```bash
   export ANKI_CONNECT_URL=http://127.0.0.1:8766
   ```

### Permission dialog on first connection
Anki-Connect shows a permission prompt when Anki-AI first connects. Click **Yes** to allow. If you clicked "No":
1. Go to **Tools → Add-ons → AnkiConnect → Config**
2. Add your app to `corsOriginList`

### "AnkiConnect is not installed"
The add-on code is `2055492159`. Verify installation in **Tools → Add-ons**.

### macOS: Anki goes to sleep
Run this command to prevent App Nap:
```bash
defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
```

### "CORS" or "Origin not allowed"
Add the requesting app to `corsOriginList` in Anki-Connect config.

## Project Structure

```
anki-ai/
  bin/anki-ai.ts              # Bun development entry point
  src/
    main.ts                  # CLI entry point (compiles to dist/main.js)
    index.ts                 # MCP-only entry point
    shared/                  # Config, types, anki-connect client, normalization
    tools/                   # 96 tool definitions (8 category files)
    cli/                     # Commander.js subcommands
    mcp/                     # MCP server setup
  dist/                      # Compiled JS (shipped via npm)
  tests/                     # E2E integration tests
```

## Development

Requires [Bun](https://bun.sh) for development:

```bash
bun install
bun run dev                  # Watch mode MCP server
bun test                     # Run all tests
bun run build                # Compile to dist/
bun run typecheck            # Type check only
bun run lint                 # Lint with Biome
```

## Testing

Tests require Anki running with Anki-Connect installed:

```bash
bun test                     # All tests
bun test:e2e:basic           # Basic connectivity
bun test:e2e:tags            # Tag handling
bun test:e2e:pagination      # Pagination
bun test:e2e:queue           # Queue priority
```

## Links

- [Anki-Connect Docs](https://github.com/FooSoft/anki-connect)
- [MCP Specification](https://modelcontextprotocol.io)
- [Anki Forums](https://forums.ankiweb.net)
- [Claude Desktop](https://claude.ai/download)

## License

MIT

