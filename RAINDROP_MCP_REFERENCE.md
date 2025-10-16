# Raindrop MCP Reference Guide for Mankey Configuration

## Executive Summary

The raindrop-mcp project provides an excellent reference for how to configure an MCP (Model Context Protocol) package for npm/bun distribution. This guide documents its architecture, publishing configuration, build setup, and CI/CD pipeline for use as a reference when configuring mankey-mcp.

---

## 1. Project Structure Overview

### Directory Layout
```
raindrop-mcp/
├── .github/workflows/           # CI/CD pipelines
│   ├── commit-lint.yml          # Commit message validation
│   ├── publish.yml              # Manual publish workflow
│   └── release.yml              # Semantic release automation
├── src/
│   ├── index.ts                 # Main entry point (1314 lines)
│   └── __tests__/               # Test suite
│       ├── client.test.ts       # Client library tests
│       ├── helpers.test.ts      # Utility function tests
│       └── responses.test.ts    # Response formatting tests
├── dist/                        # Compiled output (built via tsc)
│   ├── index.js                 # Executable binary
│   ├── index.d.ts               # TypeScript definitions
│   ├── index.js.map             # Source maps
│   └── index.d.ts.map
├── package.json                 # Package metadata
├── tsconfig.json                # TypeScript configuration
├── eslint.config.js             # ESLint configuration
├── bunfig.toml                  # Bun runtime config
├── commitlint.config.cjs        # Commit message rules
├── .releaserc.json              # Semantic-release config
├── .gitignore                   # Git ignore rules
├── README.md                    # User documentation
├── CONTRIBUTING.md              # Developer guidelines
├── CHANGELOG.md                 # Version history
└── LICENSE                      # MIT license
```

### Build Output
- **dist/index.js** - Compiled executable binary (~10KB)
  - Starts with `#!/usr/bin/env node` shebang
  - Made executable by build script (`chmod +x dist/index.js`)
  - ES Module format (preserves `import` statements)
- **dist/index.d.ts** - TypeScript type definitions
- **dist/\*.map** - Source maps for debugging

---

## 2. Package.json Configuration

### Key Fields

```json
{
  "name": "@briansunter/raindrop-mcp",
  "version": "1.1.2",
  "description": "MCP server for Raindrop.io API integration",
  
  // Entry points for different use cases
  "main": "dist/index.js",                    // CommonJS/Node require
  "types": "dist/index.d.ts",                 // TypeScript definitions
  "type": "module",                           // ES Modules (important!)
  
  // Binary executable configuration
  "bin": {
    "raindrop-mcp": "dist/index.js",          // npx raindrop-mcp
    "briansunter-raindrop-mcp": "dist/index.js"
  },
  
  // Distribution configuration
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  
  // NPM publishing settings
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  
  // Repository information
  "repository": {
    "type": "git",
    "url": "https://github.com/briansunter/raindrop-mcp.git"
  },
  
  // Runtime requirements
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Important Notes

1. **"type": "module"** - Critical for ES Module support. Enables `import` syntax in both TypeScript and compiled JS.
2. **"main" vs "types"** - The main field points to the compiled JS (for execution), types field points to `.d.ts` (for IDE/type checking).
3. **"bin" field** - Enables installation as a CLI tool. Multiple names can point to the same script.
4. **"files" array** - Only these files are included in the published npm package (reduces package size).

### Build Before Publish

The package.json includes a "prepublishOnly" script:
```json
"prepublishOnly": "npm run build"
```
This ensures the package is built before publishing to npm.

---

## 3. Build and Compilation Setup

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",                      // Modern JavaScript target
    "module": "ESNext",                      // Preserve ES modules
    "moduleResolution": "bundler",           // Supports import resolution
    "lib": ["ES2020"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,                          // Strict type checking
    "esModuleInterop": true,                 // Enable CommonJS interop
    "skipLibCheck": true,                    // Speed up compilation
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,               // Import JSON files
    "declaration": true,                     // Generate .d.ts files
    "declarationMap": true,                  // Map declarations to source
    "sourceMap": true                        // Generate source maps
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

### Build Scripts

```json
"build": "tsc && chmod +x dist/index.js",
"typecheck": "tsc --noEmit",
"dev": "bun run src/index.ts",
"start": "node dist/index.js",
"start:dev": "node -r dotenv/config dist/index.js"
```

### Build Process Flow

1. **TypeScript Compilation**
   - Compiles `src/` to `dist/`
   - Generates `.d.ts` type definitions
   - Creates source maps for debugging
   - Output is ES Module format

2. **Make Executable**
   - `chmod +x dist/index.js` ensures the binary can be executed
   - Works because of the shebang: `#!/usr/bin/env node`

3. **Installation Options**
   - **npm:** `npx @briansunter/raindrop-mcp`
   - **bun:** `bunx @briansunter/raindrop-mcp`
   - **global:** `npm install -g @briansunter/raindrop-mcp`

---

## 4. Entry Point Implementation

### File: src/index.ts

