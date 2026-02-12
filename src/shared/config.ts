// Configuration
let ankiConnectUrl = process.env.ANKI_CONNECT_URL || "http://127.0.0.1:8765";

export function getAnkiConnectUrl(): string {
  return ankiConnectUrl;
}

export function setAnkiConnectUrl(url: string): void {
  ankiConnectUrl = url;
}

export const ANKI_CONNECT_VERSION = 6;
export const DEBUG = process.env.DEBUG === "true";

// Debug logging helper (writes to stderr which shows in stdio)
export function debug(message: string, data?: unknown) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data) : "");
  }
}
