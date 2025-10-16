# Mankey-MCP vs Raindrop-MCP: Configuration Comparison

## Current Mankey Configuration Status

### What Mankey Already Has Right

1. Modern tooling setup
   - Using Bun as runtime
   - TypeScript with strict mode
   - ESLint configuration
   - Semantic release configured
   - Husky for git hooks

2. Repository structure
   - Organized src/ directory
   - Tests in tests/ directory
   - Multiple test files
   - Proper .gitignore

3. Package.json basics
   - "type": "module" - GOOD
   - "main": "dist/index.js" - GOOD
   - Bin field present - GOOD
   - Version tracking - GOOD

### Key Gaps Compared to Raindrop-MCP

1. **Package.json Issues**
   - Missing "types" field - should point to dist/index.d.ts
   - Missing "files" array - won't limit what's published to npm
   - Missing "publishConfig" - should specify "access": "public"
   - "module" field instead of main - unclear setup
   - Build script missing chmod +x

2. **Entry Point Issues**
   - src/index.ts might be missing shebang (`#!/usr/bin/env node`)
   - May not export utilities for testing
   - Ensure proper error handling and exit codes

3. **Build Configuration**
   - tsconfig.json may need:
     - "module": "ESNext" instead of current setting
     - "declaration": true
     - "declarationMap": true
     - "sourceMap": true

4. **CI/CD Pipeline**
   - release.yml workflow exists but verify it's properly configured
   - May be missing commit-lint.yml workflow
   - May be missing publish.yml workflow

5. **Publishing Setup**
   - .releaserc.json might need tweaks
   - NPM_TOKEN secret setup needed
   - .npmignore file might not exist

---

## Side-by-Side Configuration Changes

### Package.json Updates

