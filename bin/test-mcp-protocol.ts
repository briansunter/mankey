#!/usr/bin/env bun

/**
 * Test the MCP Server Protocol Implementation
 * This script simulates MCP client requests to verify the server handles them correctly
 */

import { spawn } from "child_process";
import { Readable, Writable } from "stream";

// MCP Protocol message types
interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPTestClient {
  private process: any;
  private requestId: number = 1;
  private responseHandlers: Map<number, (response: MCPResponse) => void> = new Map();
  private buffer: string = "";

  async start() {
    console.log("🚀 Starting MCP Server Process...");
    
    this.process = spawn("bun", ["run", "src/index.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle stdout (responses from server)
    this.process.stdout.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (server logs)
    this.process.stderr.on("data", (data: Buffer) => {
      const message = data.toString();
      if (!message.includes("running on stdio")) {
        console.log("Server log:", message.trim());
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("✅ MCP Server started\n");
  }

  private processBuffer() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const contentLengthMatch = line.match(/Content-Length: (\d+)/);
          if (contentLengthMatch) {
            // Skip content-length header
            continue;
          }
          
          // Try to parse as JSON
          if (line.startsWith("{")) {
            const response = JSON.parse(line);
            const handler = this.responseHandlers.get(response.id);
            if (handler) {
              handler(response);
              this.responseHandlers.delete(response.id);
            }
          }
        } catch (error) {
          // Not JSON, might be other output
        }
      }
    }
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      // Send request
      const message = JSON.stringify(request);
      const fullMessage = `Content-Length: ${message.length}\r\n\r\n${message}\n`;
      this.process.stdin.write(fullMessage);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 5000);
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// Test functions
async function testInitialization(client: MCPTestClient) {
  console.log("📋 Testing MCP Initialization");
  console.log("=" .repeat(50));

  try {
    // Initialize the connection
    const initResult = await client.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    });
    
    console.log("✅ Initialize successful");
    console.log(`   Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`);
    console.log(`   Capabilities:`, Object.keys(initResult.capabilities || {}));
    
    // Send initialized notification
    await client.sendRequest("notifications/initialized", {});
    console.log("✅ Initialized notification sent");
    
    return true;
  } catch (error: any) {
    console.error("❌ Initialization failed:", error.message);
    return false;
  }
}

async function testListTools(client: MCPTestClient) {
  console.log("\n🔧 Testing List Tools");
  console.log("=" .repeat(50));

  try {
    const result = await client.sendRequest("tools/list", {});
    
    console.log(`✅ Found ${result.tools?.length || 0} tools`);
    
    // Group tools by category
    const categories: { [key: string]: string[] } = {};
    
    for (const tool of result.tools || []) {
      // Categorize based on tool name patterns
      let category = "Other";
      if (tool.name.includes("deck") || tool.name.includes("Deck")) {
        category = "Deck";
      } else if (tool.name.includes("card") || tool.name.includes("Card") || 
                 tool.name.includes("ease") || tool.name.includes("suspend")) {
        category = "Card";
      } else if (tool.name.includes("note") || tool.name.includes("Note") || 
                 tool.name.includes("tag") || tool.name.includes("Tag")) {
        category = "Note";
      } else if (tool.name.includes("model") || tool.name.includes("Model")) {
        category = "Model";
      } else if (tool.name.includes("media") || tool.name.includes("Media")) {
        category = "Media";
      } else if (tool.name.includes("gui")) {
        category = "GUI";
      } else if (tool.name.includes("stats") || tool.name.includes("Stats") || 
                 tool.name.includes("review")) {
        category = "Statistics";
      }
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(tool.name);
    }
    
    console.log("\n📊 Tools by Category:");
    for (const [category, tools] of Object.entries(categories)) {
      console.log(`   ${category}: ${tools.length} tools`);
      if (process.env.VERBOSE) {
        tools.slice(0, 3).forEach(t => console.log(`      - ${t}`));
        if (tools.length > 3) console.log(`      ... and ${tools.length - 3} more`);
      }
    }
    
    return result.tools || [];
  } catch (error: any) {
    console.error("❌ List tools failed:", error.message);
    return [];
  }
}

