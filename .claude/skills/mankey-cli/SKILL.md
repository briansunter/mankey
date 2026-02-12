---
name: mankey-cli
description: >
  Comprehensive reference for the Mankey Anki CLI and MCP server. Use when
  working with Anki flashcards via the mankey command, creating notes, managing
  decks, reviewing cards, querying collection data, or building MCP tool
  integrations. Covers all 96 tools across 8 categories (deck, note, card,
  model, media, stats, gui, system) with full parameter details.
---

# Mankey CLI & MCP Tool Reference

Mankey is an MCP server and CLI for managing Anki via Anki-Connect. All commands
use `npx -y mankey` or the local `bun bin/mankey.ts`.

## Quick Start

```bash
# Start MCP server (default)
npx -y mankey

# CLI commands
npx -y mankey tools                        # List all tools
npx -y mankey deck list                    # List decks
npx -y mankey note add --deck Default --model Basic --front "Q" --back "A"
npx -y mankey run <toolName> '<json>'      # Run any tool by name
```

Global option: `--url <url>` overrides Anki-Connect URL (default: `http://127.0.0.1:8765`, env: `ANKI_CONNECT_URL`).

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
npx -y mankey run <toolName> '<jsonArgs>'
# Example:
npx -y mankey run addNote '{"deckName":"Default","modelName":"Basic","fields":{"Front":"Hello","Back":"World"}}'
npx -y mankey run findCards '{"query":"deck:Default is:due","limit":20}'
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

## Key Patterns

**Pagination**: Tools returning lists support `offset`/`limit`. Response includes `pagination: { total, offset, limit, hasMore, nextOffset }`.

**Auto-batching**: `notesInfo` and `cardsInfo` auto-split requests >100 items.

**Input flexibility**: IDs accept number/string/array. Tags accept array, space-separated string, or JSON string.

**Search syntax**: `deck:Name`, `tag:name`, `is:due`, `is:new`, `is:suspended`, `"field:value"`, `-tag:exclude`. Combine with spaces (AND). Use quotes around deck names with `::`.
