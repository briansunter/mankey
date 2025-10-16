import { test, expect } from "bun:test";
import { readFileSync, accessSync, constants, statSync } from "fs";
import { join } from "path";

test("npm packaging - dist/index.js exists", () => {
  const distPath = join(process.cwd(), "dist", "index.js");

  // Should exist
  expect(() => accessSync(distPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - dist/index.js is executable", () => {
  const distPath = join(process.cwd(), "dist", "index.js");

  // Check file permissions include execute bit
  const stats = statSync(distPath);
  const isExecutable = (stats.mode & constants.X_OK) !== 0;

  expect(isExecutable).toBe(true);
});

test("npm packaging - dist/index.js has shebang", () => {
  const distPath = join(process.cwd(), "dist", "index.js");
  const content = readFileSync(distPath, "utf-8");
  const firstLine = content.split("\n")[0];

  expect(firstLine).toBe("#!/usr/bin/env node");
});

test("npm packaging - package.json has required fields", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  // Required fields for npm publishing
  expect(pkg.name).toBe("mankey");
  expect(pkg.main).toBe("dist/index.js");
  expect(pkg.types).toBe("dist/index.d.ts");
  expect(pkg.bin).toEqual({ mankey: "dist/index.js" });

  // Should have publishConfig
  expect(pkg.publishConfig).toBeDefined();
  expect(pkg.publishConfig.access).toBe("public");
  expect(pkg.publishConfig.registry).toBe("https://registry.npmjs.org/");

  // Files array should include dist
  expect(pkg.files).toContain("dist");
  expect(pkg.files).toContain("README.md");
  expect(pkg.files).toContain("LICENSE");

  // Should NOT have module field (conflicts with main)
  expect(pkg.module).toBeUndefined();
});

test("npm packaging - package.json has correct scripts", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.scripts.build).toBe("tsc && chmod +x dist/index.js");
  expect(pkg.scripts.prepublishOnly).toBe("npm run build");
});

test("npm packaging - dist directory structure", () => {
  const distDir = join(process.cwd(), "dist");

  // Should have index.js
  expect(() => accessSync(join(distDir, "index.js"), constants.F_OK)).not.toThrow();

  // Should have index.d.ts (TypeScript declarations)
  expect(() => accessSync(join(distDir, "index.d.ts"), constants.F_OK)).not.toThrow();
});

test("npm packaging - .npmignore excludes source files", () => {
  const npmignorePath = join(process.cwd(), ".npmignore");
  const content = readFileSync(npmignorePath, "utf-8");

  // Should exclude src/
  expect(content).toContain("src/");

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

test("npm packaging - package.json has keywords", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.keywords).toBeDefined();
  expect(Array.isArray(pkg.keywords)).toBe(true);
  expect(pkg.keywords.length).toBeGreaterThan(0);

  // Should include MCP and Anki keywords
  expect(pkg.keywords).toContain("mcp");
  expect(pkg.keywords).toContain("anki");
});