**Current Mankey:**
```json
{
  "name": "mankey",
  "module": "src/index.ts",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mankey": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**Should Be (Raindrop Pattern):**
```json
{
  "name": "@briansunter/mankey-mcp",
  "version": "1.0.0",
  "description": "MCP server for Anki integration via Anki-Connect",
  "main": "dist/index.js",           // Remove "module" field (confusing)
  "types": "dist/index.d.ts",        // ADD THIS
  "type": "module",
  "bin": {
    "mankey": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {                 // ADD THIS
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/briansunter/mankey.git"
  },
  "scripts": {
    "build": "tsc && chmod +x dist/index.js",  // UPDATE: Add chmod
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"           // ADD THIS
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Changes to Make

1. Remove "module" field (unclear, not needed with "type": "module")
2. Add "types" pointing to dist/index.d.ts
3. Add "publishConfig" with access: public
4. Update build script: `"build": "tsc && chmod +x dist/index.js"`
5. Add prepublishOnly hook
6. Verify "name" is scoped: @briansunter/mankey-mcp
7. Add "engines" requirement

---

### TypeScript Configuration (tsconfig.json)

**Current Mankey** (unknown - need to verify):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",         // Good
    // ... other options
  }
}
```

**Should Match Raindrop Pattern:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",             // Preserve ES modules
    "moduleResolution": "bundler",  // ADD if missing
    "lib": ["ES2020"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,            // Generate .d.ts - ENSURE THIS
    "declarationMap": true,         // Map to source - ADD if missing
    "sourceMap": true               // Enable debugging - ADD if missing
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

**Key Changes:**
- Ensure "declaration": true (generates .d.ts files)
- Add "declarationMap": true (for better debugging)
- Add "sourceMap": true (for better debugging)
- Verify "moduleResolution": "bundler"

---

### Entry Point (src/index.ts)

**Must Start With:**
```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// ... rest of code
```

**Must Include Error Handling:**
```typescript
async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Must Export for Testing:**
```typescript
export {
  // Export utility functions and classes
  // Export types if needed
};
```

---

## GitHub Workflows Setup

### Needed Workflows

#### 1. .github/workflows/commit-lint.yml
```yaml
name: Validate Commit Messages
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    name: Validate commits
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
      - run: npm install --save-dev @commitlint/cli @commitlint/config-conventional
      - run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
      - run: echo "${{ github.event.pull_request.title }}" | npx commitlint
```

#### 2. .github/workflows/release.yml
Verify the existing one includes:
- Checkout with fetch-depth: 0
- Type checking before release
- Lint before release
- Build before release
- NPM_TOKEN env var passed to semantic-release

#### 3. .github/workflows/publish.yml (optional backup)
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
        with:
          node-version: 'lts/*'
      - run: npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - if: github.event.inputs.version
        run: npm version ${{ github.event.inputs.version }} --no-git-tag-version
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Repository Configuration

### .npmignore File (Create if Missing)

```
# Source files
src/
tests/
docs/
screenshots/
scripts/

# Config files
.github/
.cursor/
.claude/
.env*
!.env.example
.husky/
.git*
tsconfig.json
eslint.config.js
commitlint.config.cjs
bunfig.toml
*.config.*
CONTRIBUTING.md

# Build artifacts to exclude
*.tsbuildinfo
*.test.js
*.test.ts
*.test.d.ts

# Node modules
node_modules/

# IDE
.vscode/
.idea/
*.swp
```

### .releaserc.json

Ensure it includes all plugins:
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

---

## GitHub Secrets Configuration

Need to set in repository settings:

1. **NPM_TOKEN**
   - Get from https://www.npmjs.com/settings/[username]/tokens
   - Create "Automation" token with publish access
   - Set as repository secret "NPM_TOKEN"

2. **GITHUB_TOKEN**
   - Usually auto-provided by GitHub
   - Verify it has permissions: contents:write, issues:write, pull-requests:write, packages:write

---

## Installation Verification

After making these changes, the package should be installable as:

```bash
# Method 1: NPX
npx @briansunter/mankey-mcp

# Method 2: Bun
bunx @briansunter/mankey-mcp

# Method 3: Global
npm install -g @briansunter/mankey-mcp
mankey

# Method 4: Claude Desktop
# In claude_desktop_config.json:
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["-y", "@briansunter/mankey-mcp"],
      "env": {
        "ANKI_CONNECT_URL": "http://localhost:8765"
      }
    }
  }
}
```

---

## Testing Configuration

Verify these in bunfig.toml:
```toml
[test]
coverage = true
coverageThreshold = 80
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
```

---

## Priority Order for Changes

1. **High Priority (Breaking/Publishing)**
   - Add "types" field to package.json
   - Add "publishConfig" to package.json
   - Update build script with chmod +x
   - Add "prepublishOnly" hook
   - Ensure shebang in src/index.ts
   - Update tsconfig.json: declaration, declarationMap, sourceMap

2. **Medium Priority (CI/CD)**
   - Create commit-lint.yml workflow
   - Verify release.yml is properly configured
   - Create .npmignore file
   - Verify .releaserc.json has all plugins

3. **Low Priority (Polish)**
   - Remove "module" field from package.json
   - Add "engines" requirement
   - Create publish.yml backup workflow
   - Setup GitHub secrets (NPM_TOKEN)

---

## Verification Checklist

Before publishing to npm:

- [ ] `npm run build` succeeds and creates dist/index.js
- [ ] `ls -la dist/index.js` shows executable (+x permissions)
- [ ] `head -1 dist/index.js` shows `#!/usr/bin/env node`
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build && npm publish --dry-run` works (dry run test)
- [ ] Package.json has all required fields
- [ ] .npmignore is properly configured
- [ ] GitHub secrets are set (NPM_TOKEN)
- [ ] Release workflows are configured
- [ ] .releaserc.json has all plugins

---

## Expected Output After Configuration

When everything is set up correctly:

1. Local development: `bun run src/index.ts` works
2. Building: `npm run build` creates executable binary
3. Testing: `npx @briansunter/mankey-mcp` works locally
4. Publishing: Push with conventional commits triggers automatic release
5. Installation: `npx @briansunter/mankey-mcp` installs and runs from npm

