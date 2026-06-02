import type { VideoProvider } from "./types";
import { createStreamVideoProvider } from "./stream.provider";
import { createLocalVideoProvider } from "./local.provider";
import { logger } from "@/lib/log";

export type { VideoProvider } from "./types";

let cached: VideoProvider | null = null;

function streamConfigured(): boolean {
  return Boolean(
    process.env.CF_STREAM_ACCOUNT_ID && process.env.CF_STREAM_API_TOKEN,
  );
}

/** Cloudflare Stream when configured, else the local/R2 file fallback. */
export function getVideoProvider(): VideoProvider {
  if (cached) return cached;
  if (streamConfigured()) {
    cached = createStreamVideoProvider();
  } else {
    logger.warn(
      "Cloudflare Stream not configured — using local video fallback (dev only)",
    );
    cached = createLocalVideoProvider();
  }
  return cached;
}
