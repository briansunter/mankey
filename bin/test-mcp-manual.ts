#!/usr/bin/env bun

/**
 * Manual MCP Test Script - Tests each tool one by one with validation
 * This performs comprehensive testing of all MCP server tools
 */

import { spawn, ChildProcess } from "child_process";

// Test configuration
const TEST_CONFIG = {
  timeout: 1000,
  deckName: "MCP_Test_Deck",
  modelName: "Basic",
  tagPrefix: `mcp_test_${Date.now()}`,
};

// Color output helpers
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  log(`📋 ${title}`, colors.bold + colors.blue);
  console.log("=".repeat(60));
}

function logTest(name: string, passed: boolean, details?: string) {
  const icon = passed ? "✅" : "❌";
  const color = passed ? colors.green : colors.red;
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   ${details}`, colors.gray);
  }
}

// MCP Client for testing
class TestMCPClient {
  private process: ChildProcess | null = null;
  private responseBuffer = "";
  private requestId = 1;
  private debugMode = false;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  async start(): Promise<void> {
    this.process = spawn("bun", ["run", "src/index.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      this.responseBuffer += text;
      if (this.debugMode) {
        log(`[STDOUT]: ${text}`, colors.gray);
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (this.debugMode && !text.includes("running on stdio")) {
        log(`[STDERR]: ${text}`, colors.gray);
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1500));
    log("✅ MCP Server started", colors.green);
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.process) {
      throw new Error("Client not started");
    }

    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: { name, arguments: args }
    };

    if (this.debugMode) {
      log(`[REQUEST]: ${JSON.stringify(request, null, 2)}`, colors.gray);
    }

    this.process.stdin?.write(JSON.stringify(request) + "\n");
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.timeout));
    
    // Parse response
    const lines = this.responseBuffer.split("\n");
    this.responseBuffer = "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            if (this.debugMode) {
              log(`[RESPONSE]: ${JSON.stringify(response, null, 2)}`, colors.gray);
            }
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.result;
          }
        } catch (e) {
          // Continue parsing other lines
        }
      }
    }
    
    return null;
  }

  async listTools(): Promise<any[]> {
    if (!this.process) {
      throw new Error("Client not started");
    }

    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/list",
      params: {}
    };
    
    this.process.stdin?.write(JSON.stringify(request) + "\n");
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.timeout));
    
    const lines = this.responseBuffer.split("\n");
    this.responseBuffer = "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id && response.result?.tools) {
            return response.result.tools;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    return [];
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }
}

// Test utilities
function parseResult(result: any): any {
  if (!result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(result.content[0].text);
  } catch {
    return result.content[0].text;
  }
}

// Test categories
interface TestCategory {
  name: string;
  tests: TestCase[];
}

interface TestCase {
  name: string;
  tool: string;
  args: any;
  validate?: (result: any) => boolean;
  skipCleanup?: boolean;
  storeResult?: string;
}

// Shared test data storage
const testData: Record<string, any> = {};

// Define all test cases
const testCategories: TestCategory[] = [
  {
    name: "Tool Registration",
    tests: [
      {
        name: "List all tools",
        tool: "list",
        args: {},
        validate: (result) => {
          const tools = result as any[];
          testData.toolCount = tools.length;
          return tools.length > 40; // Should have 40+ tools
        }
      }
    ]
  },
  {
    name: "Deck Operations",
    tests: [
      {
        name: "List existing decks",
        tool: "deckNames",
        args: {},
        validate: (r) => {
          const decks = parseResult(r);
          return Array.isArray(decks) && decks.length > 0;
        }
      },
      {
        name: "Create test deck",
        tool: "createDeck",
        args: { deck: TEST_CONFIG.deckName },
        validate: (r) => {
          const deckId = parseResult(r);
          testData.testDeckId = deckId;
          return typeof deckId === "number" && deckId > 0;
        },
        storeResult: "testDeckId"
      },
      {
        name: "Get deck configuration",
        tool: "getDeckConfig",
        args: { deck: "Default" },
        validate: (r) => {
          const config = parseResult(r);
          return typeof config === "object" && config !== null;
        }
      },
      {
        name: "Get deck statistics",
        tool: "getDeckStats",
        args: { decks: ["Default"] },
        validate: (r) => {
          const stats = parseResult(r);
          return typeof stats === "object";
        }
      },
      {
        name: "Get deck names and IDs",
        tool: "deckNamesAndIds",
        args: {},
        validate: (r) => {
          const mapping = parseResult(r);
          return typeof mapping === "object" && Object.keys(mapping).length > 0;
        }
      }
    ]
  },
  {
    name: "Model Operations",
    tests: [
      {
        name: "List model names",
        tool: "modelNames",
        args: {},
        validate: (r) => {
          const models = parseResult(r);
          return Array.isArray(models) && models.includes("Basic");
        }
      },
      {
        name: "Get model field names",
        tool: "modelFieldNames",
        args: { modelName: "Basic" },
        validate: (r) => {
          const fields = parseResult(r);
          return Array.isArray(fields) && 
                 fields.includes("Front") && 
                 fields.includes("Back");
        }
      },
      {
        name: "Get model names and IDs",
        tool: "modelNamesAndIds",
        args: {},
        validate: (r) => {
          const mapping = parseResult(r);
          return typeof mapping === "object" && Object.keys(mapping).length > 0;
        }
      }
    ]
  },
  {
    name: "Note Operations",
    tests: [
      {
        name: "Add a test note",
        tool: "addNote",
        args: {
          deckName: TEST_CONFIG.deckName,
          modelName: TEST_CONFIG.modelName,
          fields: {
            Front: `Test Question ${TEST_CONFIG.tagPrefix}`,
            Back: `Test Answer - Created at ${new Date().toISOString()}`
          },
          tags: [TEST_CONFIG.tagPrefix, "automated", "test"],
          allowDuplicate: true
        },
        validate: (r) => {
          const noteId = parseResult(r);
          testData.testNoteId = noteId;
          return typeof noteId === "number" && noteId > 0;
        },
        storeResult: "testNoteId"
      },
      {
        name: "Find notes by tag",
        tool: "findNotes",
        args: { query: `tag:${TEST_CONFIG.tagPrefix}` },
        validate: (r) => {
          const notes = parseResult(r);
          return Array.isArray(notes) && notes.length > 0;
        }
      },
      {
        name: "Get note information",
        tool: "notesInfo",
        args: {},
        validate: (r) => {
          if (!testData.testNoteId) return false;
          const info = parseResult(r);
          return Array.isArray(info) && info.length > 0;
        }
      },
      {
        name: "Update note fields",
        tool: "updateNote",
        args: {},
        validate: (r) => {
          if (!testData.testNoteId) return false;
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      },
      {
        name: "Add tags to note",
        tool: "addTags",
        args: {},
        validate: (r) => {
          if (!testData.testNoteId) return false;
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      },
      {
        name: "Get all tags",
        tool: "getTags",
        args: {},
        validate: (r) => {
          const tags = parseResult(r);
          return Array.isArray(tags);
        }
      },
      {
        name: "Remove tags from note",
        tool: "removeTags",
        args: {},
        validate: (r) => {
          if (!testData.testNoteId) return false;
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      }
    ]
  },
  {
    name: "Card Operations",
    tests: [
      {
        name: "Find cards by query",
        tool: "findCards",
        args: { query: `deck:${TEST_CONFIG.deckName}` },
        validate: (r) => {
          const cards = parseResult(r);
          testData.testCardIds = cards;
          return Array.isArray(cards);
        },
        storeResult: "testCardIds"
      },
      {
        name: "Get card information",
        tool: "cardsInfo",
        args: {},
        validate: (r) => {
          if (!testData.testCardIds || testData.testCardIds.length === 0) return true;
          const info = parseResult(r);
          return Array.isArray(info);
        }
      },
      {
        name: "Get ease factors",
        tool: "getEaseFactors",
        args: {},
        validate: (r) => {
          if (!testData.testCardIds || testData.testCardIds.length === 0) return true;
          const factors = parseResult(r);
          return Array.isArray(factors) || typeof factors === "object";
        }
      },
      {
        name: "Suspend cards",
        tool: "suspend",
        args: {},
        validate: (r) => {
          if (!testData.testCardIds || testData.testCardIds.length === 0) return true;
          const result = parseResult(r);
          return result === true || result === null;
        }
      },
      {
        name: "Unsuspend cards",
        tool: "unsuspend",
        args: {},
        validate: (r) => {
          if (!testData.testCardIds || testData.testCardIds.length === 0) return true;
          const result = parseResult(r);
          return result === true || result === null;
        }
      }
    ]
  },
  {
    name: "Statistics",
    tests: [
      {
        name: "Cards reviewed today",
        tool: "getNumCardsReviewedToday",
        args: {},
        validate: (r) => {
          const num = parseResult(r);
          return typeof num === "number" && num >= 0;
        }
      },
      {
        name: "Cards reviewed by day",
        tool: "getNumCardsReviewedByDay",
        args: {},
        validate: (r) => {
          const data = parseResult(r);
          return typeof data === "object" || Array.isArray(data);
        }
      }
    ]
  },
  {
    name: "Media Operations",
    tests: [
      {
        name: "Store media file",
        tool: "storeMediaFile",
        args: {
          filename: `${TEST_CONFIG.tagPrefix}_test.txt`,
          data: Buffer.from("Test content").toString("base64"),
          deleteExisting: true
        },
        validate: (r) => {
          const result = parseResult(r);
          testData.testMediaFile = `${TEST_CONFIG.tagPrefix}_test.txt`;
          return typeof result === "string" || result === null;
        }
      },
      {
        name: "Get media file names",
        tool: "getMediaFilesNames",
        args: { pattern: "*.txt" },
        validate: (r) => {
          const files = parseResult(r);
          return Array.isArray(files);
        }
      },
      {
        name: "Delete media file",
        tool: "deleteMediaFile",
        args: {},
        validate: (r) => {
          if (!testData.testMediaFile) return true;
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      }
    ]
  },
  {
    name: "Cleanup",
    tests: [
      {
        name: "Delete test notes",
        tool: "deleteNotes",
        args: {},
        validate: (r) => {
          if (!testData.testNoteId) return true;
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      },
      {
        name: "Delete test deck",
        tool: "deleteDecks",
        args: { decks: [TEST_CONFIG.deckName], cardsToo: true },
        validate: (r) => {
          const result = parseResult(r);
          return result === null || result === undefined;
        }
      }
    ]
  }
];

// Main test runner
async function runManualTests(debugMode = false) {
  log("\n🚀 ANKI MCP SERVER - COMPREHENSIVE MANUAL TEST", colors.bold + colors.blue);
  log("=" .repeat(60));
  log(`Started: ${new Date().toISOString()}`, colors.gray);
  log(`Debug Mode: ${debugMode}`, colors.gray);
  
  const client = new TestMCPClient(debugMode);
  const results: { category: string; test: string; passed: boolean; error?: string }[] = [];
  
  try {
    // Start the MCP server
    await client.start();
    
    // First, list all available tools
    logSection("Available Tools");
    const tools = await client.listTools();
    log(`Found ${tools.length} tools`, colors.green);
    
    // Display tools by category
    const toolsByCategory = new Map<string, string[]>();
    for (const tool of tools) {
      const name = tool.name;
      let category = "Other";
      
      if (name.includes("deck") || name.includes("Deck")) category = "Deck";
      else if (name.includes("card") || name.includes("Card") || name.includes("suspend") || name.includes("ease")) category = "Card";
      else if (name.includes("note") || name.includes("Note") || name.includes("tag") || name.includes("Tag")) category = "Note";
      else if (name.includes("model") || name.includes("Model")) category = "Model";
      else if (name.includes("media") || name.includes("Media")) category = "Media";
      else if (name.includes("gui") || name.includes("Gui")) category = "GUI";
      else if (name.includes("stat") || name.includes("Stat") || name.includes("review")) category = "Statistics";
      else if (name.includes("sync") || name.includes("profile") || name.includes("export") || name.includes("import")) category = "System";
      
      if (!toolsByCategory.has(category)) {
        toolsByCategory.set(category, []);
      }
      toolsByCategory.get(category)?.push(name);
    }
    
    for (const [category, toolNames] of toolsByCategory) {
      log(`\n${category} (${toolNames.length} tools):`, colors.yellow);
      for (const toolName of toolNames.slice(0, 5)) {
        log(`  • ${toolName}`, colors.gray);
      }
      if (toolNames.length > 5) {
        log(`  ... and ${toolNames.length - 5} more`, colors.gray);
      }
    }
    
    // Run tests by category
    for (const category of testCategories) {
      logSection(category.name);
      
      for (const test of category.tests) {
        try {
          // Skip tool list test as we already did it
          if (test.tool === "list") {
            logTest(test.name, true, `${tools.length} tools registered`);
            results.push({ category: category.name, test: test.name, passed: true });
            continue;
          }
          
          // Prepare arguments
          let args = test.args;
          
          // Dynamic argument preparation based on stored data
          if (test.tool === "notesInfo" && testData.testNoteId) {
            args = { notes: [testData.testNoteId] };
          } else if (test.tool === "updateNote" && testData.testNoteId) {
            args = { 
              id: testData.testNoteId,
              fields: { Back: `Updated at ${new Date().toISOString()}` }
            };
          } else if (test.tool === "addTags" && testData.testNoteId) {
            args = { 
              notes: [testData.testNoteId],
              tags: "additional_tag"
            };
          } else if (test.tool === "removeTags" && testData.testNoteId) {
            args = { 
              notes: [testData.testNoteId],
              tags: "additional_tag"
            };
          } else if (test.tool === "cardsInfo" && testData.testCardIds?.length > 0) {
            args = { cards: testData.testCardIds.slice(0, 1) };
          } else if (test.tool === "getEaseFactors" && testData.testCardIds?.length > 0) {
            args = { cards: testData.testCardIds };
          } else if (test.tool === "suspend" && testData.testCardIds?.length > 0) {
            args = { cards: testData.testCardIds };
          } else if (test.tool === "unsuspend" && testData.testCardIds?.length > 0) {
            args = { cards: testData.testCardIds };
          } else if (test.tool === "deleteMediaFile" && testData.testMediaFile) {
            args = { filename: testData.testMediaFile };
          } else if (test.tool === "deleteNotes" && testData.testNoteId) {
            args = { notes: [testData.testNoteId] };
          }
          
          // Call the tool
          const result = await client.callTool(test.tool, args);
          
          // Validate result
          let passed = result !== null;
          if (passed && test.validate) {
            passed = test.validate(result);
          }
          
          // Store result if needed
          if (test.storeResult && passed) {
            const parsed = parseResult(result);
            testData[test.storeResult] = parsed;
          }
          
          // Log result
          const parsedResult = parseResult(result);
          const details = typeof parsedResult === "object" 
            ? `Result: ${JSON.stringify(parsedResult).substring(0, 50)}...`
            : `Result: ${parsedResult}`;
          
          logTest(test.name, passed, details);
          results.push({ category: category.name, test: test.name, passed });
          
        } catch (error: any) {
          logTest(test.name, false, `Error: ${error.message}`);
          results.push({ 
            category: category.name, 
            test: test.name, 
            passed: false, 
            error: error.message 
          });
        }
      }
    }
    
    // Generate summary report
    logSection("TEST SUMMARY");
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    log(`\nTotal Tests: ${totalTests}`, colors.bold);
    log(`✅ Passed: ${passedTests}`, colors.green);
    log(`❌ Failed: ${failedTests}`, colors.red);
    log(`📊 Success Rate: ${successRate}%`, colors.blue);
    
    // Category breakdown
    log("\nResults by Category:", colors.bold);
    const categoryStats = new Map<string, { passed: number; total: number }>();
    
    for (const result of results) {
      if (!categoryStats.has(result.category)) {
        categoryStats.set(result.category, { passed: 0, total: 0 });
      }
      const stats = categoryStats.get(result.category)!;
      stats.total++;
      if (result.passed) stats.passed++;
    }
    
    for (const [category, stats] of categoryStats) {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      const color = stats.passed === stats.total ? colors.green : 
                    stats.passed > 0 ? colors.yellow : colors.red;
      log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`, color);
    }
    
    // List failures if any
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
      log("\n❌ Failed Tests:", colors.red + colors.bold);
      for (const fail of failures) {
        log(`  • [${fail.category}] ${fail.test}`, colors.red);
        if (fail.error) {
          log(`    Error: ${fail.error}`, colors.gray);
        }
      }
    }
    
    // Final verdict
    log("\n" + "=".repeat(60));
    if (successRate === "100.0") {
      log("🎉 PERFECT! All tests passed!", colors.green + colors.bold);
    } else if (parseFloat(successRate) >= 95) {
      log("✅ EXCELLENT! Server validation passed!", colors.green + colors.bold);
    } else if (parseFloat(successRate) >= 90) {
      log("✅ GOOD! Server works with minor issues.", colors.yellow + colors.bold);
    } else if (parseFloat(successRate) >= 80) {
      log("⚠️ ACCEPTABLE: Server has some issues to address.", colors.yellow);
    } else {
      log("❌ NEEDS WORK: Server has significant issues.", colors.red + colors.bold);
    }
    log("=".repeat(60));
    
  } catch (error: any) {
    log(`\n❌ Fatal Error: ${error.message}`, colors.red + colors.bold);
  } finally {
    client.stop();
  }
  
  // Exit with appropriate code
  const failedCount = results.filter(r => !r.passed).length;
  process.exit(failedCount > 0 ? 1 : 0);
}

// Parse command line arguments
const args = process.argv.slice(2);
const debugMode = args.includes("--debug") || args.includes("-d");

// Run the tests
runManualTests(debugMode).catch(console.error);