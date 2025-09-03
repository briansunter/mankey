# Anki MCP API - Untested Tools Checklist

## Testing Status Overview
- ✅ Tested: Core CRUD operations, basic workflows
- ⚠️  Partially tested: Some advanced features
- ❌ Not tested: GUI operations, advanced scheduling, profile management

## Untested Tools by Category

### 📚 Deck Operations
- [ ] `deckNamesAndIds` - Get mapping of deck names to IDs
- [ ] `saveDeckConfig` - Update deck configuration settings
- [ ] `setDeckConfigId` - Assign deck to different config group
- [ ] `cloneDeckConfigId` - Copy deck configuration
- [ ] `removeDeckConfigId` - Delete deck configuration

### 📝 Note Operations
- [ ] `updateNoteFields` - Update only fields (not tags)
- [ ] `getNoteTags` - Get tags for specific notes
- [ ] `removeEmptyNotes` - Delete orphaned notes
- [ ] `notesModTime` - Get note modification timestamps
- [ ] `canAddNotes` - Validate notes before creation

### 🃏 Card Operations
- [ ] `getNextCards` - Get cards in exact review order
- [ ] `areSuspended` - Check suspension status for multiple cards
- [ ] `areDue` - Check if cards are due for review
- [ ] `getIntervals` - Get current intervals for cards
- [ ] `cardsToNotes` - Convert card IDs to note IDs
- [ ] `cardsModTime` - Get card modification timestamps
- [ ] `getDecks` - Get deck names for specific cards
- [ ] `changeDeck` - Move cards between decks
- [ ] `suspended` - Check single card suspension status

### 🔧 Card Scheduling
- [ ] `setEaseFactors` - Manually set ease factors
- [ ] `answerCards` - Batch answer multiple cards
- [ ] `forgetCards` - Reset cards to new state
- [ ] `relearnCards` - Put cards in relearning queue
- [ ] `setSpecificValueOfCard` - Direct card property modification
- [ ] `setDueDate` - Manually set due dates

### 🏷️ Tag Operations
- [ ] `clearUnusedTags` - Remove unused tags from collection
- [ ] `replaceTags` - Replace tags in specific notes
- [ ] `replaceTagsInAllNotes` - Global tag replacement

### 🎨 Model Operations
- [ ] `modelNamesAndIds` - Get model name to ID mapping
- [ ] `modelFieldsOnTemplates` - Analyze field usage
- [ ] `modelTemplates` - Get card generation templates
- [ ] `modelStyling` - Get CSS styling for models
- [ ] `updateModelTemplates` - Update card templates
- [ ] `updateModelStyling` - Update CSS styling

### 📊 Statistics & Reviews
- [ ] `cardReviews` - Get complete review history
- [ ] `getLatestReviewID` - Get most recent review ID
- [ ] `getReviewsOfCards` - Get reviews for specific cards

### 🔄 Sync & Profile
- [ ] `sync` - Sync with AnkiWeb
- [ ] `getProfiles` - List all user profiles
- [ ] `loadProfile` - Switch to different profile
- [ ] `getActiveProfile` - Get current profile name
- [ ] `exportPackage` - Export deck to .apkg file
- [ ] `importPackage` - Import .apkg file

### 🖥️ GUI Operations
- [ ] `guiBrowse` - Open Browse window
- [ ] `guiAddCards` - Open Add Cards dialog
- [ ] `guiCurrentCard` - Get current review card
- [ ] `guiAnswerCard` - Answer current card
- [ ] `guiDeckOverview` - Open deck overview
- [ ] `guiExitAnki` - Close Anki application
- [ ] `guiSelectedNotes` - Get browser selection
- [ ] `guiSelectCard` - Select card in browser
- [ ] `guiEditNote` - Open edit note dialog
- [ ] `guiStartCardTimer` - Start review timer
- [ ] `guiShowQuestion` - Show question side
- [ ] `guiShowAnswer` - Show answer side
- [ ] `guiUndo` - Undo last action
- [ ] `guiDeckBrowser` - Open deck browser
- [ ] `guiDeckReview` - Start review session
- [ ] `guiCheckDatabase` - Check database integrity
- [ ] `guiImportFile` - Open import dialog

### 🛠️ Utility Operations
- [ ] `getMediaDirPath` - Get media folder path
- [ ] `version` - Get Anki-Connect version
- [ ] `requestPermission` - Request API permission
- [ ] `apiReflect` - Get API metadata
- [ ] `reloadCollection` - Reload collection from disk
- [ ] `multi` - Execute multiple actions in batch

## Priority Testing Order

### High Priority (Core Functionality)
1. `getNextCards` - Critical for review simulation
2. `areDue` / `areSuspended` - Status checking
3. `changeDeck` - Card organization
4. `canAddNotes` - Input validation
5. `cardsToNotes` - ID conversion

### Medium Priority (Advanced Features)
1. `setEaseFactors` - Scheduling adjustment
2. `answerCards` - Batch operations
3. `forgetCards` / `relearnCards` - Card state management
4. `replaceTags` / `replaceTagsInAllNotes` - Tag management
5. Model operations (templates, styling)

### Low Priority (GUI/System)
1. GUI operations (require user interaction)
2. Profile management
3. Sync operations
4. Database maintenance

## Test Approach

### Automated Testing
Can test programmatically:
- All read operations (get, find, info)
- State changes (suspend, ease, intervals)
- Batch operations
- Tag management
- Model queries

### Manual Testing Required
Need user interaction:
- GUI operations
- Profile switching
- Sync with AnkiWeb
- Import/Export dialogs

### Risk Assessment
**Safe to test:**
- All read operations
- Temporary state changes (can undo)
- Validation functions

**Test with caution:**
- `setSpecificValueOfCard` - Can break scheduling
- `forgetCards` - Resets progress
- `removeEmptyNotes` - Deletes data
- Model updates - Affects all cards

**Test in test profile:**
- Profile operations
- Sync operations
- Database operations

## Notes
- Some operations may return different results based on Anki version
- GUI operations require Anki desktop app running
- Sync operations require AnkiWeb credentials
- Some operations are destructive and cannot be undone