#!/usr/bin/env bun

// Test script to verify Anki-Connect API is working
// Run this with: bun test-anki-connect.ts

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Helper function to make Anki-Connect API calls
async function testAnkiConnect(action: string, params?: any) {
  const requestBody = {
    action,
    version: ANKI_CONNECT_VERSION,
    params: params || {}
  };

  try {
    console.log(`\n📝 Testing: ${action}`);
    console.log(`Request: ${JSON.stringify(params || {}, null, 2)}`);
    
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`❌ HTTP error! status: ${response.status}`);
      return null;
    }

    const data = await response.json() as { error?: string; result?: any };

    if (data.error) {
      console.error(`❌ Anki-Connect error: ${data.error}`);
      return null;
    }

    console.log(`✅ Success! Result:`, JSON.stringify(data.result, null, 2));
    return data.result;
  } catch (_error) {
    console.error(`❌ Failed to connect to Anki-Connect at ${ANKI_CONNECT_URL}`);
    console.error(`   Make sure Anki is running with Anki-Connect plugin installed`);
    console.error(`   Error: ${_error}`);
    return null;
  }
}

async function runTests() {
  console.log("🚀 Starting Anki-Connect API Tests");
  console.log("=" .repeat(50));

  // Test 1: Check version
  const version = await testAnkiConnect("version");
  if (!version) {
    console.error("\n❌ Cannot connect to Anki-Connect. Make sure:");
    console.error("   1. Anki is running");
    console.error("   2. Anki-Connect plugin is installed");
    console.error("   3. Anki-Connect is listening on port 8765");
    return;
  }

  // Test 2: Get deck names
  await testAnkiConnect("deckNames");

  // Test 3: Get model names
  await testAnkiConnect("modelNames");

  // Test 4: Get tags
  await testAnkiConnect("getTags");

  // Test 5: Find cards in current deck
  await testAnkiConnect("findCards", { query: "deck:current" });

  // Test 6: Get collection stats
  await testAnkiConnect("getNumCardsReviewedToday");

  // Test 7: Get profiles
  await testAnkiConnect("getProfiles");

  // Test 8: Test adding a note (dry run - check if we can)
  await testAnkiConnect("canAddNotes", {
    notes: [{
      deckName: "Default",
      modelName: "Basic",
      fields: {
        Front: "Test Question",
        Back: "Test Answer"
      },
      tags: ["test", "mcp-server"]
    }]
  });

  console.log("\n" + "=" .repeat(50));
  console.log("✅ Anki-Connect API tests completed!");
  console.log("\nYou can now use the MCP server with: bun run src/index.ts");
}

// Run the tests
runTests().catch(console.error);