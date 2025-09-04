#!/usr/bin/env bun

/**
 * Final Validation Test Suite for Anki MCP Server
 * This performs a comprehensive test of all major features
 */

import { spawn } from "child_process";

// Test result tracking
interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

// Simple MCP client
class SimpleMCPClient {
  private process: import("child_process").ChildProcess | null = null;
  private responseBuffer = "";
  private requestId = 1;
  
  async start() {
    this.process = spawn("bun", ["run", "src/index.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    this.process.stdout?.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();
    });
    
    this.process.stderr?.on("data", (_data: Buffer) => {
      // Ignore server startup messages
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: { name, arguments: args }
    };
    
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify(request) + "\n");
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const lines = this.responseBuffer.split("\n");
    this.responseBuffer = "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.result;
          }
        } catch (_e) {
          // Continue
        }
      }
    }
    
    return null;
  }
  
  async listTools(): Promise<{ name: string; [key: string]: unknown }[]> {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/list",
      params: {}
    };
    
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify(request) + "\n");
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const lines = this.responseBuffer.split("\n");
    this.responseBuffer = "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id && response.result?.tools) {
            return response.result.tools;
          }
        } catch (_e) {
          // Continue
        }
      }
    }
    
    return [];
  }
  
  stop() {
    this.process?.kill();
  }
}

// Helper function to extract content from MCP result
function extractContent(result: unknown): string {
  const mcpResult = result as { content: [{ text: string }] };
  return mcpResult.content[0].text;
}

