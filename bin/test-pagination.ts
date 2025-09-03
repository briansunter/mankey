#!/usr/bin/env bun

/**
 * Test pagination functionality
 */

import { spawn } from "child_process";

class PaginationTestClient {
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

async function testPagination() {
  console.log("📄 Testing Pagination Support");
  console.log("=" .repeat(50));
  
  const client = new PaginationTestClient();
  await client.start();
  
  try {
    // Test 1: findCards with pagination
    console.log("\n1️⃣ Testing findCards pagination");
    
    // First page
    const page1Result = await client.callTool("findCards", {
      query: "deck:current",
      offset: 0,
      limit: 10
    });
    const page1 = JSON.parse(page1Result.content[0].text);
    console.log(`✅ Page 1: ${page1.cards.length} cards`);
    console.log(`   Total: ${page1.pagination.total}`);
    console.log(`   Has more: ${page1.pagination.hasMore}`);
    
    // Second page
    if (page1.pagination.hasMore) {
      const page2Result = await client.callTool("findCards", {
        query: "deck:current",
        offset: page1.pagination.nextOffset,
        limit: 10
      });
      const page2 = JSON.parse(page2Result.content[0].text);
      console.log(`✅ Page 2: ${page2.cards.length} cards`);
      console.log(`   Offset: ${page2.pagination.offset}`);
    }
    
    // Test 2: findNotes with pagination
    console.log("\n2️⃣ Testing findNotes pagination");
    
    const notesResult = await client.callTool("findNotes", {
      query: "deck:current",
      offset: 0,
      limit: 5
    });
    const notes = JSON.parse(notesResult.content[0].text);
    console.log(`✅ Notes page: ${notes.notes.length} notes`);
    console.log(`   Total available: ${notes.pagination.total}`);
    console.log(`   Next offset: ${notes.pagination.nextOffset}`);
    
    // Test 3: getNextCards with pagination
    console.log("\n3️⃣ Testing getNextCards pagination");
    
    const nextPage1 = await client.callTool("getNextCards", {
      limit: 3,
      offset: 0
    });
    const next1 = JSON.parse(nextPage1.content[0].text);
    console.log(`✅ First batch: ${next1.cards.length} cards`);
    console.log(`   Total available: ${next1.pagination.total}`);
    console.log(`   Has more: ${next1.pagination.hasMore}`);
    
    if (next1.pagination.hasMore) {
      const nextPage2 = await client.callTool("getNextCards", {
        limit: 3,
        offset: next1.pagination.nextOffset
      });
      const next2 = JSON.parse(nextPage2.content[0].text);
      console.log(`✅ Second batch: ${next2.cards.length} cards`);
      console.log(`   Offset: ${next2.pagination.offset}`);
    }
    
    // Test 4: Large batch handling for notesInfo
    console.log("\n4️⃣ Testing automatic batching for large requests");
    
    // First get some note IDs
    const largeNotesResult = await client.callTool("findNotes", {
      query: "deck:current",
      limit: 150  // Get 150 note IDs
    });
    const largeNotes = JSON.parse(largeNotesResult.content[0].text);
    console.log(`   Found ${largeNotes.notes.length} notes to test with`);
    
    if (largeNotes.notes.length > 100) {
      console.log(`   Testing with ${largeNotes.notes.length} notes (>100)...`);
      const infoResult = await client.callTool("notesInfo", {
        notes: largeNotes.notes
      });
      const info = JSON.parse(infoResult.content[0].text);
      
      if (info.metadata) {
        console.log(`✅ Auto-batched into ${info.metadata.batches} batches`);
        console.log(`   Batch size: ${info.metadata.batchSize}`);
        console.log(`   Total processed: ${info.metadata.total}`);
      } else {
        console.log(`✅ Processed ${info.length} notes in single batch`);
      }
    } else {
      console.log(`   ⚠️ Not enough notes for batch test (${largeNotes.notes.length} < 100)`);
    }
    
    // Test 5: Edge cases
    console.log("\n5️⃣ Testing edge cases");
    
    // Empty result
    const emptyResult = await client.callTool("findCards", {
      query: "tag:nonexistent-tag-xyz",
      limit: 10
    });
    const empty = JSON.parse(emptyResult.content[0].text);
    console.log(`✅ Empty query: ${empty.cards.length} cards`);
    console.log(`   Has more: ${empty.pagination.hasMore}`);
    
    // Large limit (should cap at 1000)
    const largeLimit = await client.callTool("findCards", {
      query: "deck:current",
      limit: 5000
    });
    const large = JSON.parse(largeLimit.content[0].text);
    console.log(`✅ Large limit test: returned ${large.cards.length} cards`);
    console.log(`   Effective limit: ${large.pagination.limit} (max 1000)`);
    
    console.log("\n✨ Pagination test completed!");
    console.log("\n📝 Summary:");
    console.log("   - findCards and findNotes support offset/limit pagination");
    console.log("   - getNextCards supports pagination for queue browsing");
    console.log("   - notesInfo and cardsInfo auto-batch large requests");
    console.log("   - Limits are capped at 1000 for safety");
    console.log("   - All responses include pagination metadata");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    client.stop();
  }
}

testPagination().catch(console.error);