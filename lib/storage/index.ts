import type { Storage } from "./types";
import { createR2Storage } from "./r2.storage";
import { createLocalStorage } from "./local.storage";
import { logger } from "@/lib/log";

export type { Storage } from "./types";

let cached: Storage | null = null;

function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
  );
}

export function getStorage(): Storage {
  if (cached) return cached;
  if (r2Configured()) {
    cached = createR2Storage();
    return cached;
  }
  // The local-disk fallback writes under public/uploads — fine for dev, but in
  // production the standalone container's filesystem is ephemeral, so uploads
  // would silently vanish on the next redeploy (and never reach a CDN). Fail
  // loudly at first use instead of silently degrading. Self-hosters with a
  // persistent volume can opt in with ALLOW_LOCAL_STORAGE=true.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_STORAGE !== "true"
  ) {
    throw new Error(
      "Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY and R2_BUCKET (the local-disk fallback is dev-only). " +
        "To intentionally use disk storage in production, set ALLOW_LOCAL_STORAGE=true.",
    );
  }
  logger.warn("R2 not configured — using local-disk storage (dev only)");
  cached = createLocalStorage();
  return cached;
}
