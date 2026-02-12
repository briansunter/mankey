import { debug } from "./config.js";

// Utility function to normalize tags from various formats
export function normalizeTags(tags: unknown): string[] {
  debug("normalizeTags input:", tags);

  // Already an array - return as is
  if (Array.isArray(tags)) {
    debug("Tags already array");
    return tags;
  }

  // String that might be JSON or space-separated
  if (typeof tags === "string") {
    // Try parsing as JSON array
    if (tags.startsWith("[")) {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          debug("Parsed tags from JSON:", parsed);
          return parsed;
        }
      } catch {
        debug("Failed to parse JSON tags, using space-split");
      }
    }

    // Fall back to space-separated
    const split = tags.split(" ").filter((t) => t.trim());
    debug("Split tags by space:", split);
    return split;
  }

  debug("Unknown tag format, returning empty array");
  return [];
}

// Utility to normalize fields from various formats
export function normalizeFields(fields: unknown): object | undefined {
  debug("normalizeFields input:", fields);

  if (!fields) {
    return undefined;
  }

  // Already an object
  if (typeof fields === "object" && !Array.isArray(fields)) {
    debug("Fields already object");
    return fields;
  }

  // String that might be JSON
  if (typeof fields === "string") {
    try {
      const parsed = JSON.parse(fields);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        debug("Parsed fields from JSON:", parsed);
        return parsed;
      }
    } catch {
      debug("Failed to parse JSON fields");
    }
  }

  debug("Unknown fields format, returning undefined");
  return undefined;
}

// Helper for base64 encoding (for media operations)
export function _encodeBase64(data: string | Buffer): string {
  if (typeof data === "string") {
    return Buffer.from(data).toString("base64");
  }
  return data.toString("base64");
}
