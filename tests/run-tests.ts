#!/usr/bin/env bun

/**
 * Main Test Runner for Anki MCP E2E Tests
 * 
 * Usage:
 *   bun tests/run-tests.ts           # Run all tests
 *   bun tests/run-tests.ts basic     # Run basic connectivity tests
 *   bun tests/run-tests.ts tags      # Run tag handling tests
 *   bun tests/run-tests.ts fixes     # Run return value tests
 *   bun tests/run-tests.ts real      # Run real operations tests
 *   bun tests/run-tests.ts pagination # Run pagination tests
 *   bun tests/run-tests.ts queue     # Run queue priority tests
 */

import { spawn } from "child_process";
import { existsSync } from "fs";

const testSuites = {
  basic: "test-anki-connect.test.ts",
  tags: "test-tags.test.ts",
  fixes: "test-fixes.test.ts",
  real: "test-real-operations.test.ts",
  pagination: "test-pagination.test.ts",
  queue: "test-queue-priority.test.ts",
};

const ANKI_URL = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";

async function checkAnkiConnection(): Promise<boolean> {
  try {
    const response = await fetch(ANKI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "version",
        version: 6,
      }),
    });
    const result = await response.json();
    return !result.error && result.result >= 6;
  } catch {
    return false;
  }
}

async function runTest(testFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const testPath = `tests/${testFile}`;
    
    if (!existsSync(testPath)) {
      console.error(`❌ Test file not found: ${testPath}`);
      resolve(false);
      return;
    }

    console.log(`\n📝 Running ${testFile}...`);
    console.log("=" .repeat(50));

    const proc = spawn("bun", ["test", testPath], {
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log("🧪 Anki MCP Integration Test Suite");
  console.log("=" .repeat(50));

  // Check Anki connection
  console.log("\n🔍 Checking Anki connection...");
  const isConnected = await checkAnkiConnection();
  
  if (!isConnected) {
    console.error("❌ Cannot connect to Anki-Connect!");
    console.error("   Make sure:");
    console.error("   1. Anki is running");
    console.error("   2. Anki-Connect plugin is installed (code: 2055492159)");
    console.error("   3. Anki-Connect is listening on " + ANKI_URL);
    process.exit(1);
  }
  
  console.log("✅ Connected to Anki-Connect");

  const args = process.argv.slice(2);
  let testsToRun: string[] = [];

  if (args.length === 0) {
    // Run all tests
    testsToRun = Object.values(testSuites);
    console.log("\n📋 Running all test suites...");
  } else {
    // Run specific tests
    for (const arg of args) {
      if (testSuites[arg as keyof typeof testSuites]) {
        testsToRun.push(testSuites[arg as keyof typeof testSuites]);
      } else {
        console.warn(`⚠️  Unknown test suite: ${arg}`);
      }
    }
  }

  if (testsToRun.length === 0) {
    console.error("❌ No valid test suites specified");
    console.log("\nAvailable test suites:");
    for (const [key, file] of Object.entries(testSuites)) {
      console.log(`  ${key.padEnd(10)} - ${file}`);
    }
    process.exit(1);
  }

  // Run tests sequentially
  const results: { test: string; passed: boolean }[] = [];
  
  for (const test of testsToRun) {
    const passed = await runTest(test);
    results.push({ test, passed });
  }

  // Print summary
  console.log("\n");
  console.log("=" .repeat(50));
  console.log("📊 Test Summary");
  console.log("=" .repeat(50));
  
  let allPassed = true;
  for (const { test, passed } of results) {
    const icon = passed ? "✅" : "❌";
    const status = passed ? "PASSED" : "FAILED";
    console.log(`${icon} ${test.padEnd(30)} ${status}`);
    if (!passed) allPassed = false;
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percentage = Math.round((passedCount / totalCount) * 100);
  
  console.log("\n" + "=" .repeat(50));
  console.log(`Total: ${passedCount}/${totalCount} passed (${percentage}%)`);
  
  if (allPassed) {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed");
    process.exit(1);
  }
}

// Handle errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});