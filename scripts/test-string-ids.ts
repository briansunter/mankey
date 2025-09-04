#!/usr/bin/env bun

/**
 * Test that string IDs are properly converted to numbers
 */

import { spawn, type ChildProcess } from "child_process";

class TestClient {
  private process: ChildProcess | null = null;
  private responseBuffer = "";
  private requestId = 1;
  
  async start() {
    this.process = spawn("bun", ["src/index.ts"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    this.process.stdout?.on("data", (data: Buffer) => {
      this.responseBuffer += data.toString();
    });
    
    this.process.stderr?.on("data", (data: Buffer) => {
      console.error("Server:", data.toString());
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
    
    this.process?.stdin?.write(JSON.stringify(request) + "\n");
    await new Promise(resolve => setTimeout(resolve, 500));
    
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
        } catch (_e) {}
      }
    }
    return null;
  }
  
  stop() {
    this.process?.kill();
  }
}

async function testStringIds() {
  console.log("🧪 Testing String ID Conversion");
  console.log("=" .repeat(50));
  
  const client = new TestClient();
  await client.start();
  
  try {
    // First, find some cards
    console.log("\n1️⃣ Finding cards...");
    const findResult = await client.callTool("findCards", { 
      query: "deck:Default" 
    }) as { content: Array<{ text: string }> } | null;
    if (!findResult?.content?.[0]?.text) {
      throw new Error("Failed to find cards");
    }
    const cardIds = JSON.parse(findResult.content[0].text);
    console.log(`✅ Found ${cardIds.length} cards`);
    
    if (cardIds.length > 0) {
      // Test with string IDs
      const stringIds = cardIds.slice(0, 2).map(String);
      console.log(`\n2️⃣ Testing cardsInfo with string IDs: ${stringIds}`);
      
      try {
        const cardsInfoResult = await client.callTool("cardsInfo", { 
          cards: stringIds 
        }) as { content: Array<{ text: string }> } | null;
        if (!cardsInfoResult?.content?.[0]?.text) {
          throw new Error("Failed to get cards info");
        }
        const info = JSON.parse(cardsInfoResult.content[0].text);
        console.log(`✅ cardsInfo handled string IDs correctly (got ${info.length} cards)`);
      } catch (error: unknown) {
        console.error(`❌ cardsInfo failed with string IDs: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Test with mixed IDs (strings and numbers)
      const mixedIds = [stringIds[0], cardIds[1]];
      console.log(`\n3️⃣ Testing with mixed IDs (string and number): ${mixedIds}`);
      
      try {
        const mixedResult = await client.callTool("cardsInfo", { 
          cards: mixedIds 
        }) as { content: Array<{ text: string }> } | null;
        if (!mixedResult?.content?.[0]?.text) {
          throw new Error("Failed to get mixed cards info");
        }
        const mixedInfo = JSON.parse(mixedResult.content[0].text);
        console.log(`✅ cardsInfo handled mixed IDs correctly (got ${mixedInfo.length} cards)`);
      } catch (error: unknown) {
        console.error(`❌ cardsInfo failed with mixed IDs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Test notesInfo with string IDs
    console.log("\n4️⃣ Finding notes...");
    const notesResult = await client.callTool("findNotes", { 
      query: "deck:Default" 
    }) as { content: Array<{ text: string }> } | null;
    if (!notesResult?.content?.[0]?.text) {
      throw new Error("Failed to find notes");
    }
    const noteIds = JSON.parse(notesResult.content[0].text);
    
    if (noteIds.length > 0) {
      const stringNoteIds = noteIds.slice(0, 2).map(String);
      console.log(`\n5️⃣ Testing notesInfo with string IDs: ${stringNoteIds}`);
      
      try {
        const notesInfoResult = await client.callTool("notesInfo", { 
          notes: stringNoteIds 
        }) as { content: Array<{ text: string }> } | null;
        if (!notesInfoResult?.content?.[0]?.text) {
          throw new Error("Failed to get notes info");
        }
        const info = JSON.parse(notesInfoResult.content[0].text);
        console.log(`✅ notesInfo handled string IDs correctly (got ${info.length} notes)`);
      } catch (error: unknown) {
        console.error(`❌ notesInfo failed with string IDs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log("\n✨ String ID conversion test completed!");
    
  } catch (error: unknown) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  } finally {
    client.stop();
  }
}

testStringIds().catch(console.error);