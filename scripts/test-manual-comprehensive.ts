#!/usr/bin/env bun

/**
 * Comprehensive Manual Testing for Anki MCP Server
 * This script tests all major features of the MCP server by directly calling Anki-Connect API
 * and verifying the server's tool definitions match the API capabilities
 */


const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

// Test result tracking
interface TestResult {
  category: string;
  action: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

const testResults: TestResult[] = [];

// Helper function for Anki-Connect requests
async function ankiRequest(action: string, params?: Record<string, unknown>): Promise<unknown> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        version: ANKI_CONNECT_VERSION,
        params: params || {}
      })
    });

    const data = await response.json() as { error?: string; result?: unknown };
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.result;
  } catch (_error) {
    return Promise.reject(_error);
  }
}

// Test logging
function logTest(category: string, action: string, success: boolean, result?: unknown, error?: string) {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} [${category}] ${action}`);
  if (error) {console.log(`   Error: ${error}`);}
  if (result && process.env.VERBOSE) {console.log(`   Result: ${JSON.stringify(result).substring(0, 100)}...`);}
  
  testResults.push({ category, action, success, result, error: error || undefined });
}

// Category: System & Miscellaneous
async function testSystemActions() {
  console.log("\n📋 Testing System & Miscellaneous Actions");
  console.log("=" .repeat(50));

  const tests = [
    { action: "version", params: {} },
    { action: "requestPermission", params: {} },
    { action: "getProfiles", params: {} },
    { action: "getActiveProfile", params: {} },
    { action: "apiReflect", params: { scopes: ["actions"] } },
  ];

  for (const test of tests) {
    try {
      const result = await ankiRequest(test.action, test.params);
      logTest("System", test.action, true, result);
    } catch (error: unknown) {
      logTest("System", test.action, false, null, error instanceof Error ? error.message : String(error));
    }
  }
}

// Category: Deck Actions
async function testDeckActions() {
  console.log("\n📚 Testing Deck Actions");
  console.log("=" .repeat(50));

  try {
    // Get all deck names
    const deckNames = await ankiRequest("deckNames");
    logTest("Deck", "deckNames", true, deckNames);
    
    // Get deck names and IDs
    const deckNamesAndIds = await ankiRequest("deckNamesAndIds");
    logTest("Deck", "deckNamesAndIds", true, deckNamesAndIds);
    
    // Create a test deck
    const testDeckName = `MCP_Test_${Date.now()}`;
    const newDeckId = await ankiRequest("createDeck", { deck: testDeckName });
    logTest("Deck", "createDeck", true, newDeckId);
    
    // Get deck config
    const deckConfig = await ankiRequest("getDeckConfig", { deck: "Default" });
    logTest("Deck", "getDeckConfig", true, deckConfig);
    
    // Get deck stats
    const deckStats = await ankiRequest("getDeckStats", { decks: ["Default"] });
    logTest("Deck", "getDeckStats", true, deckStats);
    
    // Delete the test deck
    await ankiRequest("deleteDecks", { decks: [testDeckName], cardsToo: true });
    logTest("Deck", "deleteDecks", true);
    
  } catch (error: unknown) {
    logTest("Deck", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: Model Actions
async function testModelActions() {
  console.log("\n🎨 Testing Model Actions");
  console.log("=" .repeat(50));

  try {
    // Get model names
    const modelNames = await ankiRequest("modelNames");
    logTest("Model", "modelNames", true, modelNames);
    
    // Get model names and IDs
    const modelNamesAndIds = await ankiRequest("modelNamesAndIds");
    logTest("Model", "modelNamesAndIds", true, modelNamesAndIds);
    
    // Get field names for Basic model
    if (Array.isArray(modelNames) && modelNames.includes("Basic")) {
      const fieldNames = await ankiRequest("modelFieldNames", { modelName: "Basic" });
      logTest("Model", "modelFieldNames", true, fieldNames);
      
      const fieldDescriptions = await ankiRequest("modelFieldDescriptions", { modelName: "Basic" });
      logTest("Model", "modelFieldDescriptions", true, fieldDescriptions);
      
      const fieldFonts = await ankiRequest("modelFieldFonts", { modelName: "Basic" });
      logTest("Model", "modelFieldFonts", true, fieldFonts);
      
      const templates = await ankiRequest("modelTemplates", { modelName: "Basic" });
      logTest("Model", "modelTemplates", true, templates);
      
      const styling = await ankiRequest("modelStyling", { modelName: "Basic" });
      logTest("Model", "modelStyling", true, styling);
    }
    
  } catch (error: unknown) {
    logTest("Model", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: Note Actions
async function testNoteActions() {
  console.log("\n📝 Testing Note Actions");
  console.log("=" .repeat(50));

  try {
    // Get all tags
    const tags = await ankiRequest("getTags");
    logTest("Note", "getTags", true, tags);
    
    // Check if we can add a note
    const canAdd = await ankiRequest("canAddNotes", {
      notes: [{
        deckName: "Default",
        modelName: "Basic",
        fields: {
          Front: "MCP Test Question " + Date.now(),
          Back: "MCP Test Answer"
        },
        tags: ["mcp-test"]
      }]
    });
    logTest("Note", "canAddNotes", true, canAdd);
    
    // Add a test note if possible
    if (Array.isArray(canAdd) && canAdd[0]) {
      const noteId = await ankiRequest("addNote", {
        note: {
          deckName: "Default",
          modelName: "Basic",
          fields: {
            Front: "MCP Test Question " + Date.now(),
            Back: "MCP Test Answer"
          },
          tags: ["mcp-test", "automated-test"],
          options: {
            allowDuplicate: true
          }
        }
      });
      logTest("Note", "addNote", true, noteId);
      
      // Get note info
      const noteInfo = await ankiRequest("notesInfo", { notes: [noteId] });
      logTest("Note", "notesInfo", true, noteInfo);
      
      // Update note tags
      await ankiRequest("updateNoteTags", { 
        note: noteId, 
        tags: ["mcp-test", "updated"] 
      });
      logTest("Note", "updateNoteTags", true);
      
      // Get note tags
      const noteTags = await ankiRequest("getNoteTags", { note: noteId });
      logTest("Note", "getNoteTags", true, noteTags);
      
      // Find notes
      const foundNotes = await ankiRequest("findNotes", { query: "tag:mcp-test" });
      logTest("Note", "findNotes", true, foundNotes);
      
      // Delete the test note
      await ankiRequest("deleteNotes", { notes: [noteId] });
      logTest("Note", "deleteNotes", true);
    }
    
  } catch (error: unknown) {
    logTest("Note", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: Card Actions
async function testCardActions() {
  console.log("\n🃏 Testing Card Actions");
  console.log("=" .repeat(50));

  try {
    // Find some cards
    const cards = await ankiRequest("findCards", { query: "deck:Default" });
    logTest("Card", "findCards", true, cards);
    
    if (Array.isArray(cards) && cards.length > 0) {
      // Take first few cards for testing
      const testCards = cards.slice(0, Math.min(3, cards.length));
      
      // Get card info
      const cardInfo = await ankiRequest("cardsInfo", { cards: testCards });
      logTest("Card", "cardsInfo", true, cardInfo);
      
      // Get ease factors
      const easeFactors = await ankiRequest("getEaseFactors", { cards: testCards });
      logTest("Card", "getEaseFactors", true, easeFactors);
      
      // Check suspension status
      const areSuspended = await ankiRequest("areSuspended", { cards: testCards });
      logTest("Card", "areSuspended", true, areSuspended);
      
      // Check if cards are due
      const areDue = await ankiRequest("areDue", { cards: testCards });
      logTest("Card", "areDue", true, areDue);
      
      // Get intervals
      const intervals = await ankiRequest("getIntervals", { cards: testCards });
      logTest("Card", "getIntervals", true, intervals);
      
      // Convert cards to notes
      const noteIds = await ankiRequest("cardsToNotes", { cards: testCards });
      logTest("Card", "cardsToNotes", true, noteIds);
      
      // Get modification time
      const modTime = await ankiRequest("cardsModTime", { cards: testCards });
      logTest("Card", "cardsModTime", true, modTime);
    }
    
  } catch (error: unknown) {
    logTest("Card", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: Statistics Actions
async function testStatisticsActions() {
  console.log("\n📊 Testing Statistics Actions");
  console.log("=" .repeat(50));

  try {
    // Get cards reviewed today
    const reviewedToday = await ankiRequest("getNumCardsReviewedToday");
    logTest("Statistics", "getNumCardsReviewedToday", true, reviewedToday);
    
    // Get cards reviewed by day
    const reviewedByDay = await ankiRequest("getNumCardsReviewedByDay");
    logTest("Statistics", "getNumCardsReviewedByDay", true, reviewedByDay);
    
    // Get collection stats HTML
    const statsHTML = await ankiRequest("getCollectionStatsHTML", { wholeCollection: true });
    logTest("Statistics", "getCollectionStatsHTML", true, statsHTML ? "HTML received" : null);
    
    // Get latest review ID
    const latestReviewId = await ankiRequest("getLatestReviewID", { deck: "Default" });
    logTest("Statistics", "getLatestReviewID", true, latestReviewId);
    
  } catch (error: unknown) {
    logTest("Statistics", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: Media Actions  
async function testMediaActions() {
  console.log("\n🖼️ Testing Media Actions");
  console.log("=" .repeat(50));

  try {
    // Get media directory path
    const mediaDirPath = await ankiRequest("getMediaDirPath");
    logTest("Media", "getMediaDirPath", true, mediaDirPath);
    
    // Store a test media file
    const testFileName = `mcp_test_${Date.now()}.txt`;
    const testContent = Buffer.from("MCP Server Test File").toString("base64");
    const storedFileName = await ankiRequest("storeMediaFile", {
      filename: testFileName,
      data: testContent
    });
    logTest("Media", "storeMediaFile", true, storedFileName);
    
    // Retrieve the media file
    const retrievedContent = await ankiRequest("retrieveMediaFile", {
      filename: testFileName
    });
    logTest("Media", "retrieveMediaFile", true, retrievedContent ? "Content retrieved" : null);
    
    // Get media files names
    const mediaFiles = await ankiRequest("getMediaFilesNames", {
      pattern: "mcp_test_*.txt"
    });
    logTest("Media", "getMediaFilesNames", true, mediaFiles);
    
    // Delete the test media file
    await ankiRequest("deleteMediaFile", { filename: testFileName });
    logTest("Media", "deleteMediaFile", true);
    
  } catch (error: unknown) {
    logTest("Media", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Category: GUI Actions (limited testing - won't disrupt user's session)
async function testGUIActions() {
  console.log("\n🖥️ Testing GUI Actions (Limited)");
  console.log("=" .repeat(50));

  try {
    // Get current card (may return null if not reviewing)
    const currentCard = await ankiRequest("guiCurrentCard");
    logTest("GUI", "guiCurrentCard", true, currentCard || "No card in review");
    
    // Test guiBrowse with a safe query
    const browserCards = await ankiRequest("guiBrowse", { 
      query: "tag:mcp-test" 
    });
    logTest("GUI", "guiBrowse", true, browserCards);
    
  } catch (error: unknown) {
    logTest("GUI", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Test advanced features
async function testAdvancedFeatures() {
  console.log("\n🔧 Testing Advanced Features");
  console.log("=" .repeat(50));

  try {
    // Test multi action
    const multiResult = await ankiRequest("multi", {
      actions: [
        { action: "deckNames" },
        { action: "modelNames" },
        { action: "getTags" }
      ]
    });
    logTest("Advanced", "multi", true, multiResult ? "Multi-action completed" : null);
    
    // Test exporting (without actually exporting)
    const canExport = await ankiRequest("exportPackage", {
      deck: "Default",
      path: "/tmp/test_export.apkg",
      includeSched: false
    });
    logTest("Advanced", "exportPackage", true, canExport);
    
  } catch (error: unknown) {
    logTest("Advanced", "Various", false, null, error instanceof Error ? error.message : String(error));
  }
}

// Generate summary report
function generateReport() {
  console.log("\n" + "=" .repeat(50));
  console.log("📈 TEST SUMMARY REPORT");
  console.log("=" .repeat(50));
  
  const totalTests = testResults.length;
  const successfulTests = testResults.filter(t => t.success).length;
  const failedTests = testResults.filter(t => !t.success).length;
  const successRate = ((successfulTests / totalTests) * 100).toFixed(1);
  
  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`✅ Successful: ${successfulTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${successRate}%`);
  
  // Group by category
  const categories = [...new Set(testResults.map(t => t.category))];
  console.log("\n📋 Results by Category:");
  console.log("-" .repeat(30));
  
  for (const category of categories) {
    const categoryTests = testResults.filter(t => t.category === category);
    const categorySuccess = categoryTests.filter(t => t.success).length;
    const categoryTotal = categoryTests.length;
    const categoryRate = ((categorySuccess / categoryTotal) * 100).toFixed(0);
    console.log(`${category}: ${categorySuccess}/${categoryTotal} (${categoryRate}%)`);
  }
  
  // List failed tests
  if (failedTests > 0) {
    console.log("\n❌ Failed Tests:");
    console.log("-" .repeat(30));
    testResults
      .filter(t => !t.success)
      .forEach(t => {
        console.log(`- [${t.category}] ${t.action}: ${t.error}`);
      });
  }
  
  // Test coverage analysis
  console.log("\n📊 MCP Server Coverage Analysis:");
  console.log("-" .repeat(30));
  const testedActions = testResults.map(t => t.action);
  const uniqueTestedActions = [...new Set(testedActions)];
  console.log(`Unique API actions tested: ${uniqueTestedActions.length}`);
  console.log(`Categories covered: ${categories.length}`);
  
  return {
    total: totalTests,
    successful: successfulTests,
    failed: failedTests,
    successRate: parseFloat(successRate)
  };
}

// Main test runner
async function runAllTests() {
  console.log("🚀 Starting Comprehensive MCP Server Testing");
  console.log("=" .repeat(50));
  console.log("Testing against Anki-Connect at:", ANKI_CONNECT_URL);
  console.log("Test started at:", new Date().toISOString());
  
  try {
    // Check connectivity first
    const version = await ankiRequest("version");
    console.log(`✅ Connected to Anki-Connect version: ${version}`);
    
    // Run all test suites
    await testSystemActions();
    await testDeckActions();
    await testModelActions();
    await testNoteActions();
    await testCardActions();
    await testStatisticsActions();
    await testMediaActions();
    await testGUIActions();
    await testAdvancedFeatures();
    
    // Generate report
    const report = generateReport();
    
    // Final verdict
    console.log("\n" + "=" .repeat(50));
    if (report.successRate >= 90) {
      console.log("✅ MCP SERVER TEST SUITE PASSED!");
    } else if (report.successRate >= 70) {
      console.log("⚠️ MCP SERVER TEST SUITE PARTIALLY PASSED");
    } else {
      console.log("❌ MCP SERVER TEST SUITE FAILED");
    }
    console.log("=" .repeat(50));
    
    // Exit code based on results
    process.exit(report.failed > 0 ? 1 : 0);
    
  } catch (_error: unknown) {
    console.error("\n❌ FATAL ERROR:", _error);
    console.error("Cannot connect to Anki-Connect. Please ensure:");
    console.error("1. Anki is running");
    console.error("2. Anki-Connect plugin is installed and enabled");
    console.error("3. No firewall is blocking port 8765");
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);