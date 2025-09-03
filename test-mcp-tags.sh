#!/bin/bash

# Test script for MCP server tag handling
# Run this with DEBUG=true to see debug output

echo "🧪 Testing MCP server tag handling"
echo "=================================="
echo ""

# Test 1: Create note with array tags via direct curl
echo "📌 Test 1: Direct Anki-Connect - Array tags"
curl -s localhost:8765 -X POST -d '{
  "action": "addNote",
  "version": 6,
  "params": {
    "note": {
      "deckName": "Default",
      "modelName": "Basic",
      "fields": {
        "Front": "Test Direct API",
        "Back": "Testing direct array tags"
      },
      "tags": ["direct", "api", "test"]
    }
  }
}' | jq '.'

echo ""
echo "📌 Test 2: Testing tag normalization patterns"
echo ""

# Create test data file with different tag formats
cat > /tmp/test-tags.json << 'EOF'
{
  "tests": [
    {
      "name": "Array format",
      "tags": ["test1", "test2", "test3"]
    },
    {
      "name": "JSON string format", 
      "tags": "[\"json1\", \"json2\"]"
    },
    {
      "name": "Space-separated string",
      "tags": "space separated tags"
    }
  ]
}
EOF

echo "Created test data at /tmp/test-tags.json"
echo ""

# Run a simple test to see debug output in action
echo "📌 Running test with Anki-Connect to trigger debug logs..."
echo ""

# Test updateNote with different tag formats
NOTE_ID=$(curl -s localhost:8765 -X POST -d '{
  "action": "addNote",
  "version": 6,
  "params": {
    "note": {
      "deckName": "Default",
      "modelName": "Basic",
      "fields": {
        "Front": "Debug Test Card",
        "Back": "For testing debug output"
      },
      "tags": ["initial"]
    }
  }
}' | jq -r '.result')

echo "Created test note: $NOTE_ID"

# Update with array tags
echo "Updating with array tags..."
curl -s localhost:8765 -X POST -d "{
  \"action\": \"updateNote\",
  \"version\": 6,
  \"params\": {
    \"note\": {
      \"id\": $NOTE_ID,
      \"tags\": [\"updated\", \"array\", \"tags\"]
    }
  }
}" | jq '.'

# Get note info
echo "Getting note info..."
curl -s localhost:8765 -X POST -d "{
  \"action\": \"notesInfo\",
  \"version\": 6,
  \"params\": {
    \"notes\": [$NOTE_ID]
  }
}" | jq '.result[0].tags'

# Clean up
curl -s localhost:8765 -X POST -d "{
  \"action\": \"deleteNotes\",
  \"version\": 6,
  \"params\": {
    \"notes\": [$NOTE_ID]
  }
}" > /dev/null

echo ""
echo "✅ Test completed! Check /tmp/anki-mcp-debug.log for debug output"
echo ""
echo "To see debug output in real-time:"
echo "  tail -f /tmp/anki-mcp-debug.log"