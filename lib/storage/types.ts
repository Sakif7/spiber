export interface PutInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /**
   * Private objects (course videos/audio/resources, software assets) are stored
   * OUTSIDE the statically-served public dir and are only reachable through the
   * auth-gated /api/media routes. Public objects (images/thumbnails) get a
   * directly-servable URL. Defaults to public.
   */
  private?: boolean;
}

export type GetObjectResult = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
  /** Set on a satisfied Range request (HTTP 206). */
  contentRange?: string;
  status: 200 | 206;
};

/** Pluggable object storage. R2 (S3-compatible) in prod; local disk in dev. */
export interface Storage {
  readonly name: string;
  put(input: PutInput): Promise<{ url: string }>;
  /**
   * Stream an object back, honoring an HTTP Range header (for video/audio
   * seeking). Returns null when the key doesn't exist. Used by the gated
   * media route so protected lesson media is never served as a public URL.
   */
  getObject(input: {
    key: string;
    range?: string;
    /**
     * When true, only PUBLIC objects are eligible (the public asset route is
     * un-authenticated, so it must never reach into the private/gated store).
     */
    publicOnly?: boolean;
  }): Promise<GetObjectResult | null>;
}
