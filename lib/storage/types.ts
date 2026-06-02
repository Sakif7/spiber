export interface PutInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

/** Pluggable object storage. R2 (S3-compatible) in prod; local disk in dev. */
export interface Storage {
  readonly name: string;
  put(input: PutInput): Promise<{ url: string }>;
}
