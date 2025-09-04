# Contributing to anki-mcp-server

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and releases.

### Commit Message Format

Each commit message must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)  
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, missing semicolons, etc)
- **refactor**: Code changes that neither fix bugs nor add features
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Changes to build process or auxiliary tools
- **ci**: Changes to CI/CD configuration
- **build**: Changes that affect the build system
- **revert**: Reverts a previous commit

### Breaking Changes

To indicate a breaking change (triggers major version bump), add `!` after the type/scope:

```
feat!: remove deprecated API endpoints
```

Or include `BREAKING CHANGE:` in the commit body:

```
feat: update API response format

BREAKING CHANGE: Response format has changed from array to object
```

### Examples

```bash
# Feature
git commit -m "feat: add support for bulk card creation"

# Bug fix
git commit -m "fix: resolve tag synchronization issue"

# Breaking change
git commit -m "feat!: change API authentication method"

# With scope
git commit -m "feat(api): add new endpoint for card statistics"

# With body
git commit -m "fix: resolve memory leak in card processing

The card processing function was not properly releasing resources
after batch operations completed."
```

## Automated Releases

This project uses semantic-release to automatically:

1. Analyze commits to determine version bump (major/minor/patch)
2. Generate release notes from commit messages
3. Update CHANGELOG.md
4. Create GitHub releases
5. Publish to npm

Releases are triggered automatically when commits are pushed to the main/master branch.

## Pull Request Process

1. Create a feature branch from main/master
2. Make your changes following the commit conventions
3. Ensure all tests pass: `bun test`
4. Ensure code passes linting: `bun run lint`
5. Ensure TypeScript compiles: `bun run typecheck`
6. Submit a pull request with a descriptive title following the commit convention
7. The PR will automatically trigger validation workflows

## Local Development

### Setup Commit Hooks

The project uses Husky to validate commit messages locally:

```bash
bun install  # This automatically sets up Husky
```

If you need to bypass commit hooks temporarily (not recommended):

```bash
git commit -m "your message" --no-verify
```

### Testing Your Changes

Before committing:

```bash
bun test           # Run tests
bun run typecheck  # Check TypeScript types
bun run lint       # Check code style
bun run build      # Ensure it builds
```