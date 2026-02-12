# Mankey Tools - Complete Parameter Reference

All tools are accessible via CLI (`npx -y mankey run <tool> '<json>'`) or MCP server.

---

## Deck Tools (6)

### deckNames
List all deck names including nested decks (Parent::Child format).
```
Parameters:
  offset: number (optional, default: 0) - Pagination start
  limit:  number (optional, default: 1000, max: 10000) - Max decks to return
Returns: { decks: string[], pagination: { total, offset, limit, hasMore, nextOffset } }
```

### createDeck
Create a new empty deck. Acts as "ensure exists" - won't overwrite existing.
```
Parameters:
  deck: string (required) - Deck name, use :: for nesting (e.g., "Japanese::JLPT N5")
Returns: number (deck ID)
```

### getDeckStats
Detailed statistics for specified decks.
```
Parameters:
  decks: string[] (required) - Deck names to query
Returns: Record<deckId, { new_count, learn_count, review_count, total_in_deck }>
```

### deckNamesAndIds
Complete mapping of deck names to internal IDs.
```
Parameters:
  offset: number (optional, default: 0)
  limit:  number (optional, default: 1000, max: 10000)
Returns: { decks: Record<name, id>, pagination }
```

### getDeckConfig
Configuration group object for a deck (review settings, limits, ease factors).
```
Parameters:
  deck: string (required) - Deck name
Returns: Record (config object with new cards/day, review limits, intervals, etc.)
```

### deleteDecks
Permanently delete decks. Parent deletion includes all subdecks.
```
Parameters:
  decks:    string[] (required) - Deck names
  cardsToo: boolean (optional, default: true) - Also delete all cards in decks
Returns: true
```

---

## Note Tools (16)

### addNote
Create a single note generating cards based on model templates.
```
Parameters:
  deckName:       string (required) - Target deck
  modelName:      string (required) - Note type ("Basic", "Cloze", etc.)
  fields:         Record<string, string> (required) - Field name→content mapping
  tags:           string[] | string (optional) - Tags
  allowDuplicate: boolean (optional) - Allow duplicate content
Returns: number (note ID)
```

### addNotes
Bulk create multiple notes in one operation.
```
Parameters:
  notes: Array<{
    deckName:  string (required)
    modelName: string (required)
    fields:    Record<string, string> (required)
    tags:      string[] (optional)
    options:   { allowDuplicate: boolean } (optional)
  }> (required)
Returns: (number | null)[] - Note IDs (null for failures)
```

### findNotes
Search notes using Anki query syntax.
```
Parameters:
  query:  string (required) - e.g., "deck:Default", "tag:vocab", "front:hello"
  offset: number (optional, default: 0)
  limit:  number (optional, default: 100, max: 1000)
Returns: { notes: number[], pagination }
```

### notesInfo
Comprehensive note information. Auto-batches requests >100.
```
Parameters:
  notes: (number | string)[] (required) - Note IDs
Returns: Array<{ noteId, modelName, tags[], fields: Record<name, { value, order }>, cards[], mod }>
```

### updateNote
Update a note's fields and/or tags. Only provided fields change.
```
Parameters:
  id:     number | string (required) - Note ID
  fields: Record<string, string> (optional) - Fields to update
  tags:   string[] | string (optional) - Replaces ALL existing tags
Returns: true
```

### updateNoteFields
Update only fields, leaving tags unchanged.
```
Parameters:
  note: {
    id:     number | string (required) - Note ID
    fields: Record<string, string> (required) - Field values to update
  }
Returns: true
```

### deleteNotes
Permanently delete notes and all associated cards.
```
Parameters:
  notes: (number | string)[] (required) - Note IDs
Returns: true
```

### getTags
All unique tags in the collection.
```
Parameters:
  offset: number (optional, default: 0)
  limit:  number (optional, default: 1000, max: 10000)
Returns: { tags: string[], pagination }
```

### getNoteTags
Tags for a single note.
```
Parameters:
  note: number | string (required) - Note ID
Returns: string[]
```

### addTags
Add tags to notes (additive, preserves existing).
```
Parameters:
  notes: (number | string)[] (required) - Note IDs
  tags:  string (required) - Space-separated tags to add
Returns: true
```

### removeTags
Remove specific tags from notes.
```
Parameters:
  notes: (number | string)[] (required) - Note IDs
  tags:  string (required) - Space-separated tags to remove
Returns: true
```

### replaceTags
Replace a tag in specific notes.
```
Parameters:
  notes:          (number | string)[] (required) - Note IDs
  tagToReplace:   string (required)
  replaceWithTag: string (required)
Returns: true
```

### replaceTagsInAllNotes
Globally replace a tag across entire collection.
```
Parameters:
  tagToReplace:   string (required)
  replaceWithTag: string (required)
Returns: true
```