**Key Structure:**
```typescript
#!/usr/bin/env node                    // Shebang for direct execution
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Configuration loading
const AUTH_TOKEN = process.env.RAINDROP_TOKEN;
if (!AUTH_TOKEN) {
  console.error("Error: RAINDROP_TOKEN environment variable is not set");
  process.exit(1);
}

// Server initialization
const server = new McpServer({
  name: "raindrop-mcp",
  version: "1.0.0",
});

// Tool registration
server.registerTool("tool-name", {...}, handler);

// Server startup
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Key Patterns:**

1. **Environment Variables** - Used for sensitive config (tokens, API keys)
2. **Debug Logging** - Writes to stderr to avoid interfering with MCP protocol on stdout
3. **Error Handling** - Graceful shutdown with meaningful error messages
4. **Tool Pattern** - Each tool is registered with input schema (Zod) and handler

**Export for Testing:**
```typescript
export {
  cleanTitle,
  cleanTitlesInData,
  RaindropClient,
  createSuccessResponse,
  // ... other utilities
};
```

---

## 5. Publishing Configuration

### NPM Configuration

**publishConfig in package.json:**
```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

This ensures:
- Package is published publicly (not as private)
- Published to official npm registry
- Can be installed without authentication

### Semantic Release Configuration (.releaserc.json)

```json
{
  "branches": ["main", "master"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        "assets": ["package.json", "CHANGELOG.md"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**Workflow:**
1. Analyze commits using conventional commit format (feat:, fix:, etc.)
2. Determine version bump (patch, minor, major)
3. Generate changelog
4. Publish to npm
5. Commit version changes to git
6. Create GitHub release with release notes

---

## 6. CI/CD Pipelines

### Three GitHub Workflows

#### A. Commit Linting (commit-lint.yml)

**Triggers:** On pull request creation/update
**Purpose:** Ensure commit messages follow conventional format

```yaml
name: Validate Commit Messages
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
      - run: npm install --save-dev @commitlint/cli
      - run: npx commitlint --from [base] --to [head] --verbose
      - run: echo "$PR_TITLE" | npx commitlint
```

#### B. Semantic Release (release.yml)

**Triggers:** 
- Push to main/master branch
- PR merge to main/master

**Purpose:** Automated versioning and npm publishing

```yaml
name: Semantic Release
on:
  push:
    branches: [main, master]
  pull_request:
    types: [closed]
    branches: [main, master]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
      - run: npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### C. Manual Publish (publish.yml)

**Triggers:** GitHub release event or manual workflow dispatch
**Purpose:** Backup/manual publishing option

```yaml
name: Publish to npm
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - if: version input
        run: npm version ${{ inputs.version }} --no-git-tag-version
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Required GitHub Secrets

- **NPM_TOKEN** - API token for npm authentication (created at npmjs.com)
- **GITHUB_TOKEN** - Provided automatically by GitHub

---

## 7. Development Setup and Linting

### ESLint Configuration (eslint.config.js)

```javascript
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.node, ...globals.browser }
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'double']
    }
  }
];
```

### Commit Message Format (commitlint.config.cjs)

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'revert', 'ci', 'build']
    ],
    'body-max-line-length': [0, 'always']
  }
};
```

### Bun Configuration (bunfig.toml)

```toml
[test]
coverage = true
coverageThreshold = 80
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
```

---

## 8. Testing Setup

### Test Framework: Bun Test

**Example: src/__tests__/client.test.ts**

```typescript
import { describe, expect, test, beforeEach, mock } from "bun:test";
import { RaindropClient } from "../index";

describe("RaindropClient", () => {
  let client: RaindropClient;

  beforeEach(() => {
    client = new RaindropClient("test-token");
  });

  describe("getCollections", () => {
    test("fetches root collections successfully", async () => {
      const mockResponse = { result: true, items: [...] };
      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getCollections(true);
      expect(result.result).toBe(true);
    });
  });
});
```

**Test Scripts:**
```json
"test": "bun test",
"test:watch": "bun test --watch",
"test:coverage": "bun test --coverage"
```

---

## 9. Environment and Dependencies

### Dependencies (Production)

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "node-fetch": "^3.3.2",
  "zod": "^3.22.0"
}
```

### Dev Dependencies

```json
{
  "@commitlint/cli": "^19.0.0",
  "@commitlint/config-conventional": "^19.0.0",
  "@semantic-release/changelog": "^6.0.3",
  "@semantic-release/git": "^10.0.1",
  "@semantic-release/github": "^10.0.0",
  "@semantic-release/npm": "^12.0.0",
  "@typescript-eslint/eslint-plugin": "^8.42.0",
  "@typescript-eslint/parser": "^8.42.0",
  "eslint": "^9.34.0",
  "semantic-release": "^24.0.0",
  "typescript": "^5.3.0"
}
```

### Environment Variables

**.env.example:**
```
# Raindrop.io API Token
# Get your token from: https://app.raindrop.io/settings/integrations
RAINDROP_TOKEN=your-raindrop-api-token-here
```

### .gitignore Patterns

```
# Always ignore
node_modules/
dist/
coverage/

