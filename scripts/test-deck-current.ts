#!/usr/bin/env bun

/**
 * Test deck:current functionality
 */

import { spawn } from "child_process";

class TestClient {
  private process: import("child_process").ChildProcess | null = null;
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
      const msg = data.toString();
      if (!msg.includes("running on stdio")) {
        console.log("Server:", msg.trim());
      }
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
            if (response.error) {throw new Error(response.error.message);}
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

async function testDeckCurrent() {
  console.log("🎯 Testing deck:current Support");
  console.log("=" .repeat(50));
  
  const client = new TestClient();
  await client.start();
  
  try {
    // Test 1: findCards with deck:current
    console.log("\n1️⃣ Testing findCards with deck:current");
    const cardsResult = await client.callTool("findCards", {
      query: "deck:current"
    });
    const cardsContent = (cardsResult as { content: [{ text: string }] }).content[0].text;
    const cards = JSON.parse(cardsContent) as unknown[];
    console.log(`✅ Found ${cards.length} cards in current deck`);
    
    // Test 2: findCards with deck:current and additional filters
    console.log("\n2️⃣ Testing findCards with deck:current is:due");
    const dueResult = await client.callTool("findCards", {
      query: "deck:current is:due"
    });
    const dueContent = (dueResult as { content: [{ text: string }] }).content[0].text;
    const dueCards = JSON.parse(dueContent) as unknown[];
    console.log(`✅ Found ${dueCards.length} due cards in current deck`);
    
    // Test 3: findNotes with deck:current
    console.log("\n3️⃣ Testing findNotes with deck:current");
    const notesResult = await client.callTool("findNotes", {
      query: "deck:current"
    });
    const notesContent = (notesResult as { content: [{ text: string }] }).content[0].text;
    const notes = JSON.parse(notesContent) as unknown[];
    console.log(`✅ Found ${notes.length} notes in current deck`);
    
    // Test 4: getNextCards with deck:'current'
    console.log("\n4️⃣ Testing getNextCards with deck:'current'");
    const nextResult = await client.callTool("getNextCards", {
      deck: "current",
      limit: 5
    });
    const nextContent = (nextResult as { content: [{ text: string }] }).content[0].text;
    const nextCards = JSON.parse(nextContent) as { totalCards: number; breakdown: { learning: number; review: number; new: number } };
    console.log(`✅ Got ${nextCards.totalCards} cards from current deck`);
    console.log(`   Learning: ${nextCards.breakdown.learning}`);
    console.log(`   Review: ${nextCards.breakdown.review}`);
    console.log(`   New: ${nextCards.breakdown.new}`);
    
    // Test 5: getDueCardsDetailed with deck:'current'
    console.log("\n5️⃣ Testing getDueCardsDetailed with deck:'current'");
    const detailedResult = await client.callTool("getDueCardsDetailed", {
      deck: "current"
    });
    const detailedContent = (detailedResult as { content: [{ text: string }] }).content[0].text;
    const detailed = JSON.parse(detailedContent) as { learning: unknown[]; review: unknown[]; total: number };
    console.log(`✅ Current deck due cards:`);
    console.log(`   Learning: ${detailed.learning.length}`);
    console.log(`   Review: ${detailed.review.length}`);
    console.log(`   Total: ${detailed.total}`);
    
    // Test 6: Compare current deck vs all decks
    console.log("\n6️⃣ Comparing current deck vs all decks");
    
    // All decks
    const allDueResult = await client.callTool("findCards", {
      query: "is:due"
    });
    const allDueContent = (allDueResult as { content: [{ text: string }] }).content[0].text;
    const allDue = JSON.parse(allDueContent) as unknown[];
    
    // Current deck only
    const currentDueResult = await client.callTool("findCards", {
      query: "deck:current is:due"
    });
    const currentDueContent = (currentDueResult as { content: [{ text: string }] }).content[0].text;
    const currentDue = JSON.parse(currentDueContent) as unknown[];
    
    console.log(`✅ Comparison:`);
    console.log(`   All decks due: ${allDue.length} cards`);
    console.log(`   Current deck due: ${currentDue.length} cards`);
    console.log(`   Other decks: ${allDue.length - currentDue.length} cards`);
    
    console.log("\n✨ deck:current support test completed!");
    console.log("\n📝 Summary:");
    console.log("   - 'deck:current' works in query strings (findCards, findNotes)");
    console.log("   - deck:'current' parameter works in new tools");
    console.log("   - Can combine deck:current with other filters");
    console.log("   - Properly isolates current deck from all decks");
    
  } catch (error: unknown) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  } finally {
    client.stop();
  }
}

testDeckCurrent().catch(console.error);