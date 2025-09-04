#!/usr/bin/env bun

/**
 * Direct test of MCP Server functionality
 * Tests the server by sending JSON-RPC messages through stdio
 */

import { spawn } from "child_process";

const testMessages = [
  // Test listing tools
  {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  },
  // Test calling deckNames
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "deckNames",
      arguments: {}
    }
  },
  // Test calling modelNames
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "modelNames",
      arguments: {}
    }
  },
  // Test calling getTags
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "getTags",
      arguments: {}
    }
  },
  // Test finding cards
  {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "findCards",
      arguments: {
        query: "deck:Default"
      }
    }
  },
  // Test stats
  {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "getNumCardsReviewedToday",
      arguments: {}
    }
  }
];

async function testMCPServerDirect() {
  console.log("🚀 Direct MCP Server Test");
  console.log("=" .repeat(50));
  
  // Start the MCP server
  const serverProcess = spawn("bun", ["run", "src/index.ts"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  
  let responseBuffer = "";
  const responses: any[] = [];
  
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
          
          // Log the response
          if (response.id) {
            const request = testMessages.find(m => m.id === response.id);
            const method = request?.method || "unknown";
            
            if (response.error) {
              console.log(`❌ [${response.id}] ${method}: ${response.error.message}`);
            } else {
              console.log(`✅ [${response.id}] ${method}`);
              
              // Parse and display result
              if (response.result) {
                if (method === "tools/list") {
                  console.log(`   Found ${response.result.tools?.length || 0} tools`);
                } else if (method === "tools/call") {
                  const content = response.result.content?.[0];
                  if (content?.type === "text") {
                    try {
                      const data = JSON.parse(content.text);
                      if (Array.isArray(data)) {
                        console.log(`   Result: Array with ${data.length} items`);
                        if (data.length > 0 && data.length <= 5) {
                          console.log(`   Items: ${JSON.stringify(data).substring(0, 100)}...`);
                        }
                      } else if (typeof data === "object") {
                        console.log(`   Result: Object with keys: ${Object.keys(data).slice(0, 5).join(", ")}`);
                      } else {
                        console.log(`   Result: ${data}`);
                      }
                    } catch {
                      console.log(`   Result: ${content.text.substring(0, 100)}...`);
                    }
                  }
                }
              }
            }
          }
        } catch (_error) {
          // Not valid JSON, ignore
        }
      }
    }
  });
  
  // Handle server errors
  serverProcess.stderr.on("data", (data: Buffer) => {
    const message = data.toString().trim();
    if (message && !message.includes("running on stdio")) {
      console.log("Server:", message);
    }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("\n📝 Sending test messages...\n");
  
  // Send all test messages
  for (const message of testMessages) {
    const jsonMessage = JSON.stringify(message);
    serverProcess.stdin.write(jsonMessage + "\n");
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("📊 Test Summary");
  console.log("=" .repeat(50));
  console.log(`Messages sent: ${testMessages.length}`);
  console.log(`Responses received: ${responses.length}`);
  
  const successful = responses.filter(r => !r.error).length;
  const failed = responses.filter(r => r.error).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success rate: ${((successful / responses.length) * 100).toFixed(1)}%`);
  
  if (successful === testMessages.length) {
    console.log("\n✅ ALL TESTS PASSED!");
  } else {
    console.log("\n⚠️ Some tests failed");
  }
  
  // Clean up
  serverProcess.kill();
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
testMCPServerDirect().catch(console.error);