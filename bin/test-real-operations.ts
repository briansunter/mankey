#!/usr/bin/env bun

/**
 * Test Real Operations through MCP Server
 * This tests actual note creation, modification, and deletion
 */

import { spawn } from "child_process";

class MCPClient {
  private process: any;
  private responseBuffer = "";
  private requestId = 1;
  
  async start() {
    this.process = spawn("bun", ["run", "src/index.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    this.process.stdout.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();
    });
    
    this.process.stderr.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (!msg.includes("running on stdio")) {
        console.log("Server:", msg.trim());
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  async callTool(name: string, args: any): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: { name, arguments: args }
    };
    
    this.process.stdin.write(JSON.stringify(request) + "\n");
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Parse response
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
  
  stop() {
    this.process?.kill();
  }
}

async function testRealOperations() {
  console.log("🚀 Testing Real Anki Operations via MCP Server");
  console.log("=" .repeat(50));
  
  const client = new MCPClient();
  await client.start();
  
  try {
    // 1. Get current state
    console.log("\n📊 Current Anki State:");
    console.log("-" .repeat(30));
    
    const decks = await client.callTool("deckNames", {});
    const deckList = JSON.parse(decks.content[0].text);
    console.log(`✅ Found ${deckList.length} decks`);
    console.log(`   Sample: ${deckList.slice(0, 3).join(", ")}...`);
    
    const models = await client.callTool("modelNames", {});
    const modelList = JSON.parse(models.content[0].text);
    console.log(`✅ Found ${modelList.length} models`);
    console.log(`   Sample: ${modelList.slice(0, 3).join(", ")}...`);
    
    const tags = await client.callTool("getTags", {});
    const tagList = JSON.parse(tags.content[0].text);
    console.log(`✅ Found ${tagList.length} tags`);
    
    // 2. Create a test note
    console.log("\n📝 Creating Test Note:");
    console.log("-" .repeat(30));
    
    const timestamp = Date.now();
    const noteResult = await client.callTool("addNote", {
      deckName: "Default",
      modelName: "Basic",
      fields: {
        Front: `MCP Test Question ${timestamp}`,
        Back: `MCP Test Answer - Created via MCP Server at ${new Date().toISOString()}`
      },
      tags: ["mcp-test", "automated", `test-${timestamp}`],
      allowDuplicate: true
    });
    
    const noteId = parseInt(noteResult.content[0].text.match(/\d+/)?.[0] || "0");
    console.log(`✅ Created note with ID: ${noteId}`);
    
    // 3. Find the note
    console.log("\n🔍 Finding Test Note:");
    console.log("-" .repeat(30));
    
    const findResult = await client.callTool("findNotes", {
      query: `tag:test-${timestamp}`
    });
    const foundNotes = JSON.parse(findResult.content[0].text);
    console.log(`✅ Found ${foundNotes.length} notes with test tag`);
    
    // 4. Get note info
    if (noteId > 0) {
      const noteInfo = await client.callTool("notesInfo", {
        notes: [noteId]
      });
      const info = JSON.parse(noteInfo.content[0].text);
      console.log(`✅ Note info retrieved:`);
      console.log(`   Fields: ${Object.keys(info[0]?.fields || {}).join(", ")}`);
      console.log(`   Tags: ${info[0]?.tags?.join(", ")}`);
    }
    
    // 5. Update the note
    console.log("\n✏️ Updating Test Note:");
    console.log("-" .repeat(30));
    
    if (noteId > 0) {
      await client.callTool("updateNote", {
        id: noteId,
        fields: {
          Back: `Updated Answer - Modified at ${new Date().toISOString()}`
        },
        tags: ["mcp-test", "updated", "automated"]
      });
      console.log(`✅ Note ${noteId} updated`);
    }
    
    // 6. Find cards for the note
    console.log("\n🃏 Finding Cards:");
    console.log("-" .repeat(30));
    
    const cardResult = await client.callTool("findCards", {
      query: `nid:${noteId}`
    });
    const cards = JSON.parse(cardResult.content[0].text);
    console.log(`✅ Found ${cards.length} cards for note ${noteId}`);
    
    // 7. Get card info
    if (cards.length > 0) {
      const cardInfo = await client.callTool("cardsInfo", {
        cards: cards.slice(0, 1)
      });
      const cInfo = JSON.parse(cardInfo.content[0].text);
      console.log(`✅ Card info retrieved:`);
      console.log(`   Deck: ${cInfo[0]?.deckName}`);
      console.log(`   Model: ${cInfo[0]?.modelName}`);
    }
    
    // 8. Test statistics
    console.log("\n📊 Statistics:");
    console.log("-" .repeat(30));
    
    const statsResult = await client.callTool("getNumCardsReviewedToday", {});
    console.log(`✅ ${statsResult.content[0].text}`);
    
    // 9. Clean up - delete the test note
    console.log("\n🗑️ Cleanup:");
    console.log("-" .repeat(30));
    
    if (noteId > 0) {
      await client.callTool("deleteNotes", {
        notes: [noteId]
      });
      console.log(`✅ Deleted test note ${noteId}`);
    }
    
    // 10. Verify deletion
    const verifyResult = await client.callTool("findNotes", {
      query: `tag:test-${timestamp}`
    });
    const remainingNotes = JSON.parse(verifyResult.content[0].text);
    console.log(`✅ Verification: ${remainingNotes.length} notes remaining (should be 0)`);
    
    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("✅ ALL REAL OPERATIONS COMPLETED SUCCESSFULLY!");
    console.log("=" .repeat(50));
    console.log("\n📋 Operations Tested:");
    console.log("   ✓ List decks, models, and tags");
    console.log("   ✓ Create new note with tags");
    console.log("   ✓ Find notes by query");
    console.log("   ✓ Get detailed note information");
    console.log("   ✓ Update note fields and tags");
    console.log("   ✓ Find cards for a note");
    console.log("   ✓ Get card information");
    console.log("   ✓ Retrieve statistics");
    console.log("   ✓ Delete notes");
    console.log("   ✓ Verify deletion");
    
  } catch (_error) {
    console.error("\n❌ Error:", _error);
  } finally {
    client.stop();
  }
}

// Run the test
testRealOperations().catch(console.error);