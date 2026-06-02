import { writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import type { Storage } from "./types";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

function guessType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/**
 * Dev fallback: writes to public/uploads and serves at /uploads/<key>.
 * Not for production (the standalone container's filesystem is ephemeral) —
 * configure R2 in prod. `getObject` reads back with Range support so the gated
 * media route behaves the same locally as on R2.
 */
export function createLocalStorage(): Storage {
  const root = path.join(process.cwd(), "public", "uploads");
  return {
    name: "local",
    async put({ key, body }) {
      const dest = path.join(root, key);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, body);
      return { url: `/uploads/${key}` };
    },
    async getObject({ key, range }) {
      const filePath = path.join(root, key);
      let size: number;
      try {
        size = (await stat(filePath)).size;
      } catch {
        return null;
      }
      const contentType = guessType(key);
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
        if (Number.isNaN(start) || start < 0) start = 0;
        if (Number.isNaN(end) || end >= size) end = size - 1;
        const stream = createReadStream(filePath, { start, end });
        return {
          body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
          contentType,
          contentLength: end - start + 1,
          contentRange: `bytes ${start}-${end}/${size}`,
          status: 206,
        };
      }
      const stream = createReadStream(filePath);
      return {
        body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        contentType,
        contentLength: size,
        status: 200,
      };
    },
  };
}