# Never commit secrets
.env
.env.*
!.env.example

# Keep compiled files only in dist/
*.js
*.d.ts
*.map
# Except:
!src/**/*.ts
!eslint.config.js
!commitlint.config.cjs
```

---

## 10. Installation and Usage Methods

### For End Users

**Method 1: NPX (Recommended)**
```bash
npx @briansunter/raindrop-mcp
```

**Method 2: Bun**
```bash
bunx @briansunter/raindrop-mcp
```

**Method 3: Global Installation**
```bash
npm install -g @briansunter/raindrop-mcp
raindrop-mcp
```

**Method 4: Claude Desktop Config**
```json
{
  "mcpServers": {
    "raindrop": {
      "command": "npx",
      "args": ["-y", "@briansunter/raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

### For Developers

```bash
# Setup
git clone https://github.com/briansunter/raindrop-mcp.git
cd raindrop-mcp
npm install

# Development
npm run build              # Compile TypeScript
npm run dev               # Run with hot reload
npm run typecheck         # Check types
npm run lint              # Lint code
npm test                  # Run tests

# Before committing
npm run build
npm run typecheck
npm run lint
npm test

# Create PR with conventional commits:
# feat: add new feature
# fix: bug fix
# docs: documentation
```

---

## 11. Version Release Process

### Automated (Semantic Release)

1. **Commit with conventional format:**
   ```
   feat: add new API endpoint
   fix: resolve pagination bug
   ```

2. **Push to main/master** - Triggers release workflow

3. **Automatic steps:**
   - Analyze commits
   - Determine version (patch/minor/major)
   - Update package.json version
   - Generate CHANGELOG.md
   - Build project
   - Publish to npm
   - Create GitHub release
   - Tag in git

### Manual Release

1. Use GitHub Actions "Publish to npm" workflow
2. Input version number (e.g., 1.1.3)
3. Workflow builds and publishes

---

## 12. Key Recommendations for Mankey-MCP

### Apply These Patterns

1. **Use "type": "module"** for ES Module support
2. **Set up semantic-release** for automated versioning
3. **Require Node >=18** (modern async/await support)
4. **Add "bin" field** for CLI tool installation
5. **Use shebang** (`#!/usr/bin/env node`) in entry point
6. **Make binary executable** during build (`chmod +x`)
7. **Setup GitHub workflows** for CI/CD
8. **Use conventional commits** for changelog generation
9. **Add .npmignore** to reduce package size (include only dist/, README, LICENSE)
10. **Export utilities** from index.ts for testing

### Package.json Boilerplate

```json
{
  "name": "@briansunter/mankey-mcp",
  "version": "1.0.0",
  "description": "MCP server for Anki integration",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "bin": {
    "mankey": "dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/briansunter/mankey.git"
  },
  "scripts": {
    "build": "tsc && chmod +x dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "bun test",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 13. Security and Best Practices

### Never Commit Secrets

✗ Don't commit:
- `.env` files with real tokens
- API keys or passwords
- Private tokens

✓ Do:
- Create `.env.example` with placeholder values
- Use environment variables at runtime
- Document required env vars in README

### Pre-commit Hooks (Husky)

The project uses husky for git hooks:
```bash
npm run prepare    # Install git hooks
```

Hooks can validate:
- Code format before commit
- Types before commit
- Tests before push

### Rate Limiting

The bulk operations tool includes configurable delays:
```typescript
delayMs: z.number().min(100).max(5000).default(500)
```

This prevents overwhelming APIs with rapid requests.

---

## 14. Files to Create/Modify for Mankey-MCP

Based on the raindrop-mcp reference:

1. **Update package.json**
   - Add `"type": "module"`
   - Add `"bin"` field
   - Add `"types"` field
   - Add `"files"` array
   - Add `"publishConfig"`
   - Update build script to include `chmod +x`
   - Add `"prepublishOnly"`

2. **Update src/index.ts**
   - Add shebang at very first line
   - Export utilities for testing
   - Proper error handling and exit codes

3. **Create .releaserc.json**
   - Setup semantic-release configuration

4. **Create .github/workflows/**
   - commit-lint.yml
   - release.yml
   - publish.yml (optional)

5. **Create/Update .npmignore**
   - Exclude src/, tests/, docs/
   - Include only dist/, README.md, LICENSE

6. **Update tsconfig.json**
   - Set `"module": "ESNext"`
   - Set `"declaration": true`
   - Set `"sourceMap": true`

---

## Summary

The raindrop-mcp project demonstrates a production-ready MCP package with:

- Modern ES Module support
- Automated semantic versioning
- Comprehensive CI/CD pipeline
- Type-safe Zod validation
- Thorough test coverage
- Multiple installation options (npx, global, local)
- Security-conscious environment variable handling
- Clear developer documentation

All these patterns are directly applicable to mankey-mcp for proper npm publishing and distribution.

