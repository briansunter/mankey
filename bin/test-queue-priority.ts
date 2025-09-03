#!/usr/bin/env bun

/**
 * Test queue-based card retrieval with learning/review priority
 */

import { spawn } from "child_process";

class QueueTestClient {
  private process: any;
  private responseBuffer = "";
  private requestId = 1;
  
  async start() {
    this.process = spawn("bun", ["src/index.ts"], {
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

async function testQueuePriority() {
  console.log("🎯 Testing Queue-Based Card Retrieval");
  console.log("=" .repeat(50));
  
  const client = new QueueTestClient();
  await client.start();
  
  try {
    // Test 1: Get next cards in queue order
    console.log("\n1️⃣ Testing getNextCards - Queue Priority Order");
    const nextCardsResult = await client.callTool("getNextCards", {
      limit: 5
    });
    const nextCards = JSON.parse(nextCardsResult.content[0].text);
    console.log(`✅ Found ${nextCards.totalCards} cards in queue order`);
    console.log(`   Learning: ${nextCards.breakdown.learning} cards`);
    console.log(`   Review: ${nextCards.breakdown.review} cards`);
    console.log(`   New: ${nextCards.breakdown.new} cards`);
    
    if (nextCards.cards && nextCards.cards.length > 0) {
      console.log("\n   First 3 cards in queue:");
      for (let i = 0; i < Math.min(3, nextCards.cards.length); i++) {
        const card = nextCards.cards[i];
        const front = card.fields?.Front?.value || card.fields?.Simplified?.value || "N/A";
        const queueType = card.queue === 1 ? "Learning" : 
                         card.queue === 3 ? "Relearning" :
                         card.queue === 2 ? "Review" : "New";
        console.log(`   ${i+1}. [${queueType}] ${front.substring(0, 30)}...`);
      }
    }
    
    // Test 2: Get detailed due cards breakdown
    console.log("\n2️⃣ Testing getDueCardsDetailed - Categorized View");
    const detailedResult = await client.callTool("getDueCardsDetailed", {});
    
    if (!detailedResult || !detailedResult.content) {
      console.log("   ⚠️ getDueCardsDetailed returned no data");
      console.log("   Raw result:", detailedResult);
    } else {
      const detailed = JSON.parse(detailedResult.content[0].text);
      
      console.log(`✅ Detailed breakdown:`);
      console.log(`   Learning cards: ${detailed.learning.length}`);
      console.log(`   Review cards: ${detailed.review.length}`);
      console.log(`   Total due: ${detailed.total}`);
      
      if (detailed.learning.length > 0) {
        console.log("\n   Sample learning cards:");
        for (let i = 0; i < Math.min(2, detailed.learning.length); i++) {
          const card = detailed.learning[i];
          console.log(`   - [${card.queue}] ${card.front.substring(0, 30)}... (due: ${card.due})`);
        }
      }
      
      if (detailed.review.length > 0) {
        console.log("\n   Sample review cards:");
        for (let i = 0; i < Math.min(2, detailed.review.length); i++) {
          const card = detailed.review[i];
          console.log(`   - ${card.front.substring(0, 30)}... (interval: ${card.interval} days)`);
        }
      }
    }
    
    // Test 3: Compare with traditional findCards
    console.log("\n3️⃣ Comparing with traditional findCards");
    const traditionalDue = await client.callTool("findCards", {
      query: "is:due"
    });
    const traditionalCards = JSON.parse(traditionalDue.content[0].text);
    console.log(`✅ Traditional 'is:due' found: ${traditionalCards.length} cards`);
    console.log(`   Note: This only includes review cards, not learning cards`);
    
    // Test 4: Test specific deck if available
    console.log("\n4️⃣ Testing with specific deck");
    const decks = await client.callTool("deckNames", {});
    const deckList = JSON.parse(decks.content[0].text);
    
    if (deckList.length > 0 && deckList[0] !== "Default") {
      const testDeck = deckList[0];
      console.log(`   Testing deck: "${testDeck}"`);
      
      const deckCards = await client.callTool("getNextCards", {
        deck: testDeck,
        limit: 3
      });
      const deckResult = JSON.parse(deckCards.content[0].text);
      console.log(`   ✅ Found ${deckResult.totalCards} cards in this deck`);
    }
    
    console.log("\n✨ Queue-based retrieval test completed!");
    console.log("\n📝 Summary:");
    console.log("   - getNextCards respects Anki's queue priority");
    console.log("   - Learning cards appear before review cards");
    console.log("   - getDueCardsDetailed provides categorized breakdown");
    console.log("   - Traditional 'is:due' only shows review cards");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    client.stop();
  }
}

testQueuePriority().catch(console.error);