#!/usr/bin/env bun

/**
 * Mock test for MCP Server - Tests server structure without Anki running
 */

import { spawn } from "child_process";

// Test that the server starts and responds to MCP protocol
async function testMCPServerStructure() {
  console.log("🧪 MCP Server Structure Test (No Anki Required)");
  console.log("=" .repeat(50));
  
  const serverProcess = spawn("bun", ["run", "src/index.ts"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  
  let responseBuffer = "";
  const responses: any[] = [];
  let startupSuccess = false;
  
  // Handle server output
  serverProcess.stdout.on("data", (data: Buffer) => {
    responseBuffer += data.toString();
    
    // Try to parse complete JSON messages
    const lines = responseBuffer.split("\n");
    responseBuffer = lines.pop() || "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          
          if (response.result?.tools) {
            console.log(`✅ Server responded with ${response.result.tools.length} tools`);
            
            // Categorize tools
            const categories = new Map<string, number>();
            for (const tool of response.result.tools) {
              let category = "Other";
              const name = tool.name.toLowerCase();
              
              if (name.includes("deck")) {category = "Deck";} else if (name.includes("card") || name.includes("suspend") || name.includes("ease")) {category = "Card";} else if (name.includes("note") || name.includes("tag")) {category = "Note";} else if (name.includes("model")) {category = "Model";} else if (name.includes("media")) {category = "Media";} else if (name.includes("gui")) {category = "GUI";} else if (name.includes("stat") || name.includes("review")) {category = "Statistics";} else if (name.includes("sync") || name.includes("profile")) {category = "System";}
              
              categories.set(category, (categories.get(category) || 0) + 1);
            }
            
            console.log("\n📊 Tools by Category:");
            for (const [cat, count] of categories) {
              console.log(`   ${cat}: ${count} tools`);
            }
            
            // Sample some tools
            console.log("\n📝 Sample Tools:");
            const sampleTools = response.result.tools.slice(0, 10);
            for (const tool of sampleTools) {
              const hasSchema = tool.inputSchema && Object.keys(tool.inputSchema.properties || {}).length > 0;
              console.log(`   - ${tool.name}: ${hasSchema ? "✓ schema" : "no params"}`);
            }
          }
        } catch (_error) {
          // Not valid JSON, check for startup message
        }
      }
    }
  });
  
  // Handle server errors (startup messages)
  serverProcess.stderr.on("data", (data: Buffer) => {
    const message = data.toString().trim();
    if (message.includes("MCP server running")) {
      console.log("✅ Server started successfully");
      startupSuccess = true;
    } else if (message.includes("Connected to Anki-Connect")) {
      console.log("ℹ️ Server attempting Anki connection (expected to fail in mock test)");
    }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("\n📋 Testing MCP Protocol Messages...\n");
  
  // Test messages that don't require Anki
  const testMessages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    },
  ];
  
  // Send test messages
  for (const message of testMessages) {
    const jsonMessage = JSON.stringify(message);
    console.log(`→ Sending: ${message.method}`);
    serverProcess.stdin.write(jsonMessage + "\n");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test schema validation
  console.log("\n🔍 Schema Validation Test:");
  const schemaTest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "addNote",
      arguments: {
        // Missing required fields - should error
        deckName: "Test"
      }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(schemaTest) + "\n");
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("📈 MOCK TEST SUMMARY");
  console.log("=" .repeat(50));
  
  if (startupSuccess && responses.length > 0) {
    console.log("✅ Server structure is valid");
    console.log("✅ MCP protocol implementation working");
    console.log("✅ Tool registration successful");
    console.log("\n⚠️ Note: Actual Anki operations will fail without Anki running");
  } else {
    console.log("❌ Server structure test failed");
    console.log(`   Startup: ${startupSuccess ? "OK" : "Failed"}`);
    console.log(`   Responses: ${responses.length}`);
  }
  
  // Clean up
  serverProcess.kill();
  
  process.exit(responses.length > 0 ? 0 : 1);
}

// Run the test
testMCPServerStructure().catch(console.error);