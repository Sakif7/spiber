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
  } else {
    logger.warn("R2 not configured — using local-disk storage (dev only)");
    cached = createLocalStorage();
  }
  return cached;
}
