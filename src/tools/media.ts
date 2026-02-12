import { z } from "zod";
import { ankiConnect } from "../shared/anki-connect.js";
import type { ToolDef } from "../shared/types.js";

export const mediaTools = {
  storeMediaFile: {
    description:
      "Stores a media file in Anki's media folder. REQUIRES one of: data (base64), path, or url. Media is automatically synced to AnkiWeb. Supported formats: images (jpg, png, gif, svg), audio (mp3, ogg, wav), video (mp4, webm). File is available immediately for use in cards with HTML tags like <img> or [sound:]. Example with base64: {filename: 'test.txt', data: 'SGVsbG8gV29ybGQ='}. Returns filename on success",
    schema: z.object({
      filename: z.string().describe("File name"),
      data: z.string().optional().describe("Base64-encoded file content"),
      url: z.string().optional().describe("URL to download from"),
      path: z.string().optional().describe("Local file path to read from"),
      deleteExisting: z.boolean().optional().default(true).describe("Replace if file exists"),
    }),
    handler: async (args: {
      filename: string;
      data?: string;
      url?: string;
      path?: string;
      deleteExisting?: boolean;
    }) => {
      // Validate that at least one data source is provided
      if (!args.data && !args.url && !args.path) {
        throw new Error("storeMediaFile requires one of: data (base64), url, or path");
      }
      return ankiConnect("storeMediaFile", args);
    },
  },

  retrieveMediaFile: {
    description:
      "Retrieves a media file from Anki's collection as base64-encoded data. Specify just the filename (not full path). Returns false if file doesn't exist. Useful for backing up media or transferring between collections. Large files may take time to encode",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }: { filename: string }) => ankiConnect("retrieveMediaFile", { filename }),
  },

  getMediaFilesNames: {
    description:
      "Lists all media files in the collection including images, audio, and video files. Pattern supports wildcards (* and ?). Returns paginated array of filenames (not paths). Useful for media management, finding unused files, or bulk operations",
    schema: z.object({
      pattern: z.string().optional().describe("File pattern"),
      offset: z.number().optional().default(0).describe("Starting position for pagination"),
      limit: z.number().optional().default(100).describe("Maximum files to return (default 100, max 1000)"),
    }),
    handler: async ({ pattern, offset = 0, limit = 100 }: { pattern?: string; offset?: number; limit?: number }) => {
      const clampedLimit = Math.min(limit, 1000);
      const allFiles: string[] = await ankiConnect("getMediaFilesNames", { pattern });
      const total = allFiles.length;
      const files = allFiles.slice(offset, offset + clampedLimit);
      const hasMore = offset + clampedLimit < total;
      return {
        files,
        pagination: {
          offset,
          limit: clampedLimit,
          total,
          hasMore,
          nextOffset: hasMore ? offset + clampedLimit : null,
        },
      };
    },
  },

  deleteMediaFile: {
    description:
      "Permanently deletes a media file from the collection. CAUTION: Cannot be undone. File is removed immediately and will be deleted from AnkiWeb on next sync. Cards referencing the file will show broken media. Consider checking usage with findNotes before deletion",
    schema: z.object({
      filename: z.string().describe("File name"),
    }),
    handler: async ({ filename }: { filename: string }) => ankiConnect("deleteMediaFile", { filename }),
  },

  getMediaDirPath: {
    description:
      "Gets absolute filesystem path to Anki's media folder where images, audio, and video files are stored. Path varies by OS and profile. Useful for direct media file operations or backup scripts. Typically: ~/Anki2/ProfileName/collection.media/",
    schema: z.object({}),
    handler: async () => ankiConnect("getMediaDirPath"),
  },
} satisfies Record<string, ToolDef>;
