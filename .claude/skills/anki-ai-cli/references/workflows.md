# Anki-AI CLI Workflow Examples

Common multi-step workflows using the Anki-AI CLI.

## Creating Flashcards

### Single card (Basic model)
```bash
npx -y anki-ai note add \
  --deck "Japanese::Vocabulary" \
  --model "Basic" \
  --front "食べる (たべる)" \
  --back "to eat" \
  --tags "japanese,jlpt-n5,verb"
```

### Single card via generic runner
```bash
npx -y anki-ai run addNote '{
  "deckName": "Japanese::Vocabulary",
  "modelName": "Basic",
  "fields": { "Front": "食べる", "Back": "to eat" },
  "tags": ["japanese", "jlpt-n5"]
}'
```

### Bulk create cards
```bash
npx -y anki-ai run addNotes '{
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
npx -y anki-ai run addNote '{
  "deckName": "Science",
  "modelName": "Cloze",
  "fields": { "Text": "The {{c1::mitochondria}} is the powerhouse of the {{c2::cell}}" },
  "tags": ["biology"]
}'
```

## Managing Decks

### Create nested deck structure
```bash
npx -y anki-ai deck create "Languages::Japanese::JLPT N5"
npx -y anki-ai deck create "Languages::Japanese::JLPT N4"
npx -y anki-ai deck create "Languages::Japanese::JLPT N3"
```

### Check study progress
```bash
npx -y anki-ai deck stats "Languages::Japanese::JLPT N5" "Languages::Japanese::JLPT N4"
```

### List all decks
```bash
npx -y anki-ai deck list
```

## Reviewing Cards

### See what's due
```bash
npx -y anki-ai stats due --deck "Japanese::Vocabulary"
```

### Get next cards in review order
```bash
npx -y anki-ai card next --deck "Japanese::Vocabulary" --limit 5
```

### Answer cards programmatically
```bash
# Answer a single card (ease: 1=Again, 2=Hard, 3=Good, 4=Easy)
npx -y anki-ai card answer 1234567890 3

# Batch answer multiple cards
npx -y anki-ai run answerCards '{
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
npx -y anki-ai note find "tag:japanese" --limit 20
```

### Find due cards in a deck
```bash
npx -y anki-ai card find "deck:Default is:due" --limit 50
```

### Find suspended cards
```bash
npx -y anki-ai card find "is:suspended" --limit 100
```

### Find cards added recently
```bash
npx -y anki-ai card find "added:7"  # last 7 days
```

### Get full note info
```bash
npx -y anki-ai note info 1234567890 1234567891
```

## Updating Cards

### Update note content
```bash
npx -y anki-ai note update 1234567890 \
  --fields '{"Front": "Updated question", "Back": "Updated answer"}'
```

### Replace tags
```bash
npx -y anki-ai note update 1234567890 --tags "new-tag1,new-tag2"
```

### Add tags to existing notes (preserves existing tags)
```bash
npx -y anki-ai run addTags '{
  "notes": [1234567890, 1234567891],
  "tags": "important review-again"
}'
```

### Remove tags
```bash
npx -y anki-ai run removeTags '{
  "notes": [1234567890],
  "tags": "old-tag deprecated"
}'
```

### Global tag rename
```bash
npx -y anki-ai run replaceTagsInAllNotes '{
  "tagToReplace": "old-category",
  "replaceWithTag": "new-category"
}'
```

## Card Management

### Suspend/unsuspend cards
```bash
npx -y anki-ai card suspend 1234567890 1234567891
npx -y anki-ai card unsuspend 1234567890
```

### Move cards between decks
```bash
npx -y anki-ai run changeDeck '{
  "cards": [1234567890, 1234567891],
  "deck": "Japanese::JLPT N4"
}'
```

### Reset cards to new
```bash
npx -y anki-ai run forgetCards '{"cards": [1234567890]}'
```

### Set due date
```bash
npx -y anki-ai run setDueDate '{
  "cards": [1234567890],
  "days": "0"
}'  # Due today

npx -y anki-ai run setDueDate '{
  "cards": [1234567890, 1234567891],
  "days": "3-7"
}'  # Random 3-7 days from now
```

## Model (Note Type) Management

### List available models and their fields
```bash
npx -y anki-ai model list
npx -y anki-ai model fields "Basic"
npx -y anki-ai model fields "Cloze"
```

### Create a custom model
```bash
npx -y anki-ai model create \
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
npx -y anki-ai run updateModelStyling '{
  "model": {
    "name": "Vocabulary",
    "css": ".word { font-size: 3em; color: #333; }"
  }
}'
```

## Media Files

### Store media from URL
```bash
npx -y anki-ai run storeMediaFile '{
  "filename": "pronunciation.mp3",
  "url": "https://example.com/audio/word.mp3"
}'
```

### Store media from local file
```bash
npx -y anki-ai run storeMediaFile '{
  "filename": "diagram.png",
  "path": "/Users/me/images/diagram.png"
}'
```

### List media files
```bash
npx -y anki-ai run getMediaFilesNames '{"pattern": "*.mp3"}'
```

## Statistics and Review Data

### Today's progress
```bash
npx -y anki-ai stats today
```

### Due card breakdown
```bash
npx -y anki-ai stats due
npx -y anki-ai stats due --deck "Japanese::Vocabulary"
```

### Full collection stats
```bash
npx -y anki-ai stats collection
```

### Review history for cards
```bash
npx -y anki-ai run getReviewsOfCards '{"cards": [1234567890]}'
```

## System Operations

### Sync with AnkiWeb
```bash
npx -y anki-ai run sync
```

### Export/import decks
```bash
npx -y anki-ai run exportPackage '{
  "deck": "Japanese::Vocabulary",
  "path": "/Users/me/backup/japanese-vocab.apkg",
  "includeSched": true
}'

npx -y anki-ai run importPackage '{
  "path": "/Users/me/downloads/shared-deck.apkg"
}'
```

### Profile management
```bash
npx -y anki-ai run getActiveProfile
npx -y anki-ai run getProfiles
npx -y anki-ai run loadProfile '{"name": "Study"}'
```

### Batch operations with multi
```bash
npx -y anki-ai run multi '{
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
npx -y anki-ai --url http://192.168.1.100:8765 deck list

# Via environment variable
ANKI_CONNECT_URL=http://192.168.1.100:8765 npx -y anki-ai deck list
```

## MCP Server Mode

```bash
# Start MCP server (default command)
npx -y anki-ai

# Or explicitly
npx -y anki-ai mcp
```

Configure in Claude Desktop / MCP client:
```json
{
  "mcpServers": {
    "anki-ai": {
      "command": "npx",
      "args": ["-y", "anki-ai"]
    }
  }
}
```
