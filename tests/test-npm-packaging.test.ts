import { test, expect } from "bun:test";
import { readFileSync, accessSync, constants } from "fs";
import { join } from "path";

test("npm packaging - bin/mankey.ts exists", () => {
  const binPath = join(process.cwd(), "bin", "mankey.ts");

  // Should exist
  expect(() => accessSync(binPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - bin/mankey.ts has bun shebang", () => {
  const binPath = join(process.cwd(), "bin", "mankey.ts");
  const content = readFileSync(binPath, "utf-8");
  const firstLine = content.split("\n")[0];

  expect(firstLine).toBe("#!/usr/bin/env bun");
});

test("npm packaging - src/index.ts exists", () => {
  const srcPath = join(process.cwd(), "src", "index.ts");

  // Should exist
  expect(() => accessSync(srcPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - package.json has required fields", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  // Required fields for npm publishing
  expect(pkg.name).toBe("mankey");
  expect(pkg.main).toBe("src/index.ts");
  expect(pkg.bin).toEqual({ mankey: "bin/mankey.ts" });

  // Should have publishConfig
  expect(pkg.publishConfig).toBeDefined();
  expect(pkg.publishConfig.access).toBe("public");
  expect(pkg.publishConfig.registry).toBe("https://registry.npmjs.org/");

  // Files array should include bin and src
  expect(pkg.files).toContain("bin");
  expect(pkg.files).toContain("src");
  expect(pkg.files).toContain("README.md");
  expect(pkg.files).toContain("LICENSE");

  // Should NOT have module field (conflicts with main)
  expect(pkg.module).toBeUndefined();
});

test("npm packaging - package.json has correct scripts", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.scripts.build).toBe("tsc");
  expect(pkg.scripts.start).toBe("bun bin/mankey.ts mcp");
});

test("npm packaging - shared modules exist", () => {
  const sharedDir = join(process.cwd(), "src", "shared");

  expect(() => accessSync(join(sharedDir, "config.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(sharedDir, "types.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(sharedDir, "normalize.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(sharedDir, "schema.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(sharedDir, "anki-connect.ts"), constants.F_OK)).not.toThrow();
});

test("npm packaging - tool category files exist", () => {
  const toolsDir = join(process.cwd(), "src", "tools");

  expect(() => accessSync(join(toolsDir, "index.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "decks.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "notes.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "cards.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "models.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "media.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "stats.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "gui.ts"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(toolsDir, "system.ts"), constants.F_OK)).not.toThrow();
});

test("npm packaging - .npmignore excludes test files but not source", () => {
  const npmignorePath = join(process.cwd(), ".npmignore");
  const content = readFileSync(npmignorePath, "utf-8");

  // Should NOT exclude src/ (we ship source now)
  expect(content).not.toMatch(/^src\/$/m);

  // Should exclude tests/
  expect(content).toContain("tests/");

  // Should exclude docs/
  expect(content).toContain("docs/");

  // Should exclude config files
  expect(content).toContain("tsconfig.json");
  expect(content).toContain(".github/");

  // Should exclude test files
  expect(content).toContain("*.test.ts");
  expect(content).toContain("*.test.js");
});

test("npm packaging - package.json repository field is correct", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.repository).toBeDefined();
  expect(pkg.repository.type).toBe("git");
  expect(pkg.repository.url).toBe("https://github.com/briansunter/mankey.git");
});

test("npm packaging - package.json has keywords including cli", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.keywords).toBeDefined();
  expect(Array.isArray(pkg.keywords)).toBe(true);
  expect(pkg.keywords.length).toBeGreaterThan(0);

  // Should include MCP, Anki, and CLI keywords
  expect(pkg.keywords).toContain("mcp");
  expect(pkg.keywords).toContain("anki");
  expect(pkg.keywords).toContain("cli");
});

test("npm packaging - commander dependency exists", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.dependencies.commander).toBeDefined();
});
