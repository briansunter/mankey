import { ANKI_CONNECT_VERSION, getAnkiConnectUrl } from "./config.js";
import type { AnkiConnectResponses } from "./types.js";

// Custom error class for Anki-Connect errors (replaces McpError dependency)
export class AnkiConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnkiConnectError";
  }
}

// Anki-Connect API helper with improved error handling
export async function ankiConnect<T extends keyof AnkiConnectResponses>(
  action: T,
  params?: Record<string, unknown>,
): Promise<AnkiConnectResponses[T]>;
export async function ankiConnect(action: string, params?: Record<string, unknown>): Promise<unknown>;
export async function ankiConnect(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  try {
    const response = await fetch(getAnkiConnectUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
    });

    const data = (await response.json()) as { error?: string; result?: unknown };
    if (data.error) {
      // Clean up nested error messages and provide helpful context
      const cleanError = data.error.replace(/^Anki-Connect: /, "");

      // Provide more helpful messages for common errors
      let errorMessage = `${action}: ${cleanError}`;

      if (cleanError.includes("duplicate")) {
        errorMessage = `${action}: Note already exists with this content. ${cleanError.includes("allowDuplicate") ? "Set allowDuplicate:true to bypass this check." : "Use allowDuplicate parameter or modify the note content."}`;
      } else if (cleanError.includes("deck") && cleanError.includes("not found")) {
        errorMessage = `${action}: Deck not found. Create the deck first or check the deck name spelling.`;
      } else if (cleanError.includes("model") && cleanError.includes("not found")) {
        errorMessage = `${action}: Note type (model) not found. Check the modelName parameter.`;
      } else if (cleanError.includes("field")) {
        errorMessage = `${action}: Field error - ${cleanError}. Check that field names match the note type exactly (case-sensitive).`;
      }

      throw new AnkiConnectError(errorMessage);
    }
    return data.result;
  } catch (error: unknown) {
    // Only catch network errors or JSON parse errors here
    if (error instanceof AnkiConnectError) {
      throw error; // Re-throw AnkiConnectError as-is
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new AnkiConnectError(`Anki-Connect connection error: ${errorMessage}`);
  }
}
