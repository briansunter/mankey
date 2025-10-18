import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  ankiConnect,
  setupTestEnvironment,
} from "./test-utils";

describe("HTML and CSS Styling Tests", () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  // Track created models and notes for cleanup
  const createdModels: string[] = [];
  const createdNotes: number[] = [];

  afterAll(async () => {
    // Clean up created test notes
    if (createdNotes.length > 0) {
      try {
        await ankiConnect("deleteNotes", { notes: createdNotes });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }

    // Clean up created test models
    for (const modelName of createdModels) {
      try {
        await ankiConnect("deleteModel", { modelName });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  test("should create model with rich HTML/CSS styling and verify templates", async () => {
    const modelName = `TestHTMLCSS_${Date.now()}`;
    createdModels.push(modelName);

    const cssStyle = `
.card {
  font-family: Arial, sans-serif;
  font-size: 20px;
  text-align: center;
  color: #333;
  background-color: #f9f9f9;
  padding: 20px;
}

.question {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 20px;
}

.answer {
  font-size: 18px;
  color: #27ae60;
  padding: 15px;
  background-color: #ecf0f1;
  border-radius: 5px;
  margin-top: 10px;
}

.hint {
  font-size: 14px;
  font-style: italic;
  color: #7f8c8d;
}
`;

    // Create model with HTML and CSS
    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Question", "Answer", "Hint"],
      css: cssStyle,
      cardTemplates: [
        {
          Name: "Card 1",
          Front: `
<div class="question">
  {{Question}}
</div>
{{#Hint}}
<div class="hint">
  Hint: {{Hint}}
</div>
{{/Hint}}
`,
          Back: `
{{FrontSide}}

<hr id="answer">

<div class="answer">
  {{Answer}}
</div>
`,
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify model was created
    const models = await ankiConnect<string[]>("modelNames");
    expect(models).toContain(modelName);

    // Verify CSS styling is preserved
    const modelStyling = await ankiConnect<string>("modelStyling", { modelName });
    expect(modelStyling).toBe(cssStyle);

    // Verify templates are preserved
    const templates = await ankiConnect<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    expect(templates["Card 1"]).toBeDefined();
    expect(templates["Card 1"].Front).toContain('class="question"');
    expect(templates["Card 1"].Front).toContain('class="hint"');
    expect(templates["Card 1"].Back).toContain('class="answer"');

    // Add a note to verify the model works end-to-end
    const noteIds = await ankiConnect<number[]>("addNotes", {
      notes: [
        {
          deckName: "Default",
          modelName,
          fields: {
            Question: "What is <strong>HTML</strong>?",
            Answer: "HyperText <em>Markup</em> Language",
            Hint: "It's used for web pages",
          },
          tags: ["test", "html-css"],
        },
      ],
    });

    expect(noteIds).toHaveLength(1);
    expect(noteIds[0]).toBeGreaterThan(0);
    createdNotes.push(noteIds[0]);

    // Verify the note fields contain HTML
    const noteInfo = await ankiConnect<Array<{
      fields: Record<string, { value: string }>;
    }>>("notesInfo", { notes: [noteIds[0]] });

    expect(noteInfo[0].fields.Question.value).toContain("<strong>");
    expect(noteInfo[0].fields.Answer.value).toContain("<em>");
  });

  test("should create model with complex CSS including media queries", async () => {
    const modelName = `TestComplexCSS_${Date.now()}`;
    createdModels.push(modelName);

    const complexCSS = `
.card {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.front {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.back {
  background-color: #ffffff;
  border: 2px solid #667eea;
  padding: 20px;
  border-radius: 8px;
}

@media (max-width: 600px) {
  .card {
    font-size: 16px;
    padding: 10px;
  }
}

code {
  background-color: #f4f4f4;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}
`;

    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Front", "Back"],
      css: complexCSS,
      cardTemplates: [
        {
          Name: "Standard",
          Front: '<div class="front">{{Front}}</div>',
          Back: '{{FrontSide}}<hr id="answer"><div class="back">{{Back}}</div>',
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify CSS is preserved exactly as provided
    const modelStyling = await ankiConnect<string>("modelStyling", { modelName });
    expect(modelStyling).toBe(complexCSS);
    expect(modelStyling).toContain("@media");
    expect(modelStyling).toContain("linear-gradient");
    expect(modelStyling).toContain("box-shadow");
  });

  test("should create cloze model with custom styling", async () => {
    const modelName = `TestClozeStyled_${Date.now()}`;
    createdModels.push(modelName);

    const clozeCSS = `
.card {
  font-family: Georgia, serif;
  font-size: 18px;
  line-height: 1.6;
  padding: 30px;
  background-color: #fffef7;
}

.cloze {
  font-weight: bold;
  color: #c0392b;
  background-color: #ffeaa7;
  padding: 2px 5px;
  border-radius: 3px;
}

.extra {
  margin-top: 20px;
  padding: 15px;
  background-color: #e8f4f8;
  border-left: 4px solid #3498db;
  font-size: 16px;
}
`;

    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Text", "Extra"],
      isCloze: true,
      css: clozeCSS,
      cardTemplates: [
        {
          Name: "Cloze",
          Front: '<div class="cloze">{{cloze:Text}}</div>',
          Back: '{{cloze:Text}}<hr id="answer"><div class="extra">{{Extra}}</div>',
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify it's a cloze model
    const models = await ankiConnect<string[]>("modelNames");
    expect(models).toContain(modelName);

    // Verify CSS
    const modelStyling = await ankiConnect<string>("modelStyling", { modelName });
    expect(modelStyling).toBe(clozeCSS);

    // Add a cloze note
    const noteIds = await ankiConnect<number[]>("addNotes", {
      notes: [
        {
          deckName: "Default",
          modelName,
          fields: {
            Text: "The capital of {{c1::France}} is {{c2::Paris}}",
            Extra: "France is in Western Europe",
          },
          tags: ["test", "cloze-styled"],
        },
      ],
    });

    expect(noteIds).toHaveLength(1);
    expect(noteIds[0]).toBeGreaterThan(0);
    createdNotes.push(noteIds[0]);
  });

  test("should handle model with no CSS (default styling)", async () => {
    const modelName = `TestNoCSS_${Date.now()}`;
    createdModels.push(modelName);

    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Front", "Back"],
      // No css parameter provided
      cardTemplates: [
        {
          Name: "Card 1",
          Front: "{{Front}}",
          Back: "{{FrontSide}}<hr id=answer>{{Back}}",
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify model was created
    const models = await ankiConnect<string[]>("modelNames");
    expect(models).toContain(modelName);

    // Check styling - should have Anki's default or empty
    const modelStyling = await ankiConnect<string>("modelStyling", { modelName });
    expect(typeof modelStyling).toBe("string");
  });

  test("should preserve HTML entities and special characters in templates", async () => {
    const modelName = `TestSpecialChars_${Date.now()}`;
    createdModels.push(modelName);

    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Question", "Answer"],
      cardTemplates: [
        {
          Name: "Card 1",
          Front: "<div>{{Question}}</div><p>&nbsp;</p>",
          Back: '{{FrontSide}}<hr id="answer"><div>{{Answer}}</div><p>Testing &lt; &gt; &amp; &quot;</p>',
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify templates preserve HTML entities
    const templates = await ankiConnect<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    expect(templates["Card 1"].Front).toContain("&nbsp;");
    expect(templates["Card 1"].Back).toContain("&lt;");
    expect(templates["Card 1"].Back).toContain("&gt;");
    expect(templates["Card 1"].Back).toContain("&amp;");
  });

  test("should create model with inline styles in templates", async () => {
    const modelName = `TestInlineStyles_${Date.now()}`;
    createdModels.push(modelName);

    const result = await ankiConnect("createModel", {
      modelName,
      inOrderFields: ["Term", "Definition"],
      cardTemplates: [
        {
          Name: "Card 1",
          Front: '<div style="color: blue; font-size: 24px; text-align: center;">{{Term}}</div>',
          Back: '{{FrontSide}}<hr id="answer"><div style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">{{Definition}}</div>',
        },
      ],
    });

    expect(result).toBeDefined();

    // Verify inline styles are preserved
    const templates = await ankiConnect<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    expect(templates["Card 1"].Front).toContain('style="color: blue');
    expect(templates["Card 1"].Back).toContain('style="background-color: #f0f0f0');

    // Add note and verify
    const noteIds = await ankiConnect<number[]>("addNotes", {
      notes: [
        {
          deckName: "Default",
          modelName,
          fields: {
            Term: "Test Term",
            Definition: "Test Definition",
          },
          tags: ["test", "inline-styles"],
        },
      ],
    });

    expect(noteIds).toHaveLength(1);
    createdNotes.push(noteIds[0]);
  });
});