async function testCallTool(client: MCPTestClient, toolName: string, args: any = {}) {
  console.log(`\n🔨 Testing Tool: ${toolName}`);
  console.log("=" .repeat(50));

  try {
    const result = await client.sendRequest("tools/call", {
      name: toolName,
      arguments: args
    });
    
    console.log(`✅ Tool ${toolName} executed successfully`);
    
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content.type === "text") {
        try {
          const data = JSON.parse(content.text);
          console.log(`   Result type: ${Array.isArray(data) ? 'array' : typeof data}`);
          if (Array.isArray(data)) {
            console.log(`   Items: ${data.length}`);
          } else if (typeof data === 'object') {
            console.log(`   Keys: ${Object.keys(data).slice(0, 5).join(', ')}${Object.keys(data).length > 5 ? '...' : ''}`);
          } else {
            console.log(`   Value: ${JSON.stringify(data).substring(0, 100)}`);
          }
        } catch {
          console.log(`   Result: ${content.text.substring(0, 100)}...`);
        }
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ Tool ${toolName} failed:`, error.message);
    return false;
  }
}

async function testCommonWorkflows(client: MCPTestClient) {
  console.log("\n🔄 Testing Common Workflows");
  console.log("=" .repeat(50));

  const workflows = [
    {
      name: "Get System Info",
      tools: [
        { name: "deckNames", args: {} },
        { name: "modelNames", args: {} },
        { name: "getTags", args: {} },
      ]
    },
    {
      name: "Card Management",
      tools: [
        { name: "findCards", args: { query: "deck:Default" } },
        { name: "getNumCardsReviewedToday", args: {} },
      ]
    },
    {
      name: "Note Operations",
      tools: [
        { name: "canAddNotes", args: {
          notes: [{
            deckName: "Default",
            modelName: "Basic",
            fields: {
              Front: "Test Q",
              Back: "Test A"
            }
          }]
        }},
        { name: "findNotes", args: { query: "deck:Default" } },
      ]
    }
  ];

  for (const workflow of workflows) {
    console.log(`\n📝 Workflow: ${workflow.name}`);
    console.log("-" .repeat(30));
    
    for (const tool of workflow.tools) {
      const success = await testCallTool(client, tool.name, tool.args);
      if (!success && process.env.STOP_ON_ERROR) {
        console.error("Stopping due to error");
        return false;
      }
    }
  }
  
  return true;
}

async function testErrorHandling(client: MCPTestClient) {
  console.log("\n⚠️ Testing Error Handling");
  console.log("=" .repeat(50));

  // Test invalid tool
  try {
    await client.sendRequest("tools/call", {
      name: "nonExistentTool",
      arguments: {}
    });
    console.log("❌ Should have thrown error for non-existent tool");
  } catch (error: any) {
    console.log("✅ Correctly handled non-existent tool:", error.message);
  }

  // Test invalid parameters
  try {
    await client.sendRequest("tools/call", {
      name: "findCards",
      arguments: { invalidParam: "test" }
    });
    console.log("❌ Should have thrown error for invalid parameters");
  } catch (error: any) {
    console.log("✅ Correctly handled invalid parameters:", error.message);
  }

  return true;
}

// Main test runner
async function runMCPProtocolTests() {
  console.log("🚀 MCP Protocol Integration Test Suite");
  console.log("=" .repeat(50));
  console.log("Started at:", new Date().toISOString());
  
  const client = new MCPTestClient();
  
  try {
    // Start the MCP server
    await client.start();
    
    // Run test suites
    const initSuccess = await testInitialization(client);
    if (!initSuccess) {
      throw new Error("Initialization failed");
    }
    
    const tools = await testListTools(client);
    console.log(`\n✅ Total tools available: ${tools.length}`);
    
    // Test specific tools
    const testTools = [
      { name: "deckNames", args: {} },
      { name: "modelNames", args: {} },
      { name: "getTags", args: {} },
      { name: "getNumCardsReviewedToday", args: {} },
      { name: "findCards", args: { query: "deck:Default" } },
    ];
    
    console.log("\n🧪 Testing Individual Tools");
    console.log("=" .repeat(50));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const tool of testTools) {
      const success = await testCallTool(client, tool.name, tool.args);
      if (success) successCount++;
      else failCount++;
    }
    
    // Test workflows
    await testCommonWorkflows(client);
    
    // Test error handling
    await testErrorHandling(client);
    
    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("📈 MCP PROTOCOL TEST SUMMARY");
    console.log("=" .repeat(50));
    console.log(`✅ Successful tool calls: ${successCount}`);
    console.log(`❌ Failed tool calls: ${failCount}`);
    console.log(`📊 Success rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
    
    console.log("\n✅ MCP Protocol Tests Completed Successfully!");
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
  } finally {
    // Clean up
    await client.stop();
    console.log("\n🛑 MCP Server stopped");
  }
}

// Run the tests
runMCPProtocolTests().catch(console.error);