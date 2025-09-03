# Anki MCP Server

A Model Context Protocol (MCP) server for Anki, providing seamless integration with Anki via the Anki-Connect plugin.

## Features

This MCP server exposes all major Anki-Connect API actions as MCP tools, organized by category:

### 📇 Card Actions
- Get/set ease factors
- Suspend/unsuspend cards
- Find cards by query
- Get detailed card information
- Forget/relearn cards
- Answer cards programmatically

### 📚 Deck Actions
- List all decks
- Create/delete decks
- Get deck configuration and statistics
- Manage deck settings

### 📝 Note Actions
- Add single or multiple notes
- Update existing notes
- Delete notes
- Find notes by query
- Manage tags

### 🎨 Model Actions
- List note types/models
- Create custom note types
- Manage fields and templates
- Customize card styling

### 🖼️ Media Actions
- Store media files
- Retrieve media files
- List media files
- Delete media files

### 📊 Statistics Actions
- Get review statistics
- Track daily progress
- Export collection statistics

### 🖥️ GUI Actions
- Open browser with queries
- Add cards with preset values
- Control review session
- Navigate Anki interface

## Prerequisites

1. **Anki** - Install from [apps.ankiweb.net](https://apps.ankiweb.net/)
2. **Anki-Connect Plugin** - Install via Anki:
   - Open Anki
   - Go to Tools → Add-ons → Get Add-ons...
   - Enter code: `2055492159`
   - Restart Anki
3. **Bun** - Install from [bun.sh](https://bun.sh)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd anky

# Install dependencies
bun install
```

## Usage

### Running the MCP Server

```bash
# Start the server
bun run src/index.ts

# Or use the npm script
bun start
```

### Testing

```bash
# Test Anki-Connect connectivity
bun test-anki-connect.ts

# Test MCP server directly
bun test-mcp-server.ts

# Run MCP protocol tests
bun test-mcp-server.ts mcp
```

### Configuration for MCP Clients

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "anki": {
      "command": "bun",
      "args": ["run", "/path/to/anky/src/index.ts"],
      "env": {
        "ANKI_CONNECT_URL": "http://127.0.0.1:8765"
      }
    }
  }
}
```

## Example Tool Usage

### Add a new note
```json
{
  "tool": "addNote",
  "arguments": {
    "note": {
      "deckName": "Default",
      "modelName": "Basic",
      "fields": {
        "Front": "What is MCP?",
        "Back": "Model Context Protocol - A standard for AI-application integration"
      },
      "tags": ["technology", "ai"]
    }
  }
}
```

### Find cards in a deck
```json
{
  "tool": "findCards",
  "arguments": {
    "query": "deck:\"My Deck\" is:due"
  }
}
```

### Get deck statistics
```json
{
  "tool": "getDeckStats",
  "arguments": {
    "decks": ["Default", "Languages"]
  }
}
```

## Environment Variables

- `ANKI_CONNECT_URL` - URL for Anki-Connect (default: `http://127.0.0.1:8765`)

## Troubleshooting

### Cannot connect to Anki-Connect
1. Ensure Anki is running
2. Check Anki-Connect is installed (Tools → Add-ons)
3. Verify Anki-Connect is enabled
4. Check firewall isn't blocking port 8765

### Permission errors
- On first use, Anki-Connect may show a permission dialog
- Accept to allow the connection

### macOS App Nap issues
If Anki-Connect stops working when Anki is in background:
```bash
defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
defaults write net.ichi2.anki NSAppSleepDisabled -bool true
defaults write org.qt-project.Qt.QtWebEngineCore NSAppSleepDisabled -bool true
```

## Development

### Project Structure
```
anky/
├── src/
│   └── index.ts        # Main MCP server implementation
├── test-anki-connect.ts # Anki-Connect API tests
├── test-mcp-server.ts   # MCP server tests
├── package.json         # Project configuration
└── README.md           # This file
```

### Adding New Tools

To add a new tool, edit `src/index.ts` and add to the `toolDefinitions` object:

```typescript
newTool: {
  description: "Description of what the tool does",
  inputSchema: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional(),
  }),
}
```

The tool name should match the Anki-Connect API action name.

## API Reference

For complete Anki-Connect API documentation, see:
- [Anki-Connect Documentation](https://github.com/FooSoft/anki-connect)
- [Anki Manual](https://docs.ankiweb.net/)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues related to:
- **This MCP server**: Open an issue in this repository
- **Anki-Connect**: Visit [github.com/FooSoft/anki-connect](https://github.com/FooSoft/anki-connect)
- **Anki**: Visit [forums.ankiweb.net](https://forums.ankiweb.net)

---

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
