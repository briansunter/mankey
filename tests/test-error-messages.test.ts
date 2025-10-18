import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ankiConnect, setupTestEnvironment } from "./test-utils";

/**
 * Tests for improved error messages
 * Verifies that error messages are clear, helpful, and actionable
 */

describe("Error Message Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  const createdNotes: number[] = [];

  afterAll(async () => {
    // Cleanup
    if (createdNotes.length > 0) {
      try {
        await ankiConnect("deleteNotes", { notes: createdNotes });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  test("should provide helpful error message for duplicate notes", async () => {
    const uniqueContent = `ErrorTest_Duplicate_${Date.now()}`;

    // Create first note
    const noteId = await ankiConnect<number>("addNote", {
      note: {
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: uniqueContent,
          Back: "Test",
        },
        tags: ["test-error"],
      },
    });
    createdNotes.push(noteId);

    // Try to create duplicate
    await expect(
      ankiConnect("addNote", {
        note: {
          deckName: "Default",
          modelName: "Basic",
          fields: {
            Front: uniqueContent,
            Back: "Test",
          },
          tags: ["test-error"],
        },
      })
    ).rejects.toThrow(/duplicate|already exists/i);
  });

  test("should provide helpful error message for missing deck", async () => {
    const error = await ankiConnect("addNote", {
      note: {
        deckName: "NonExistentDeck_ErrorTest_123456",
        modelName: "Basic",
        fields: {
          Front: "Test",
          Back: "Test",
        },
      },
    }).catch((e) => e);

    expect(error).toBeDefined();
    expect(error.message).toMatch(/deck/i);
    expect(error.message).toMatch(/not found|create/i);
  });

  test("should provide helpful error message for missing model", async () => {
    const error = await ankiConnect("addNote", {
      note: {
        deckName: "Default",
        modelName: "NonExistentModel_ErrorTest_123456",
        fields: {
          Front: "Test",
          Back: "Test",
        },
      },
    }).catch((e) => e);

    expect(error).toBeDefined();
    expect(error.message).toMatch(/model|note type/i);
    expect(error.message).toMatch(/not found/i);
  });

  test("should provide helpful error message for field mismatch", async () => {
    const error = await ankiConnect("addNote", {
      note: {
        deckName: "Default",
        modelName: "Basic",
        fields: {
          WrongFieldName: "Test",
          AnotherWrongField: "Test",
        },
      },
    }).catch((e) => e);

    expect(error).toBeDefined();
    expect(error.message).toBeDefined();
    // Error could be about missing fields or wrong field names
    expect(error.message).toMatch(/field|empty/i);
  });

  test("should not double-wrap error messages", async () => {
    const error = await ankiConnect("addNote", {
      note: {
        deckName: "NonExistentDeck_123456",
        modelName: "Basic",
        fields: {
          Front: "Test",
          Back: "Test",
        },
      },
    }).catch((e) => e);

    expect(error).toBeDefined();
    // Should not have "Anki-Connect: " repeated multiple times
    const message = error.message || "";
    const ankiConnectCount = (message.match(/Anki-Connect/g) || []).length;
    expect(ankiConnectCount).toBeLessThanOrEqual(1);

    // Should not have "MCP error -32603" repeated
    const mcpErrorCount = (message.match(/MCP error -32603/g) || []).length;
    expect(mcpErrorCount).toBeLessThanOrEqual(1);
  });

  test("should provide actionable guidance in error messages", async () => {
    // Test duplicate error includes guidance
    const uniqueContent = `ErrorTest_Guidance_${Date.now()}`;

    const noteId = await ankiConnect<number>("addNote", {
      note: {
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: uniqueContent,
          Back: "Test",
        },
      },
    });
    createdNotes.push(noteId);

    const error = await ankiConnect("addNote", {
      note: {
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: uniqueContent,
          Back: "Test",
        },
      },
    }).catch((e) => e);

    expect(error.message).toMatch(/allowDuplicate|modify/i);
  });
});
