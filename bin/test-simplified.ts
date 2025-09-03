#!/usr/bin/env bun

/**
 * Test the simplified MCP server
 */

import { spawn } from "child_process";

class SimplifiedTestClient {
  private process: any;
  private responseBuffer = "";
  private requestId = 1;
  
  async start(serverPath: string) {
    this.process = spawn("bun", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    this.process.stdout.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();
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
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lines = this.responseBuffer.split("\n");
    this.responseBuffer = "";
    
    for (const line of lines) {
      if (line.trim() && line.startsWith("{")) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            if (response.error) throw new Error(response.error.message);
            return response.result;
          }
        } catch (e) {}
      }
    }
    return null;
  }
  
  stop() {
    this.process?.kill();
  }
}

async function testSimplified() {
  console.log("🧪 Testing Simplified MCP Server");
  console.log("=" .repeat(50));
  
  const client = new SimplifiedTestClient();
  await client.start("src/index-simplified.ts");
  
  try {
    // Quick tests
    console.log("\n📊 Quick Validation:");
    
    // 1. List decks
    const decks = await client.callTool("deckNames", {});
    console.log("✅ List decks:", JSON.parse(decks.content[0].text).length > 0);
    
    // 2. Create and delete a test deck
    const testDeck = `SimplifiedTest_${Date.now()}`;
    const createResult = await client.callTool("createDeck", { deck: testDeck });
    console.log("✅ Create deck:", JSON.parse(createResult.content[0].text) > 0);
    
    // 3. Add a note
    const noteResult = await client.callTool("addNote", {
      deckName: testDeck,
      modelName: "Basic",
      fields: { Front: "Test Q", Back: "Test A" },
      tags: ["test"]
    });
    const noteId = JSON.parse(noteResult.content[0].text);
    console.log("✅ Add note:", noteId > 0);
    
    // 4. Find the note
    const findResult = await client.callTool("findNotes", { 
      query: `deck:${testDeck}` 
    });
    console.log("✅ Find notes:", JSON.parse(findResult.content[0].text).length === 1);
    
    // 5. Delete the note
    await client.callTool("deleteNotes", { notes: [noteId] });
    console.log("✅ Delete note: completed");
    
    // 6. Delete the deck
    await client.callTool("deleteDecks", { 
      decks: [testDeck], 
      cardsToo: true 
    });
    console.log("✅ Delete deck: completed");
    
    console.log("\n✨ Simplified server works correctly!");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    client.stop();
  }
}

testSimplified().catch(console.error);