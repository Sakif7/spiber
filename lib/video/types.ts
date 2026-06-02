import type { VideoStatus } from "@/lib/schemas/academy";

export type VideoUploadResult = {
  /** Provider-opaque identifier stored on the lesson as `videoUid`. */
  uid: string;
  status: VideoStatus;
  durationSec?: number;
};

export type VideoStatusResult = {
  status: VideoStatus;
  durationSec?: number;
};

/**
 * Pluggable video backend. Cloudflare Stream (signed adaptive playback) when
 * `CF_STREAM_*` is set; otherwise a local/R2 fallback that stores the file via
 * the object-storage seam and plays it as a plain file. `videoUid` is opaque
 * to the rest of the app — only the provider interprets it.
 */
export interface VideoProvider {
  readonly name: "stream" | "local";
  /** Whether playback is HLS via the Stream player (`stream`) or a plain file (`local`). */
  readonly playbackKind: "stream" | "file";
  upload(input: {
    body: Buffer;
    contentType: string;
    filename: string;
  }): Promise<VideoUploadResult>;
  getStatus(uid: string): Promise<VideoStatusResult>;
  /** A ready-to-play URL (signed HLS manifest for Stream, file URL for local). */
  getPlaybackUrl(uid: string): Promise<string | null>;
  delete(uid: string): Promise<void>;
}
