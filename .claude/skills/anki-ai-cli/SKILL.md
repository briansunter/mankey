---
name: anki-ai-cli
description: >
  Comprehensive reference for the Anki-AI CLI and MCP server. Use when
  working with Anki flashcards via the anki-ai command, creating notes, managing
  decks, reviewing cards, querying collection data, or building MCP tool
  integrations. Covers all 96 tools across 8 categories (deck, note, card,
  model, media, stats, gui, system) with full parameter details.
---

# Anki-AI CLI & MCP Tool Reference

Anki-AI is an MCP server and CLI for managing Anki via Anki-Connect. Works with Node.js (npx) or Bun.

## Prerequisites

1. **[Anki Desktop](https://apps.ankiweb.net/)** must be running
2. **Anki-Connect add-on** must be installed: Anki > Tools > Add-ons > Get Add-ons > Code: `2055492159` > Restart Anki

## Setup

### MCP Server (Claude Desktop / Claude Code)

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

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

### CLI

```bash
npx anki-ai deck list                    # List decks
npx anki-ai tools                        # List all 96 tools
npx anki-ai note add --deck Default --model Basic --front "Q" --back "A"
npx anki-ai run <toolName> '<json>'      # Run any tool by name
```

### Configuration

| Option | Description |
|--------|-------------|
| `--url <url>` | Anki-Connect server URL |
| `ANKI_CONNECT_URL` | Environment variable (default: `http://127.0.0.1:8765`) |

### Troubleshooting

- **Cannot connect**: Ensure Anki is running with Anki-Connect installed
- **Permission dialog**: Click "Yes" on first Anki-Connect connection
- **macOS background**: Run `defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true` if Anki sleeps

## CLI Subcommands

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
| `note add --deck D --model M --front F --back B [--tags t1,t2] [--allow-duplicate]` | Create a note |
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
| `model create --name N --fields f1,f2 --templates '<json>' [--css C] [--cloze]` | Create model |

### stats

| Command | Description |
|---------|-------------|
| `stats today` | Today's review count |
| `stats due [--deck D]` | Due cards with learning/review breakdown |
| `stats collection` | Full collection statistics HTML |

### Generic Runner

```bash
npx anki-ai run <toolName> '<jsonArgs>'
# Example:
npx anki-ai run addNote '{"deckName":"Default","modelName":"Basic","fields":{"Front":"Hello","Back":"World"}}'
npx anki-ai run findCards '{"query":"deck:Default is:due","limit":20}'
```

Any of the 96 tools below can be called via `run`. Arguments are validated with Zod before execution.

## Complete Tool Reference

For full parameter schemas, types, and defaults, see `references/tools-by-category.md`.

### Deck Tools (6)

- **deckNames** - List all decks with pagination (`offset`, `limit`)
- **createDeck** - Create deck (`deck` name, `::` for nesting) returns ID
- **getDeckStats** - Stats for decks (`decks[]`) returns new/learn/review/total
- **deckNamesAndIds** - Deck name-to-ID mapping with pagination
- **getDeckConfig** - Get config group for a deck (`deck`)
- **deleteDecks** - Delete decks (`decks[]`, `cardsToo` default true)

### Note Tools (16)

- **addNote** - Create single note (`deckName`, `modelName`, `fields{}`, `tags[]`, `allowDuplicate`)
- **addNotes** - Bulk create (`notes[]`) returns array of IDs (null for failures)
- **findNotes** - Search (`query`, `offset`, `limit`) returns IDs + pagination
- **notesInfo** - Full note data (`notes[]`) auto-batches >100
- **updateNote** - Update fields/tags (`id`, `fields{}`, `tags[]`)
- **updateNoteFields** - Update only fields (`note.id`, `note.fields{}`)
- **deleteNotes** - Delete permanently (`notes[]`)
- **getTags** - All collection tags with pagination
- **getNoteTags** - Tags for one note (`note` ID)
- **addTags** - Add tags to notes (`notes[]`, `tags` space-separated)
- **removeTags** - Remove tags from notes (`notes[]`, `tags` space-separated)
- **replaceTags** - Replace tag in specific notes (`notes[]`, `tagToReplace`, `replaceWithTag`)
- **replaceTagsInAllNotes** - Global tag replace (`tagToReplace`, `replaceWithTag`)
- **clearUnusedTags** - Remove orphaned tags (no params)
- **removeEmptyNotes** - Delete notes with no cards (no params)
- **notesModTime** - Modification timestamps (`notes[]`)

### Card Tools (19)

- **findCards** - Search (`query`, `offset`, `limit`) returns IDs + pagination
- **getNextCards** - Due cards in review order (`deck`, `limit`, `offset`)
- **cardsInfo** - Full card data (`cards[]`) auto-batches >100
- **answerCards** - Batch answer (`answers[].cardId`, `answers[].ease` 1-4)
- **suspend** / **unsuspend** - Toggle suspension (`cards[]`)
- **areSuspended** - Check suspension status (`cards[]`) returns booleans
- **areDue** - Check due status (`cards[]`) returns booleans
- **getEaseFactors** / **setEaseFactors** - Get/set ease (`cards[]`, `easeFactors[]`)
- **getIntervals** - Current intervals in days (`cards[]`, `complete`)
- **cardsToNotes** - Map card IDs to note IDs (`cards[]`)
- **cardsModTime** - Modification timestamps (`cards[]`)
- **forgetCards** - Reset to new state (`cards[]`)
- **relearnCards** - Move to relearning queue (`cards[]`)
- **setSpecificValueOfCard** - Modify internal properties (`card`, `keys[]`, `newValues[]`)
- **getDecks** - Deck names for cards (`cards[]`)
- **changeDeck** - Move cards to deck (`cards[]`, `deck`)
- **canAddNotes** - Validate without creating (`notes[]`) returns booleans

### Model Tools (9)

- **modelNames** - List all models with pagination
- **modelFieldNames** - Field names for model (`modelName`)
- **modelNamesAndIds** - Model name-to-ID mapping with pagination
- **createModel** - Create note type (`modelName`, `inOrderFields[]`, `cardTemplates[]`, `css`, `isCloze`)
- **modelFieldsOnTemplates** - Fields used per template (`modelName`)
- **modelTemplates** - Get templates for model (`modelName`)
- **modelStyling** - Get CSS for model (`modelName`)
- **updateModelTemplates** - Update templates (`model.name`, `model.templates{}`)
- **updateModelStyling** - Update CSS (`model.name`, `model.css`)

### Media Tools (5)

- **storeMediaFile** - Store file (`filename`, one of: `data` base64 / `url` / `path`, `deleteExisting`)
- **retrieveMediaFile** - Get file as base64 (`filename`)
- **getMediaFilesNames** - List files (`pattern` with wildcards)
- **deleteMediaFile** - Delete file (`filename`)
- **getMediaDirPath** - Get media folder path (no params)

### Stats Tools (7)

- **getNumCardsReviewedToday** - Today's review count (no params)
- **getDueCardsDetailed** - Due cards breakdown (`deck` optional)
- **getNumCardsReviewedByDay** - Reviews by day (no params)
- **getCollectionStatsHTML** - Full stats HTML (`wholeCollection`)
- **cardReviews** - Review history (`deck`, `startID`)
- **getLatestReviewID** - Latest review ID (`deck`)
- **getReviewsOfCards** - Reviews for specific cards (`cards[]`)

### GUI Tools (17)

- **guiBrowse** - Open browser (`query`, `reorderCards{}`)
- **guiAddCards** - Open add dialog (`note{}`)
- **guiCurrentCard** - Current review card (no params)
- **guiAnswerCard** - Answer current card (`ease` 1-4)
- **guiShowQuestion** / **guiShowAnswer** - Toggle card sides
- **guiStartCardTimer** - Start review timer
- **guiDeckOverview** - Open deck overview (`name`)
- **guiDeckBrowser** - Open deck list
- **guiDeckReview** - Start reviewing (`name`)
- **guiSelectedNotes** - Get selected notes in browser
- **guiSelectCard** - Select card in browser (`card`)
- **guiEditNote** - Open edit dialog (`note`)
- **guiUndo** - Undo last action
- **guiCheckDatabase** - Run integrity check
- **guiImportFile** - Open import dialog (`path`)
- **guiExitAnki** - Close Anki

### System Tools (17)

- **sync** - Sync with AnkiWeb
- **getProfiles** / **loadProfile** / **getActiveProfile** - Profile management
- **exportPackage** - Export .apkg (`deck`, `path`, `includeSched`)
- **importPackage** - Import .apkg (`path`)
- **version** - Anki-Connect version
- **requestPermission** - Request API permission
- **apiReflect** - API metadata (`scopes[]`, `actions[]`)
- **reloadCollection** - Reload from disk
- **multi** - Batch multiple actions (`actions[]`)
- **setDueDate** - Override due date (`cards[]`, `days`)
- **suspended** - Check single card suspension (`card`)
- **saveDeckConfig** - Update deck config (`config{}`)
- **setDeckConfigId** - Assign config to decks (`decks[]`, `configId`)
- **cloneDeckConfigId** - Clone config (`name`, `cloneFrom`)
- **removeDeckConfigId** - Delete config (`configId`)

## Common Workflows

### Check learning progress and mastery

```bash
# Deck overview: new/learning/review/total counts
npx anki-ai deck stats "Japanese::JLPT N5"

# Today's study stats
npx anki-ai stats today

# Due cards with queue breakdown (learning vs review vs new)
npx anki-ai stats due --deck "Japanese::JLPT N5"

# Find well-known cards (high interval = strong retention)
npx anki-ai run findCards '{"query":"deck:Default prop:ivl>30"}'

# Get full learning data for specific cards (interval, ease, reps, lapses)
npx anki-ai card info <cardId1> <cardId2>
# Returns: interval (days until review), factor (ease multiplier),
#   reps (successful reviews), lapses (times forgotten),
#   queue (0=new, 1=learning, 2=review, 3=relearning),
#   type (0=new, 1=learning, 2=review, 3=relearn)
```

### Find struggling cards

```bash
# Cards failed many times (high lapse count)
npx anki-ai run findCards '{"query":"deck:Default prop:lapses>5"}'

# Cards with low ease (difficulty multiplier, 2500 = default)
npx anki-ai run findCards '{"query":"deck:Default prop:ease<2.0"}'

# Cards currently in relearning (recently forgotten)
npx anki-ai run findCards '{"query":"deck:Default is:learn -is:new"}'

# Get ease factors for specific cards
npx anki-ai run getEaseFactors '{"cards":[123,456]}'
```

### Create cards from content

```bash
# Single card
npx anki-ai note add --deck "Japanese" --model Basic --front "日本語" --back "Japanese language" --tags japanese,vocabulary

# Bulk create via generic runner
npx anki-ai run addNotes '{"notes":[
  {"deckName":"Japanese","modelName":"Basic","fields":{"Front":"猫","Back":"cat"},"tags":["japanese"]},
  {"deckName":"Japanese","modelName":"Basic","fields":{"Front":"犬","Back":"dog"},"tags":["japanese"]}
]}'

# Cloze deletion
npx anki-ai run addNote '{"deckName":"Science","modelName":"Cloze","fields":{"Text":"The {{c1::mitochondria}} is the powerhouse of the cell"}}'

# Check what fields a model needs before creating
npx anki-ai model fields "Basic (and reversed card)"
```

### Review cards programmatically

```bash
# Get next due cards in review order (Learning > Review > New)
npx anki-ai card next --deck Default --limit 5

# Answer cards: 1=Again 2=Hard 3=Good 4=Easy
npx anki-ai card answer <cardId> 3

# Batch answer multiple cards
npx anki-ai run answerCards '{"answers":[
  {"cardId":123,"ease":3},
  {"cardId":456,"ease":4}
]}'
```

### Manage tags and organize

```bash
# Find all cards with a tag
npx anki-ai note find "tag:japanese"

# Add tags to notes
npx anki-ai run addTags '{"notes":[123,456],"tags":"vocab important"}'

# Replace a tag across entire collection
npx anki-ai run replaceTagsInAllNotes '{"tagToReplace":"old-tag","replaceWithTag":"new-tag"}'

# Clean up unused tags
npx anki-ai run clearUnusedTags '{}'

# Move cards between decks
npx anki-ai run changeDeck '{"cards":[123,456],"deck":"Japanese::Advanced"}'
```

### Bulk operations and search

```bash
# Search with Anki query syntax
npx anki-ai card find "deck:Japanese is:due" --limit 50
npx anki-ai note find "tag:vocab added:7"        # Added in last 7 days
npx anki-ai card find "prop:ivl>90 deck:Default"  # Well-known cards

# Suspend/unsuspend cards
npx anki-ai card suspend 123 456 789
npx anki-ai card unsuspend 123 456 789

# Reset cards to new state (clear scheduling)
npx anki-ai run forgetCards '{"cards":[123,456]}'

# Reschedule cards
npx anki-ai run setDueDate '{"cards":[123,456],"days":"0"}'  # Due today
npx anki-ai run setDueDate '{"cards":[123,456],"days":"7"}'  # Due in 7 days
```

## Search Query Syntax

| Query | Matches |
|-------|---------|
| `deck:Name` | Cards in deck (use quotes for `::`: `"deck:A::B"`) |
| `tag:name` | Notes with tag |
| `-tag:name` | Notes without tag |
| `is:due` | Cards due for review |
| `is:new` | New cards (never reviewed) |
| `is:review` | Review cards (graduated from learning) |
| `is:learn` | Cards in learning phase |
| `is:suspended` | Suspended cards |
| `prop:ivl>N` | Cards with interval > N days |
| `prop:ease<N` | Cards with ease factor < N |
| `prop:lapses>N` | Cards failed more than N times |
| `prop:reps>N` | Cards reviewed more than N times |
| `added:N` | Cards added in last N days |
| `rated:N` | Cards rated in last N days |
| `"field:value"` | Cards where field contains value |

Combine queries with spaces (AND). Example: `deck:Japanese is:due prop:lapses>3`

## Key Patterns

**Pagination**: Tools returning lists support `offset`/`limit`. Response includes `pagination: { total, offset, limit, hasMore, nextOffset }`.

**Auto-batching**: `notesInfo` and `cardsInfo` auto-split requests >100 items.

**Input flexibility**: IDs accept number/string/array. Tags accept array, space-separated string, or JSON string.
