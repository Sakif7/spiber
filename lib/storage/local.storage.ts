import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./types";

/**
 * Dev fallback: writes to public/uploads and serves at /uploads/<key>.
 * Not for production (the standalone container's filesystem is ephemeral) —
 * configure R2 in prod.
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
  };
}