### clearUnusedTags
Remove all tags not assigned to any notes.
```
Parameters: (none)
Returns: true
```

### removeEmptyNotes
Delete notes with no associated cards.
```
Parameters: (none)
Returns: number (count of deleted notes)
```

### notesModTime
Modification timestamps for notes.
```
Parameters:
  notes: (number | string)[] (required) - Note IDs
Returns: number[] (seconds since epoch)
```

---

## Card Tools (19)

### findCards
Search cards using Anki query syntax. Note: `is:due` excludes learning cards.
```
Parameters:
  query:  string (required) - e.g., "deck:Default is:due", "is:new", "is:suspended"
  offset: number (optional, default: 0)
  limit:  number (optional, default: 100, max: 1000)
Returns: { cards: number[], pagination }
```

### getNextCards
Cards in exact review order: Learning > Review > New.
```
Parameters:
  deck:   string (optional) - Deck name or "current"
  limit:  number (optional, default: 10, max: 100)
  offset: number (optional, default: 0)
Returns: { cards[], breakdown: { learning, review, new }, pagination }
```

### cardsInfo
Comprehensive card information. Auto-batches >100.
```
Parameters:
  cards: (number | string)[] (required) - Card IDs
Returns: Array<{ cardId, noteId, deckName, modelName, question, answer, queue, type, due, interval, factor, reps, lapses, mod }>
```

### answerCards
Batch answer multiple cards programmatically.
```
Parameters:
  answers: Array<{
    cardId: number | string (required)
    ease:   number (required, 1-4) - 1=Again, 2=Hard, 3=Good, 4=Easy
  }> (required)
Returns: boolean[]
```

### suspend
Suspend cards (remove from review queue, preserve scheduling).
```
Parameters:
  cards: (number | string)[] (required)
Returns: true
```

### unsuspend
Restore suspended cards to active review.
```
Parameters:
  cards: (number | string)[] (required)
Returns: true
```

### areSuspended
Check suspension status for multiple cards.
```
Parameters:
  cards: (number | string)[] (required)
Returns: boolean[]
```

### areDue
Check if cards are due today.
```
Parameters:
  cards: (number | string)[] (required)
Returns: boolean[]
```

### getEaseFactors
Get ease factors (difficulty multipliers). Default 250%.
```
Parameters:
  cards: (number | string)[] (required)
Returns: number[]
```

### setEaseFactors
Set ease factors. Typical range 130-300%.
```
Parameters:
  cards:       (number | string)[] (required)
  easeFactors: number[] (required)
Returns: true
```

### getIntervals
Current intervals in days. Negative = learning phase.
```
Parameters:
  cards:    (number | string)[] (required)
  complete: boolean (optional) - Return complete history
Returns: number[]
```

### cardsToNotes
Convert card IDs to parent note IDs.
```
Parameters:
  cards: (number | string)[] (required)
Returns: number[]
```

### cardsModTime
Card modification timestamps.
```
Parameters:
  cards: (number | string)[] (required)
Returns: number[] (milliseconds since epoch)
```

### forgetCards
Reset cards to "new" state. Destroys review history.
```
Parameters:
  cards: (number | string)[] (required)
Returns: true
```

### relearnCards
Place cards into relearning queue (like pressing Again on mature card).
```
Parameters:
  cards: (number | string)[] (required)
Returns: true
```

### setSpecificValueOfCard
Directly modify internal card properties. Advanced use only.
```
Parameters:
  card:         number | string (required) - Card ID
  keys:         string[] (required) - Property keys (due, ease, ivl, reps, lapses)
  newValues:    string[] (required) - New values
  warningCheck: boolean (optional) - Required for dangerous fields
Returns: true
```

### getDecks
Get deck names for cards.
```
Parameters:
  cards: (number | string)[] (required)
Returns: string[]
```

### changeDeck
Move cards to a different deck (preserves scheduling).
```
Parameters:
  cards: (number | string)[] (required)
  deck:  string (required) - Target deck
Returns: true
```

### canAddNotes
Validate notes without creating them.
```
Parameters:
  notes: Array<{
    deckName:  string (required)
    modelName: string (required)
    fields:    Record<string, string> (required)
    tags:      string[] (optional)
  }> (required)
Returns: boolean[]
```

---

## Model Tools (9)

### modelNames
List all note types.
```
Parameters:
  offset: number (optional, default: 0)
  limit:  number (optional, default: 1000, max: 10000)
Returns: { models: string[], pagination }
```

### modelFieldNames
Ordered field names for a model (case-sensitive).
```
Parameters:
  modelName: string (required)
Returns: string[]
```

