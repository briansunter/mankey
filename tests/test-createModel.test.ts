import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  setupTestEnvironment,
} from "./test-utils";

describe("createModel Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  // Track created models for cleanup
  const createdModels: string[] = [];

  afterAll(async () => {
    // Clean up created test models
    for (const modelName of createdModels) {
      try {
        await ankiConnect("deleteModel", { modelName });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Unit Tests - Schema Validation", () => {
    test("should require modelName to be non-empty", async () => {
      await expect(
        ankiConnect("createModel", {
          modelName: "",
          inOrderFields: ["Front", "Back"],
          cardTemplates: [
            {
              Name: "Card 1",
              Front: "{{Front}}",
              Back: "{{Back}}",
            },
          ],
        })
      ).rejects.toThrow();
    });

    test("should require at least one field in inOrderFields", async () => {
      await expect(
        ankiConnect("createModel", {
          modelName: "EmptyFieldsModel",
          inOrderFields: [],
          cardTemplates: [
            {
              Name: "Card 1",
              Front: "Test",
              Back: "Test",
            },
          ],
        })
      ).rejects.toThrow();
    });

    test("should require at least one cardTemplate", async () => {
      await expect(
        ankiConnect("createModel", {
          modelName: "NoTemplatesModel",
          inOrderFields: ["Front", "Back"],
          cardTemplates: [],
        })
      ).rejects.toThrow();
    });

    test("should require Name field in cardTemplates", async () => {
      await expect(
        ankiConnect("createModel", {
          modelName: "NoNameModel",
          inOrderFields: ["Front", "Back"],
          cardTemplates: [
            {
              Name: "",
              Front: "{{Front}}",
              Back: "{{Back}}",
            },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe("Integration Tests - Model Creation", () => {
    test("should create a basic model with minimal parameters", async () => {
      const modelName = `TestBasic_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        cardTemplates: [
          {
            Name: "Card 1",
            Front: "{{Front}}",
            Back: "{{Back}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });

    test("should create a model with custom CSS", async () => {
      const modelName = `TestWithCSS_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        css: ".card { font-family: arial; font-size: 20px; text-align: center; }",
        cardTemplates: [
          {
            Name: "Card 1",
            Front: "{{Front}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });

    test("should create a model with multiple fields", async () => {
      const modelName = `TestMultiField_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Word", "Definition", "Example", "Notes"],
        cardTemplates: [
          {
            Name: "Recognition",
            Front: "{{Word}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Definition}}\n\n{{Example}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });

    test("should create a model with multiple card templates", async () => {
      const modelName = `TestMultiTemplate_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["English", "Spanish"],
        cardTemplates: [
          {
            Name: "English to Spanish",
            Front: "{{English}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Spanish}}",
          },
          {
            Name: "Spanish to English",
            Front: "{{Spanish}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{English}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });

    test("should create a cloze deletion model", async () => {
      const modelName = `TestCloze_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Text", "Extra"],
        isCloze: true,
        cardTemplates: [
          {
            Name: "Cloze",
            Front: "{{cloze:Text}}",
            Back: "{{cloze:Text}}\n\n<hr id=answer>\n\n{{Extra}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });

    test("should fail when creating duplicate model name", async () => {
      const modelName = `TestDuplicate_${Date.now()}`;
      createdModels.push(modelName);

      // Create first model
      await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Front", "Back"],
        cardTemplates: [
          {
            Name: "Card 1",
            Front: "{{Front}}",
            Back: "{{Back}}",
          },
        ],
      });

      // Try to create duplicate
      await expect(
        ankiConnect("createModel", {
          modelName,
          inOrderFields: ["Front", "Back"],
          cardTemplates: [
            {
              Name: "Card 1",
              Front: "{{Front}}",
              Back: "{{Back}}",
            },
          ],
        })
      ).rejects.toThrow();
    });

    test("should create model matching the original error case", async () => {
      const modelName = `TestBuildingBlock_${Date.now()}`;
      createdModels.push(modelName);

      const result = await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Building Block", "Short Description"],
        cardTemplates: [
          {
            Name: "Building Block Card",
            Front: "{{#Building Block}}<div class='building-block'>{{Building Block}}</div>{{/Building Block}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{#Short Description}}<div class='short-description'>{{Short Description}}</div>{{/Short Description}}",
          },
        ],
      });

      expect(result).toBeDefined();

      // Verify model was created
      const models = await ankiConnect<string[]>("modelNames");
      expect(models).toContain(modelName);
    });
  });

  describe("Integration Tests - End-to-End with Notes", () => {
    test("should create model and add note to verify it works", async () => {
      const modelName = `TestE2E_${Date.now()}`;
      createdModels.push(modelName);

      // Create model
      await ankiConnect("createModel", {
        modelName,
        inOrderFields: ["Question", "Answer"],
        cardTemplates: [
          {
            Name: "Standard",
            Front: "{{Question}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Answer}}",
          },
        ],
      });

      // Add a note using the newly created model
      const noteIds = await ankiConnect<number[]>("addNotes", {
        notes: [
          {
            deckName: "Default",
            modelName,
            fields: {
              Question: "What is 2+2?",
              Answer: "4",
            },
            tags: ["test", "e2e"],
          },
        ],
      });

      expect(noteIds).toHaveLength(1);
      expect(noteIds[0]).toBeGreaterThan(0);

      // Clean up note
      await ankiConnect("deleteNotes", { notes: noteIds });
    });
  });
});
