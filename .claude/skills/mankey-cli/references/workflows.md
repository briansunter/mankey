# Mankey CLI Workflow Examples

Common multi-step workflows using the Mankey CLI.

## Creating Flashcards

### Single card (Basic model)
```bash
npx -y mankey note add \
  --deck "Japanese::Vocabulary" \
  --model "Basic" \
  --front "食べる (たべる)" \
  --back "to eat" \
  --tags "japanese,jlpt-n5,verb"
```

### Single card via generic runner
```bash
npx -y mankey run addNote '{
  "deckName": "Japanese::Vocabulary",
  "modelName": "Basic",
  "fields": { "Front": "食べる", "Back": "to eat" },
  "tags": ["japanese", "jlpt-n5"]
}'
```

### Bulk create cards
```bash
npx -y mankey run addNotes '{
  "notes": [
    {
      "deckName": "Geography",
      "modelName": "Basic",
      "fields": { "Front": "Capital of France?", "Back": "Paris" },
      "tags": ["geography", "europe"]
    },
    {
      "deckName": "Geography",
      "modelName": "Basic",
      "fields": { "Front": "Capital of Japan?", "Back": "Tokyo" },
      "tags": ["geography", "asia"]
    }
  ]
}'
```

### Cloze deletion card
```bash
npx -y mankey run addNote '{
  "deckName": "Science",
  "modelName": "Cloze",
  "fields": { "Text": "The {{c1::mitochondria}} is the powerhouse of the {{c2::cell}}" },
  "tags": ["biology"]
}'
```

## Managing Decks

### Create nested deck structure
```bash
npx -y mankey deck create "Languages::Japanese::JLPT N5"
npx -y mankey deck create "Languages::Japanese::JLPT N4"
npx -y mankey deck create "Languages::Japanese::JLPT N3"
```

### Check study progress
```bash
npx -y mankey deck stats "Languages::Japanese::JLPT N5" "Languages::Japanese::JLPT N4"
```

### List all decks
```bash
npx -y mankey deck list
```

## Reviewing Cards

### See what's due
```bash
npx -y mankey stats due --deck "Japanese::Vocabulary"
```

### Get next cards in review order
```bash
npx -y mankey card next --deck "Japanese::Vocabulary" --limit 5
```

### Answer cards programmatically
```bash
# Answer a single card (ease: 1=Again, 2=Hard, 3=Good, 4=Easy)
npx -y mankey card answer 1234567890 3

# Batch answer multiple cards
npx -y mankey run answerCards '{
  "answers": [
    { "cardId": 1234567890, "ease": 3 },
    { "cardId": 1234567891, "ease": 4 },
    { "cardId": 1234567892, "ease": 1 }
  ]
}'
```

## Finding and Querying

### Find notes by tag
```bash
npx -y mankey note find "tag:japanese" --limit 20
```

### Find due cards in a deck
```bash
npx -y mankey card find "deck:Default is:due" --limit 50
```

### Find suspended cards
```bash
npx -y mankey card find "is:suspended" --limit 100
```

### Find cards added recently
```bash
npx -y mankey card find "added:7"  # last 7 days
```

### Get full note info
```bash
npx -y mankey note info 1234567890 1234567891
```

## Updating Cards

### Update note content
```bash
npx -y mankey note update 1234567890 \
  --fields '{"Front": "Updated question", "Back": "Updated answer"}'
```

### Replace tags
```bash
npx -y mankey note update 1234567890 --tags "new-tag1,new-tag2"
```

### Add tags to existing notes (preserves existing tags)
```bash
npx -y mankey run addTags '{
  "notes": [1234567890, 1234567891],
  "tags": "important review-again"
}'
```

### Remove tags
```bash
npx -y mankey run removeTags '{
  "notes": [1234567890],
  "tags": "old-tag deprecated"
}'
```

### Global tag rename
```bash
npx -y mankey run replaceTagsInAllNotes '{
  "tagToReplace": "old-category",
  "replaceWithTag": "new-category"
}'
```

## Card Management