### modelNamesAndIds
Model name-to-ID mapping.
```
Parameters:
  offset: number (optional, default: 0)
  limit:  number (optional, default: 1000, max: 10000)
Returns: { models: Record<name, id>, pagination }
```

### createModel
Create a custom note type.
```
Parameters:
  modelName:     string (required, min 1) - Unique name
  inOrderFields: string[] (required, min 1) - Field names
  cardTemplates: Array<{
    Name:  string (required, min 1) - Template name
    Front: string (required) - Front HTML (use {{FieldName}})
    Back:  string (required) - Back HTML
  }> (required, min 1)
  css:     string (optional) - Card styling
  isCloze: boolean (optional, default: false) - Cloze deletion model
Returns: { id, name, ... } (created model)
```

### modelFieldsOnTemplates
Which fields are used in each card template.
```
Parameters:
  modelName: string (required)
Returns: Record<templateName, string[]>
```

### modelTemplates
Get card templates (Front/Back format strings).
```
Parameters:
  modelName: string (required)
Returns: Record<templateName, { Front, Back }>
```

### modelStyling
Get CSS styling for a model.
```
Parameters:
  modelName: string (required)
Returns: string (CSS)
```

### updateModelTemplates
Update card templates for a model.
```
Parameters:
  model: {
    name:      string (required)
    templates: Record<templateName, { Front: string, Back: string }> (required)
  }
Returns: true
```

### updateModelStyling
Update CSS for a model.
```
Parameters:
  model: {
    name: string (required)
    css:  string (required)
  }
Returns: true
```

---

## Media Tools (5)

### storeMediaFile
Store media in Anki's collection. Provide ONE of: data, url, or path.
```
Parameters:
  filename:       string (required) - File name
  data:           string (optional) - Base64-encoded content
  url:            string (optional) - URL to download from
  path:           string (optional) - Local file path
  deleteExisting: boolean (optional, default: true) - Overwrite existing
Returns: string (filename)
```

### retrieveMediaFile
Get media file as base64.
```
Parameters:
  filename: string (required)
Returns: string (base64) | false
```

### getMediaFilesNames
List media files. Supports * and ? wildcards.
```
Parameters:
  pattern: string (optional) - File pattern (e.g., "*.mp3")
Returns: string[]
```

### deleteMediaFile
Permanently delete a media file.
```
Parameters:
  filename: string (required)
Returns: true
```

### getMediaDirPath
Get absolute path to Anki's media folder.
```
Parameters: (none)
Returns: string (path)
```

---

## Stats Tools (7)

### getNumCardsReviewedToday
Today's total review count.
```
Parameters: (none)
Returns: number
```

### getDueCardsDetailed
Due cards categorized by queue type.
```
Parameters:
  deck: string (optional) - Deck name or "current"
Returns: { learning: card[], review: card[], total: number, note: string }
```

### getNumCardsReviewedByDay
Reviews per day.
```
Parameters: (none)
Returns: Record<day, number>
```

### getCollectionStatsHTML
Full collection stats (same as Anki Stats window).
```
Parameters:
  wholeCollection: boolean (optional, default: true)
Returns: string (HTML)
```

### cardReviews
Complete review history for a deck.
```
Parameters:
  deck:    string (required)
  startID: number (required) - Starting review ID
Returns: Array<{ reviewTime, cardID, ease, interval, lastInterval, factor, reviewDuration }>
```

### getLatestReviewID
Most recent review ID in collection.
```
Parameters:
  deck: string (required)
Returns: number | null
```

### getReviewsOfCards
Review entries for specific cards.
```
Parameters:
  cards: (number | string)[] (required)
Returns: review entries per card
```

---

## GUI Tools (17)

### guiBrowse
Open Anki browser with search query.
```
Parameters:
  query: string (required) - Search query
  reorderCards: { order?: "ascending" | "descending", columnId?: string } (optional)
Returns: number[] (note IDs shown)
```

### guiAddCards
Open Add Cards dialog pre-filled.
```
Parameters:
  note: { deckName: string, modelName: string, fields: Record, tags?: string[] }
Returns: number (note ID) | null (if cancelled)
```

### guiCurrentCard
Get card currently being reviewed.
```
Parameters: (none)
Returns: Record | null
```

### guiAnswerCard
Answer the current review card.
```
Parameters:
  ease: number (required, 1-4) - 1=Again, 2=Hard, 3=Good, 4=Easy
Returns: true
```

### guiDeckOverview
Open deck overview screen.
```
Parameters:
  name: string (required) - Deck name
Returns: true
```

### guiExitAnki
Close Anki application.
```
Parameters: (none)
Returns: true
```

### guiSelectedNotes
Get selected notes in browser.
```
Parameters: (none)
Returns: number[]
```

### guiSelectCard
Select and scroll to card in browser.
```
Parameters:
  card: number | string (required)
Returns: true
```

