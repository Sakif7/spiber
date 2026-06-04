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
 * Resolve `key` inside `root`, rejecting any path that escapes it (e.g. a key
 * containing `..`). Returns null if the key would traverse outside the root.
 */
function safeJoin(root: string, key: string): string | null {
  const dest = path.resolve(root, key);
  const rootResolved = path.resolve(root);
  if (dest !== rootResolved && !dest.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return dest;
}

/**
 * Dev/self-hosted local storage. PUBLIC objects (images) go under
 * public/uploads and are served statically at /uploads/<key>. PRIVATE objects
 * (course videos/audio/resources, software assets) go under a SEPARATE root
 * OUTSIDE public/ so they're never statically served — they're only reachable
 * through the auth-gated /api/media routes (which call getObject). In prod each
 * root must be a persistent volume (the container fs is otherwise ephemeral).
 *
 * Override the private root with PRIVATE_UPLOADS_DIR (absolute path).
 */
export function createLocalStorage(): Storage {
  const publicRoot = path.join(process.cwd(), "public", "uploads");
  const privateRoot =
    process.env.PRIVATE_UPLOADS_DIR ||
    path.join(process.cwd(), "private-uploads");

  async function streamFile(
    filePath: string,
    key: string,
    range?: string,
  ): Promise<NonNullable<Awaited<ReturnType<Storage["getObject"]>>> | null> {
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
      // Unsatisfiable range (start past EOF or reversed): fall back to the full
      // object instead of emitting a negative Content-Length / reversed stream.
      if (start > end || start >= size) {
        const stream = createReadStream(filePath);
        return {
          body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
          contentType,
          contentLength: size,
          status: 200,
        };
      }
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
  }

  return {
    name: "local",
    async put({ key, body, private: isPrivate }) {
      const root = isPrivate ? privateRoot : publicRoot;
      const dest = safeJoin(root, key);
      if (!dest) throw new Error("invalid storage key");
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, body);
      // Private objects have no public URL — they're served via the gated route.
      return { url: isPrivate ? "" : `/uploads/${key}` };
    },
    async getObject({ key, range }) {
      // Gated media is private; try the private root first, then fall back to
      // the public root for objects written before the public/private split.
      for (const root of [privateRoot, publicRoot]) {
        const filePath = safeJoin(root, key);
        if (!filePath) continue;
        const res = await streamFile(filePath, key, range);
        if (res) return res;
      }
      return null;
    },
  };
}