// Test function
async function runTest(
  client: SimpleMCPClient,
  category: string,
  test: string,
  toolName: string,
  args: Record<string, unknown>,
  validate?: (_result: unknown) => boolean
): Promise<void> {
  try {
    const result = await client.callTool(toolName, args);
    
    let passed = result !== null;
    if (passed && validate) {
      passed = validate(result);
    }
    
    results.push({ category, test, passed });
    
    const icon = passed ? "✅" : "❌";
    console.log(`${icon} [${category}] ${test}`);
    
  } catch (error: unknown) {
    results.push({ category, test, passed: false, error: error instanceof Error ? error.message : String(error) });
    console.log(`❌ [${category}] ${test}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main validation
async function validateMCPServer() {
  console.log("🚀 Final Validation Test Suite for Anki MCP Server");
  console.log("=" .repeat(60));
  console.log("Started at:", new Date().toISOString());
  console.log();
  
  const client = new SimpleMCPClient();
  await client.start();
  
  try {
    // 1. Validate tool registration
    console.log("📋 Tool Registration");
    console.log("-" .repeat(30));
    
    const tools = await client.listTools();
    console.log(`✅ Registered ${tools.length} tools`);
    
    // Check for essential tools
    const essentialTools = [
      "deckNames", "createDeck", "getDeckStats",
      "addNote", "findNotes", "updateNote", "deleteNotes",
      "findCards", "cardsInfo", "suspend", "unsuspend",
      "modelNames", "getTags", "sync"
    ];
    
    for (const toolName of essentialTools) {
      const found = tools.some(t => t.name === toolName);
      results.push({ 
        category: "Registration", 
        test: `Tool ${toolName}`, 
        passed: found 
      });
      console.log(`${found ? "✅" : "❌"} Tool: ${toolName}`);
    }
    
    // 2. Test Deck Operations
    console.log("\n📚 Deck Operations");
    console.log("-" .repeat(30));
    
    await runTest(client, "Deck", "List decks", "deckNames", {}, 
      (r) => {
        const decks = JSON.parse(extractContent(r));
        return Array.isArray(decks) && decks.length > 0;
      });
    
    const testDeckName = `MCP_Validation_${Date.now()}`;
    await runTest(client, "Deck", "Create deck", "createDeck", 
      { deck: testDeckName },
      (r) => JSON.parse(extractContent(r)) > 0);
    
    await runTest(client, "Deck", "Get deck stats", "getDeckStats",
      { decks: ["Default"] },
      (r) => {
        const stats = JSON.parse(extractContent(r));
        return typeof stats === "object";
      });
    
    // Clean up test deck
    await client.callTool("deleteDecks", { 
      decks: [testDeckName], 
      cardsToo: true 
    });
    
    // 3. Test Note Operations
    console.log("\n📝 Note Operations");
    console.log("-" .repeat(30));
    
    const timestamp = Date.now();
    let testNoteId: number = 0;
    
    await runTest(client, "Note", "Add note", "addNote", {
      deckName: "Default",
      modelName: "Basic",
      fields: {
        Front: `Validation Test ${timestamp}`,
        Back: `Answer ${timestamp}`
      },
      tags: [`validation-${timestamp}`],
      allowDuplicate: true
    }, (r) => {
      const id = JSON.parse(extractContent(r)) as number;
      testNoteId = id;
      return id > 0;
    });
    
    await runTest(client, "Note", "Find notes", "findNotes",
      { query: `tag:validation-${timestamp}` },
      (r) => {
        const notes = JSON.parse(extractContent(r));
        return Array.isArray(notes) && notes.length === 1;
      });
    
    if (testNoteId > 0) {
      await runTest(client, "Note", "Update note", "updateNote", {
        id: testNoteId,
        fields: { Back: "Updated Answer" },
        tags: ["updated", "validation"]
      }, (r) => extractContent(r).includes("null"));
      
      await runTest(client, "Note", "Delete note", "deleteNotes",
        { notes: [testNoteId] },
        (r) => extractContent(r).includes("null"));
    }
    
    // 4. Test Card Operations
    console.log("\n🃏 Card Operations");
    console.log("-" .repeat(30));
    
    await runTest(client, "Card", "Find cards", "findCards",
      { query: "deck:Default" },
      (r) => {
        const cards = JSON.parse(extractContent(r));
        return Array.isArray(cards);
      });
    
    // 5. Test Model Operations
    console.log("\n🎨 Model Operations");
    console.log("-" .repeat(30));
    
    await runTest(client, "Model", "List models", "modelNames", {},
      (r) => {
        const models = JSON.parse(extractContent(r));
        return Array.isArray(models) && models.includes("Basic");
      });
    
    await runTest(client, "Model", "Get field names", "modelFieldNames",
      { modelName: "Basic" },
      (r) => {
        const fields = JSON.parse(extractContent(r));
        return Array.isArray(fields) && fields.includes("Front");
      });
    
    // 6. Test Statistics
    console.log("\n📊 Statistics");
    console.log("-" .repeat(30));
    
    await runTest(client, "Stats", "Cards reviewed today", 
      "getNumCardsReviewedToday", {},
      (r) => {
        const num = JSON.parse(extractContent(r));
        return typeof num === "number";
      });
    
    // 7. Test Tags
    console.log("\n🏷️ Tag Operations");
    console.log("-" .repeat(30));
    
    await runTest(client, "Tags", "Get all tags", "getTags", {},
      (r) => {
        const tags = JSON.parse(extractContent(r));
        return Array.isArray(tags);
      });
    
    // 8. Test Media Operations
    console.log("\n🖼️ Media Operations");
    console.log("-" .repeat(30));
    
    const testFileName = `mcp_validation_${Date.now()}.txt`;
    const testContent = Buffer.from("Validation Test").toString("base64");
    
    await runTest(client, "Media", "Store file", "storeMediaFile", {
      filename: testFileName,
      data: testContent
    }, (r) => extractContent(r).includes(testFileName));
    
    await runTest(client, "Media", "Delete file", "deleteMediaFile",
      { filename: testFileName },
      (r) => extractContent(r).includes("null"));
    
    // Generate Report
    console.log("\n" + "=" .repeat(60));
    console.log("📈 VALIDATION REPORT");
    console.log("=" .repeat(60));
    
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const successRate = ((passed / total) * 100).toFixed(1);
    
    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${successRate}%`);
    
    // Group by category
    const categories = [...new Set(results.map(r => r.category))];
    console.log("\nResults by Category:");
    console.log("-" .repeat(30));
    
    for (const cat of categories) {
      const catResults = results.filter(r => r.category === cat);
      const catPassed = catResults.filter(r => r.passed).length;
      const catTotal = catResults.length;
      console.log(`${cat}: ${catPassed}/${catTotal} (${((catPassed/catTotal)*100).toFixed(0)}%)`);
    }
    
    // List failures
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log("\n❌ Failed Tests:");
      console.log("-" .repeat(30));
      for (const fail of failures) {
        console.log(`- [${fail.category}] ${fail.test}`);
        if (fail.error) {console.log(`  Error: ${fail.error}`);}
      }
    }
    
    // Final verdict
    console.log("\n" + "=" .repeat(60));
    if (successRate === "100.0") {
      console.log("🎉 PERFECT! All validation tests passed!");
    } else if (parseFloat(successRate) >= 95) {
      console.log("✅ EXCELLENT! MCP Server validation passed!");
    } else if (parseFloat(successRate) >= 90) {
      console.log("✅ GOOD! MCP Server validation passed with minor issues.");
    } else if (parseFloat(successRate) >= 80) {
      console.log("⚠️ ACCEPTABLE: MCP Server has some issues to address.");
    } else {
      console.log("❌ FAILED: MCP Server needs significant fixes.");
    }
    console.log("=" .repeat(60));
    
  } finally {
    client.stop();
  }
  
  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run validation
validateMCPServer().catch(console.error);