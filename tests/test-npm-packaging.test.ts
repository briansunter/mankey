import { test, expect } from "bun:test";
import { readFileSync, accessSync, constants, statSync } from "fs";
import { join } from "path";

test("npm packaging - dist/main.js exists after build", () => {
  const distPath = join(process.cwd(), "dist", "main.js");
  expect(() => accessSync(distPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - dist/main.js is executable", () => {
  const distPath = join(process.cwd(), "dist", "main.js");
  const stats = statSync(distPath);
  const isExecutable = (stats.mode & constants.X_OK) !== 0;
  expect(isExecutable).toBe(true);
});

test("npm packaging - dist/main.js has node shebang", () => {
  const distPath = join(process.cwd(), "dist", "main.js");
  const content = readFileSync(distPath, "utf-8");
  const firstLine = content.split("\n")[0];
  expect(firstLine).toBe("#!/usr/bin/env node");
});

test("npm packaging - dist/index.js exists after build", () => {
  const distPath = join(process.cwd(), "dist", "index.js");
  expect(() => accessSync(distPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - bin/anki-ai.ts exists for bun development", () => {
  const binPath = join(process.cwd(), "bin", "anki-ai.ts");
  expect(() => accessSync(binPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - src/index.ts exists", () => {
  const srcPath = join(process.cwd(), "src", "index.ts");
  expect(() => accessSync(srcPath, constants.F_OK)).not.toThrow();
});

test("npm packaging - package.json has required fields", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.name).toBe("anki-ai");
  expect(pkg.main).toBe("dist/index.js");
  expect(pkg.types).toBe("dist/index.d.ts");
  expect(pkg.bin).toEqual({ "anki-ai": "dist/main.js" });

  expect(pkg.publishConfig).toBeDefined();
  expect(pkg.publishConfig.access).toBe("public");
  expect(pkg.publishConfig.registry).toBe("https://registry.npmjs.org/");

  expect(pkg.files).toContain("dist");
  expect(pkg.files).toContain("src");
  expect(pkg.files).toContain("README.md");
  expect(pkg.files).toContain("LICENSE");

  expect(pkg.module).toBeUndefined();
});

test("npm packaging - package.json has correct scripts", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.scripts.build).toBe("tsc && chmod +x dist/main.js");
  expect(pkg.scripts.prepublishOnly).toBe("tsc && chmod +x dist/main.js");
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

test("npm packaging - .npmignore excludes test files but ships dist and src", () => {
  const npmignorePath = join(process.cwd(), ".npmignore");
  const content = readFileSync(npmignorePath, "utf-8");

  // Should NOT exclude src/ or dist/ (we ship both)
  expect(content).not.toMatch(/^src\/$/m);
  expect(content).not.toMatch(/^dist\/$/m);

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
  expect(pkg.repository.url).toBe("https://github.com/briansunter/anki-ai.git");
});

test("npm packaging - package.json has keywords including cli", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.keywords).toBeDefined();
  expect(Array.isArray(pkg.keywords)).toBe(true);
  expect(pkg.keywords.length).toBeGreaterThan(0);

  expect(pkg.keywords).toContain("mcp");
  expect(pkg.keywords).toContain("anki");
  expect(pkg.keywords).toContain("cli");
});

test("npm packaging - commander dependency exists", () => {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  expect(pkg.dependencies.commander).toBeDefined();
});

test("npm packaging - dist has compiled tool modules", () => {
  const distToolsDir = join(process.cwd(), "dist", "tools");

  expect(() => accessSync(join(distToolsDir, "index.js"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(distToolsDir, "decks.js"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(distToolsDir, "notes.js"), constants.F_OK)).not.toThrow();
  expect(() => accessSync(join(distToolsDir, "cards.js"), constants.F_OK)).not.toThrow();
});
