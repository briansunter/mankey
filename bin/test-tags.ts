#!/usr/bin/env bun

// Test script to verify tag handling in Anki MCP server

const ANKI_URL = 'http://127.0.0.1:8765';

// Helper to call Anki-Connect directly
async function ankiConnect(action: string, params: any = {}) {
  const response = await fetch(ANKI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  const result = await response.json();
  if (result.error) {
    throw new Error(`AnkiConnect error: ${result.error}`);
  }
  return result.result;
}

// Test cases for different tag formats
const testCases = [
  {
    name: "Array of strings",
    input: ["test", "mcp", "array"],
    expected: ["test", "mcp", "array"]
  },
  {
    name: "JSON stringified array",
    input: '["test", "mcp", "json"]',
    expected: ["test", "mcp", "json"]
  },
  {
    name: "Space-separated string",
    input: "test mcp string",
    expected: ["test", "mcp", "string"]
  },
  {
    name: "Empty array",
    input: [],
    expected: []
  },
  {
    name: "Single tag array",
    input: ["single"],
    expected: ["single"]
  },
  {
    name: "Malformed JSON string",
    input: '["test",',
    expected: ["test"] // Should parse what it can or fallback
  }
];

// Helper to normalize tags for testing
function normalizeTags(tags: any): string[] {
  console.log("🔍 Input:", JSON.stringify(tags), "Type:", typeof tags);
  
  // If already an array, return it
  if (Array.isArray(tags)) {
    console.log("✅ Already an array");
    return tags;
  }
  
  // If it's a string
  if (typeof tags === 'string') {
    // Try to parse as JSON first
    if (tags.startsWith('[') && tags.endsWith(']')) {
      try {
        const parsed = JSON.parse(tags);
        console.log("✅ Parsed JSON:", parsed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.log("⚠️ Failed to parse JSON, falling back to space-split");
      }
    }
    
    // Fall back to space-separated
    const split = tags.split(' ').filter(t => t.trim());
    console.log("✅ Split by space:", split);
    return split;
  }
  
  console.log("❌ Unknown type, returning empty array");
  return [];
}

async function runTests() {
  console.log("🧪 Starting tag handling tests...\n");
  
  // Test the normalization function
  console.log("📝 Testing normalizeTags function:");
  console.log("="*50);
  
  for (const testCase of testCases) {
    console.log(`\n📌 Test: ${testCase.name}`);
    const result = normalizeTags(testCase.input);
    const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}`);
    console.log(`   Status:   ${passed ? "✅ PASS" : "❌ FAIL"}`);
  }
  
  // Test with actual Anki-Connect
  console.log("\n\n🔗 Testing with Anki-Connect:");
  console.log("="*50);
  
  try {
    // Create a test note
    const noteId = await ankiConnect("addNote", {
      note: {
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: "Tag Test Card",
          Back: "Testing tag handling"
        },
        tags: ["initial", "test"]
      }
    });
    
    console.log(`\n✅ Created test note: ${noteId}`);
    
    // Test updateNote with different tag formats
    await ankiConnect("updateNote", {
      note: {
        id: noteId,
        tags: ["updated", "via", "api"]
      }
    });
    
    console.log("✅ Updated tags via API");
    
    // Get the note info to verify
    const noteInfo = await ankiConnect("notesInfo", {
      notes: [noteId]
    });
    
    console.log(`📋 Current tags: ${JSON.stringify(noteInfo[0].tags)}`);
    
    // Clean up
    await ankiConnect("deleteNotes", {
      notes: [noteId]
    });
    
    console.log("✅ Cleaned up test note");
    
  } catch (error) {
    console.error("❌ Anki-Connect test failed:", error);
  }
  
  console.log("\n✅ Tests completed!");
}

// Run the tests
runTests().catch(console.error);