### Suspend/unsuspend cards
```bash
npx -y mankey card suspend 1234567890 1234567891
npx -y mankey card unsuspend 1234567890
```

### Move cards between decks
```bash
npx -y mankey run changeDeck '{
  "cards": [1234567890, 1234567891],
  "deck": "Japanese::JLPT N4"
}'
```

### Reset cards to new
```bash
npx -y mankey run forgetCards '{"cards": [1234567890]}'
```

### Set due date
```bash
npx -y mankey run setDueDate '{
  "cards": [1234567890],
  "days": "0"
}'  # Due today

npx -y mankey run setDueDate '{
  "cards": [1234567890, 1234567891],
  "days": "3-7"
}'  # Random 3-7 days from now
```

## Model (Note Type) Management

### List available models and their fields
```bash
npx -y mankey model list
npx -y mankey model fields "Basic"
npx -y mankey model fields "Cloze"
```

### Create a custom model
```bash
npx -y mankey model create \
  --name "Vocabulary" \
  --fields "Word,Reading,Meaning,Example" \
  --templates '[{
    "Name": "Recognition",
    "Front": "<div class=\"word\">{{Word}}</div><div class=\"reading\">{{Reading}}</div>",
    "Back": "{{FrontSide}}<hr><div class=\"meaning\">{{Meaning}}</div><div class=\"example\">{{Example}}</div>"
  }]' \
  --css ".word { font-size: 2em; } .reading { color: #666; } .meaning { font-size: 1.2em; } .example { font-style: italic; }"
```

### Update model styling
```bash
npx -y mankey run updateModelStyling '{
  "model": {
    "name": "Vocabulary",
    "css": ".word { font-size: 3em; color: #333; }"
  }
}'
```

## Media Files

### Store media from URL
```bash
npx -y mankey run storeMediaFile '{
  "filename": "pronunciation.mp3",
  "url": "https://example.com/audio/word.mp3"
}'
```

### Store media from local file
```bash
npx -y mankey run storeMediaFile '{
  "filename": "diagram.png",
  "path": "/Users/me/images/diagram.png"
}'
```

### List media files
```bash
npx -y mankey run getMediaFilesNames '{"pattern": "*.mp3"}'
```

## Statistics and Review Data

### Today's progress
```bash
npx -y mankey stats today
```

### Due card breakdown
```bash
npx -y mankey stats due
npx -y mankey stats due --deck "Japanese::Vocabulary"
```

### Full collection stats
```bash
npx -y mankey stats collection
```

### Review history for cards
```bash
npx -y mankey run getReviewsOfCards '{"cards": [1234567890]}'
```

## System Operations

### Sync with AnkiWeb
```bash
npx -y mankey run sync
```

### Export/import decks
```bash
npx -y mankey run exportPackage '{
  "deck": "Japanese::Vocabulary",
  "path": "/Users/me/backup/japanese-vocab.apkg",
  "includeSched": true
}'

npx -y mankey run importPackage '{
  "path": "/Users/me/downloads/shared-deck.apkg"
}'
```

### Profile management
```bash
npx -y mankey run getActiveProfile
npx -y mankey run getProfiles
npx -y mankey run loadProfile '{"name": "Study"}'
```

### Batch operations with multi
```bash
npx -y mankey run multi '{
  "actions": [
    { "action": "deckNames" },
    { "action": "modelNames" },
    { "action": "getNumCardsReviewedToday" }
  ]
}'
```

## Remote Anki-Connect Server

```bash
# Via flag
npx -y mankey --url http://192.168.1.100:8765 deck list

# Via environment variable
ANKI_CONNECT_URL=http://192.168.1.100:8765 npx -y mankey deck list
```

## MCP Server Mode

```bash
# Start MCP server (default command)
npx -y mankey

# Or explicitly
npx -y mankey mcp
```

Configure in Claude Desktop / MCP client:
```json
{
  "mcpServers": {
    "mankey": {
      "command": "npx",
      "args": ["-y", "mankey"]
    }
  }
}
```
