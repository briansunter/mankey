#!/usr/bin/env bun

// Test script for the Anki MCP Server
// This simulates MCP client requests to test the server

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

async function testMCPServer() {
  console.log("🚀 Starting Anki MCP Server Tests");
  console.log("=" .repeat(50));

  // Start the MCP server as a subprocess
  const serverProcess = spawn("bun", ["run", "src/index.ts"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Create MCP client
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "src/index.ts"],
  });

  const client = new Client(
    {
      name: "anki-mcp-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    // Connect to the server
    await client.connect(transport);
    console.log("✅ Connected to MCP server\n");

    // List available tools
    console.log("📋 Listing available tools...");
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools\n`);

    // Test some basic tools
    const testsToRun = [
      {
        name: "deckNames",
        args: {},
        description: "Get all deck names"
      },
      {
        name: "modelNames", 
        args: {},
        description: "Get all model/note type names"
      },
      {
        name: "getTags",
        args: {},
        description: "Get all tags"
      },
      {
        name: "getNumCardsReviewedToday",
        args: {},
        description: "Get cards reviewed today"
      },
      {
        name: "findCards",
        args: { query: "deck:current" },
        description: "Find cards in current deck"
      },
    ];

    for (const test of testsToRun) {
      console.log(`\n📝 Testing: ${test.description}`);
      console.log(`   Tool: ${test.name}`);
      console.log(`   Args: ${JSON.stringify(test.args)}`);
      
      try {
        const result = await client.callTool({
          name: test.name,
          arguments: test.args,
        });
        
        console.log(`   ✅ Success!`);
        if (result.content && Array.isArray(result.content) && result.content.length > 0) {
          const content = result.content[0];
          if (content.type === "text") {
            const data = JSON.parse(content.text);
            console.log(`   Result: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
          }
        }
      } catch (_error) {
        console.log(`   ❌ Error: ${_error}`);
      }
    }

    console.log("\n" + "=" .repeat(50));
    console.log("✅ MCP Server tests completed!");

  } catch (_error) {
    console.error("❌ Failed to connect to MCP server:", _error);
  } finally {
    // Clean up
    await client.close();
    serverProcess.kill();
  }
}

// Alternative: Direct testing without spawning server
async function testDirectly() {
  console.log("\n🧪 Direct API Testing (without MCP protocol)");
  console.log("=" .repeat(50));

  const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
  
  // Test if Anki-Connect is available
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "version",
        version: 6
      })
    });

    if (response.ok) {
      const data = await response.json() as { error?: string; result?: any };
      console.log("✅ Anki-Connect is running, version:", data.result);
    }
  } catch (_error) {
    console.error("❌ Cannot connect to Anki-Connect");
    console.error("   Make sure Anki is running with Anki-Connect plugin");
    return;
  }

  // Test creating and querying a test note
  console.log("\n📝 Testing note operations...");
  
  // Check if we can add a test note
  const canAddResponse = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "canAddNotes",
      version: 6,
      params: {
        notes: [{
          deckName: "Default",
          modelName: "Basic",
          fields: {
            Front: "MCP Test Question",
            Back: "MCP Test Answer"
          },
          tags: ["mcp-test"]
        }]
      }
    })
  });

  const canAddData = await canAddResponse.json() as { error?: string; result?: any };
  console.log("Can add test note:", (canAddData as any).result?.[0] ? "✅ Yes" : "❌ No");

  console.log("\n✅ Direct testing completed!");
}

// Choose which test to run based on command line argument
const testMode = process.argv[2] || "direct";

if (testMode === "mcp") {
  console.log("Running MCP protocol tests...\n");
  testMCPServer().catch(console.error);
} else {
  console.log("Running direct Anki-Connect tests...\n");
  testDirectly().catch(console.error);
}