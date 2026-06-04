import { getStorage } from "@/lib/storage";
import type { VideoProvider } from "./types";

/**
 * Dev/no-Stream fallback: store the uploaded video via the object-storage seam
 * (R2 in prod, local disk in dev) and play it as a plain file. The stored URL
 * IS the `uid` (opaque to callers), so no reconstruction is needed later.
 */
export function createLocalVideoProvider(): VideoProvider {
  return {
    name: "local",
    playbackKind: "file",
    async upload({ body, contentType, filename }) {
      const ext = filename.includes(".")
        ? filename
            .split(".")
            .pop()!
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
        : "mp4";
      const rand = Math.random().toString(36).slice(2, 10);
      const key = `academy/videos/${Date.now()}-${rand}.${ext}`;
      // Private: lesson media must never be a public URL (gated /api/media only).
      await getStorage().put({ key, body, contentType, private: true });
      // The uid is the storage key; playback goes through the gated /api/media
      // route (the object is never exposed as a public URL).
      return { uid: key, status: "ready" };
    },
    async getStatus() {
      return { status: "ready" };
    },
    // File-kind playback is served by the gated /api/media route (which holds
    // the course/lesson context needed for the enrollment check), so the
    // player builds that URL directly rather than calling this.
    async getPlaybackUrl() {
      return null;
    },
    async delete() {
      // Local/R2 cleanup is best-effort and not implemented; objects are
      // overwritten/garbage-collected out of band.
    },
  };
}
