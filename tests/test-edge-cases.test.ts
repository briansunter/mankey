import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  createTestNote,
  cleanupNotes,
  setupTestEnvironment,
  createTestNotes,
} from "./test-utils";

describe("Edge Cases and Additional Coverage", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  describe("Note Field Edge Cases", () => {
    test("should handle empty fields", async () => {
      const noteId = await createTestNote(
        { Front: "", Back: "Non-empty back" },
        ["empty-front"]
      );
      
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Front.value).toBe("");
      expect(info[0].fields.Back.value).toBe("Non-empty back");
      
      await cleanupNotes([noteId]);
    });

    test("should handle very long field content", async () => {
      const longText = "A".repeat(10000);
      const noteId = await createTestNote(
        { Front: "Long content test", Back: longText },
        ["long-content"]
      );
      
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Back.value.length).toBe(10000);
      
      await cleanupNotes([noteId]);
    });

    test("should handle HTML in fields", async () => {
      const htmlContent = '<b>Bold</b> <i>Italic</i> <div class="test">HTML</div>';
      const noteId = await createTestNote(
        { Front: htmlContent, Back: "HTML test" },
        ["html-content"]
      );
      
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Front.value).toBe(htmlContent);
      
      await cleanupNotes([noteId]);
    });

    test("should handle special unicode characters", async () => {
      const unicodeContent = "🎯 测试 テスト тест ♠♣♥♦";
      const noteId = await createTestNote(
        { Front: unicodeContent, Back: "Unicode test" },
        ["unicode"]
      );
      
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Front.value).toBe(unicodeContent);
      
      await cleanupNotes([noteId]);
    });

    test("should handle field with only whitespace", async () => {
      const noteId = await createTestNote(
        { Front: "   \n\t  ", Back: "Whitespace test" },
        ["whitespace"]
      );
      
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Front.value).toBe("   \n\t  ");
      
      await cleanupNotes([noteId]);
    });
  });

  describe("Card Modification Time Operations", () => {
    test("should get cards modification time", async () => {
      const noteId = await createTestNote();
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${noteId}`,
      });
      
      const modTimes = await ankiConnect("cardsModTime", {
        cards: cards,
      });
      
      expect(Array.isArray(modTimes)).toBe(true);
      expect(modTimes.length).toBe(cards.length);
      modTimes.forEach((time: any) => {
        expect(time).toHaveProperty("cardId");
        expect(time).toHaveProperty("mod");
        expect(typeof time.mod).toBe("number");
      });
      
      await cleanupNotes([noteId]);
    });

    test("should get notes modification time", async () => {
      const noteIds = await createTestNotes(3, "ModTime");
      
      const modTimes = await ankiConnect("notesModTime", {
        notes: noteIds,
      });
      
      expect(Array.isArray(modTimes)).toBe(true);
      expect(modTimes.length).toBe(noteIds.length);
      modTimes.forEach((time: any) => {
        expect(time).toHaveProperty("noteId");
        expect(time).toHaveProperty("mod");
        expect(typeof time.mod).toBe("number");
      });
      
      await cleanupNotes(noteIds);
    });
  });

  describe("Card to Note Mapping", () => {
    test("should map cards to notes", async () => {
      const noteId = await createTestNote();
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${noteId}`,
      });
      
      const noteIds = await ankiConnect<number[]>("cardsToNotes", {
        cards: cards,
      });
      
      expect(Array.isArray(noteIds)).toBe(true);
      expect(noteIds.length).toBe(cards.length);
      noteIds.forEach((id) => {
        expect(id).toBe(noteId);
      });
      
      await cleanupNotes([noteId]);
    });

    test("should handle invalid card IDs in cardsToNotes", async () => {
      const result = await ankiConnect<number[]>("cardsToNotes", {
        cards: [999999999],
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toBeNull();
    });
  });

  describe("Note Validation", () => {
    test("should check if notes can be added", async () => {
      const notes = [
        {
          deckName: "Default",
          modelName: "Basic",
          fields: { Front: "Can add test 1", Back: "Answer 1" },
        },
        {
          deckName: "Default",
          modelName: "Basic",
          fields: { Front: "Can add test 2", Back: "Answer 2" },
        },
      ];
      
      const canAdd = await ankiConnect<boolean[]>("canAddNotes", {
        notes: notes,
      });
      
      expect(Array.isArray(canAdd)).toBe(true);
      expect(canAdd.length).toBe(2);
      canAdd.forEach((can) => {
        expect(typeof can).toBe("boolean");
      });
    });

    test("should detect duplicate notes", async () => {
      const noteContent = {
        Front: "Duplicate test " + Date.now(),
        Back: "Duplicate answer",
      };
      
      // Create first note
      const firstNoteId = await createTestNote(noteContent);
      
      // Check if duplicate can be added
      const canAdd = await ankiConnect<boolean[]>("canAddNotes", {
        notes: [
          {
            deckName: "Default",
            modelName: "Basic",
            fields: noteContent,
          },
        ],
      });
      
      expect(canAdd[0]).toBe(false); // Should detect duplicate
      
      await cleanupNotes([firstNoteId]);
    });
  });

  describe("Tag Operations Edge Cases", () => {
    test("should handle getting tags for non-existent note", async () => {
      await expect(
        ankiConnect("getNoteTags", { note: 999999999 })
      ).rejects.toThrow();
    });

    test("should clear all unused tags", async () => {
      // Create a note with unique tag
      const uniqueTag = "unique-tag-" + Date.now();
      const noteId = await createTestNote(
        { Front: "Tag test", Back: "Answer" },
        [uniqueTag]
      );
      
      // Remove the tag
      await ankiConnect("removeTags", {
        notes: [noteId],
        tags: uniqueTag,
      });
      
      // Clear unused tags
      const result = await ankiConnect("clearUnusedTags");
      expect(result).toBe(true);
      
      // Verify tag is gone
      const allTags = await ankiConnect<string[]>("getTags");
      expect(allTags).not.toContain(uniqueTag);
      
      await cleanupNotes([noteId]);
    });

    test("should replace tags in all notes", async () => {
      const oldTag = "old-tag-" + Date.now();
      const newTag = "new-tag-" + Date.now();
      
      // Create notes with old tag
      const noteIds = await ankiConnect<number[]>("addNotes", {
        notes: Array.from({ length: 3 }, (_, i) => ({
          deckName: "Default",
          modelName: "Basic",
          fields: {
            Front: `Replace tag test ${i}`,
            Back: `Answer ${i}`,
          },
          tags: [oldTag],
        })),
      });
      
      // Replace tag in all notes
      const result = await ankiConnect("replaceTagsInAllNotes", {
        tag_to_replace: oldTag,
        replace_with_tag: newTag,
      });
      expect(result).toBe(true);
      
      // Verify replacement
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: noteIds,
      });
      
      info.forEach((note) => {
        expect(note.tags).toContain(newTag);
        expect(note.tags).not.toContain(oldTag);
      });
      
      await cleanupNotes(noteIds);
    });
  });

  describe("Advanced Card Statistics", () => {
    test("should get card reviews", async () => {
      const reviews = await ankiConnect("cardReviews", {
        deck: "Default",
        startID: 0,
      });
      
      expect(Array.isArray(reviews)).toBe(true);
      
      if (reviews.length > 0) {
        const review = reviews[0];
        expect(review).toHaveProperty("id");
        expect(review).toHaveProperty("cid");
        expect(review).toHaveProperty("ease");
        expect(review).toHaveProperty("ivl");
        expect(review).toHaveProperty("lastIvl");
        expect(review).toHaveProperty("factor");
        expect(review).toHaveProperty("time");
        expect(review).toHaveProperty("type");
      }
    });

    test("should get reviews of specific cards", async () => {
      const noteId = await createTestNote();
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${noteId}`,
      });
      
      const reviews = await ankiConnect("getReviewsOfCards", {
        cards: cards,
      });
      
      expect(typeof reviews).toBe("object");
      cards.forEach((cardId) => {
        expect(reviews).toHaveProperty(cardId.toString());
        expect(Array.isArray(reviews[cardId])).toBe(true);
      });
      
      await cleanupNotes([noteId]);
    });

    test("should get latest review ID", async () => {
      const latestId = await ankiConnect<number>("getLatestReviewID", {
        deck: "Default",
      });
      expect(typeof latestId).toBe("number");
    });
  });

  describe("Model Field Operations", () => {
    test("should get model field names on templates", async () => {
      const fields = await ankiConnect("modelFieldsOnTemplates", {
        modelName: "Basic",
      });
      
      expect(typeof fields).toBe("object");
      expect(Object.keys(fields).length).toBeGreaterThan(0);
      
      // Basic model should have Card 1 template
      if (fields["Card 1"]) {
        expect(Array.isArray(fields["Card 1"])).toBe(true);
      }
    });

    test("should update note with partial fields", async () => {
      const noteId = await createTestNote(
        { Front: "Original front", Back: "Original back" },
        ["update-test"]
      );
      
      // Update only Front field
      const result = await ankiConnect("updateNoteFields", {
        note: {
          id: noteId,
          fields: { Front: "Updated front" },
        },
      });
      expect(result).toBe(true);
      
      // Verify update
      const info = await ankiConnect<any[]>("notesInfo", {
        notes: [noteId],
      });
      
      expect(info[0].fields.Front.value).toBe("Updated front");
      expect(info[0].fields.Back.value).toBe("Original back"); // Unchanged
      
      await cleanupNotes([noteId]);
    });
  });

  describe("Deck Statistics Edge Cases", () => {
    test("should get stats for multiple decks", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: ["Default"],
      });
      
      expect(typeof stats).toBe("object");
      expect(stats).toHaveProperty("Default");
      
      const defaultStats = stats.Default;
      expect(defaultStats).toHaveProperty("new_count");
      expect(defaultStats).toHaveProperty("learn_count");
      expect(defaultStats).toHaveProperty("review_count");
      expect(defaultStats).toHaveProperty("total_in_deck");
    });

    test("should handle non-existent deck in stats", async () => {
      const stats = await ankiConnect("getDeckStats", {
        decks: ["NonExistentDeck999"],
      });
      
      expect(typeof stats).toBe("object");
      // May return empty object or null for non-existent deck
    });
  });

  describe("Collection-wide Operations", () => {
    test("should get collection stats HTML", async () => {
      const wholeCollection = await ankiConnect<string>(
        "getCollectionStatsHTML",
        { wholeCollection: true }
      );
      
      expect(typeof wholeCollection).toBe("string");
      expect(wholeCollection.length).toBeGreaterThan(0);
      expect(wholeCollection).toContain("<");  // Should contain HTML
      
      const deckStats = await ankiConnect<string>(
        "getCollectionStatsHTML",
        { wholeCollection: false }
      );
      
      expect(typeof deckStats).toBe("string");
      expect(deckStats.length).toBeGreaterThan(0);
    });

    test("should get active profile name", async () => {
      const profile = await ankiConnect<string>("getActiveProfile");
      expect(typeof profile).toBe("string");
      expect(profile.length).toBeGreaterThan(0);
    });
  });

  describe("Set Due Date Operations", () => {
    test("should set due date for cards", async () => {
      const noteId = await createTestNote();
      const cards = await ankiConnect<number[]>("findCards", {
        query: `nid:${noteId}`,
      });
      
      // Set due date to tomorrow
      const result = await ankiConnect("setDueDate", {
        cards: cards,
        days: "1",
      });
      expect(result).toBe(true);
      
      // Set due date to specific days range
      const rangeResult = await ankiConnect("setDueDate", {
        cards: cards,
        days: "1-3",
      });
      expect(rangeResult).toBe(true);
      
      await cleanupNotes([noteId]);
    });
  });

  describe("Media Directory Operations", () => {
    test("should get media directory path", async () => {
      const path = await ankiConnect<string>("getMediaDirPath");
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
      expect(path).toContain("collection.media");
    });

    test("should list media files with pattern", async () => {
      const files = await ankiConnect<string[]>("getMediaFilesNames", {
        pattern: "*.jpg",
      });
      
      expect(Array.isArray(files)).toBe(true);
      // May or may not have jpg files
      
      const allFiles = await ankiConnect<string[]>("getMediaFilesNames", {
        pattern: "*",
      });
      
      expect(Array.isArray(allFiles)).toBe(true);
    });
  });
});