### guiEditNote
Open edit dialog for a note.
```
Parameters:
  note: number | string (required) - Note ID
Returns: Record | null
```

### guiStartCardTimer
Start review timer for current card.
```
Parameters: (none)
Returns: true
```

### guiShowQuestion
Show question side of current card.
```
Parameters: (none)
Returns: true
```

### guiShowAnswer
Show answer side of current card.
```
Parameters: (none)
Returns: true
```

### guiUndo
Undo last action.
```
Parameters: (none)
Returns: boolean
```

### guiDeckBrowser
Open main deck browser.
```
Parameters: (none)
Returns: true
```

### guiDeckReview
Start reviewing a deck.
```
Parameters:
  name: string (required) - Deck name
Returns: string (deck name)
```

### guiCheckDatabase
Run integrity check.
```
Parameters: (none)
Returns: string (status)
```

### guiImportFile
Open import dialog.
```
Parameters:
  path: string (optional) - File path (.apkg, .colpkg, .txt, .csv)
Returns: Record | null
```

---

## System Tools (17)

### sync
Two-way sync with AnkiWeb.
```
Parameters: (none)
Returns: true
```

### getProfiles
List all Anki profiles.
```
Parameters:
  offset: number (optional, default: 0)
  limit:  number (optional, default: 100, max: 1000)
Returns: { profiles: string[], pagination }
```

### loadProfile
Switch to a different profile.
```
Parameters:
  name: string (required) - Profile name
Returns: true
```

### getActiveProfile
Get current profile name.
```
Parameters: (none)
Returns: string
```

### exportPackage
Export deck to .apkg.
```
Parameters:
  deck:         string (required)
  path:         string (required) - Absolute path with .apkg extension
  includeSched: boolean (optional, default: false) - Include scheduling data
Returns: true
```

### importPackage
Import .apkg package.
```
Parameters:
  path: string (required) - Absolute path to .apkg file
Returns: true
```

### version
Anki-Connect version number.
```
Parameters: (none)
Returns: number
```

### requestPermission
Request API permission (first-time setup).
```
Parameters: (none)
Returns: { permission, requireApiKey, version }
```

### apiReflect
API metadata and discovery.
```
Parameters:
  scopes:  string[] (optional)
  actions: string[] (optional)
Returns: { scopes[], actions[] }
```

### reloadCollection
Reload collection from disk.
```
Parameters: (none)
Returns: true
```

### multi
Execute multiple API actions in one request.
```
Parameters:
  actions: Array<{
    action:  string (required) - Action name
    params:  unknown (optional)
    version: number (optional)
  }> (required)
Returns: any[] (results in order)
```

### setDueDate
Override card due dates.
```
Parameters:
  cards: (number | string)[] (required)
  days:  string (required) - "0" for today, "5" for 5 days, "3-7" for random range
Returns: true
```

### suspended
Check if a single card is suspended.
```
Parameters:
  card: number | string (required)
Returns: boolean
```

### saveDeckConfig
Update deck configuration group.
```
Parameters:
  config: Record (required) - Full config object
Returns: true
```

### setDeckConfigId
Assign config group to decks.
```
Parameters:
  decks:    string[] (required) - Deck names
  configId: number (required)
Returns: true
```

### cloneDeckConfigId
Clone a deck configuration.
```
Parameters:
  name:      string (required) - New config name
  cloneFrom: number (optional) - Source config ID
Returns: number (new config ID)
```

### removeDeckConfigId
Delete a deck configuration group.
```
Parameters:
  configId: number (required)
Returns: true
```

---

## Anki Search Syntax Quick Reference

| Query | Matches |
|-------|---------|
| `deck:DeckName` | Cards in deck (quote if has `::`) |
| `"deck:Parent::Child"` | Cards in nested deck |
| `tag:tagname` | Notes with tag |
| `-tag:exclude` | Notes without tag |
| `is:due` | Review cards due today (excludes learning) |
| `is:new` | Unseen cards |
| `is:learn` | Cards in learning phase |
| `is:review` | Review (mature + young) cards |
| `is:suspended` | Suspended cards |
| `is:buried` | Buried cards |
| `front:text` | Front field contains text |
| `"field:exact match"` | Exact field match |
| `added:N` | Added in last N days |
| `rated:N` | Reviewed in last N days |
| `rated:N:ease` | Reviewed with specific ease (1-4) |
| `prop:ivl>=30` | Interval >= 30 days |
| `prop:due=0` | Due today |
| `prop:ease<2.0` | Ease factor < 200% |
| `prop:lapses>5` | More than 5 lapses |
| `note:ModelName` | Cards from specific model |
| `*` | All cards |
| `flag:1` | Red flag (1-4 for colors) |
