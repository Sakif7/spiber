import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Storage, GetObjectResult } from "./types";

/** Cloudflare R2 via the S3-compatible API. Uploads go through the server
 *  (admin-only, low volume) — no bucket CORS or presigning required. */
export function createR2Storage(): Storage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET!;
  // Private/gated media should live in a bucket that is NOT exposed at the public
  // base URL. Falls back to the main bucket if a dedicated one isn't configured.
  const privateBucket = process.env.R2_PRIVATE_BUCKET || bucket;
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  return {
    name: "r2",
    async put({ key, body, contentType, private: isPrivate }) {
      await client.send(
        new PutObjectCommand({
          Bucket: isPrivate ? privateBucket : bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      // Private objects are served only through the gated route (no public URL).
      return { url: isPrivate ? "" : `${base}/${key}` };
    },
    async getObject({ key, range, publicOnly }) {
      // publicOnly (un-authenticated asset route) may only read the public bucket.
      const buckets = publicOnly ? [bucket] : [privateBucket, bucket];
      for (const b of new Set(buckets)) {
        const res = await getFromBucket(b, key, range);
        if (res) return res;
      }
      return null;
    },
    async delete({ key, private: isPrivate }) {
      // Mirrors getObject: when the caller does not say, try both buckets, so a
      // key written before R2_PRIVATE_BUCKET was configured is still removed.
      const buckets =
        isPrivate === undefined
          ? [privateBucket, bucket]
          : [isPrivate ? privateBucket : bucket];
      for (const b of new Set(buckets)) {
        // S3 DELETE is idempotent: a missing key succeeds.
        await client.send(new DeleteObjectCommand({ Bucket: b, Key: key }));
      }
    },
  };

  async function getFromBucket(
    b: string,
    key: string,
    range?: string,
  ): Promise<GetObjectResult | null> {
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: b, Key: key, Range: range }),
      );
      const body = res.Body as unknown as {
        transformToWebStream?: () => ReadableStream<Uint8Array>;
      };
      if (!body?.transformToWebStream) return null;
      return {
        body: body.transformToWebStream(),
        contentType: res.ContentType ?? "application/octet-stream",
        contentLength:
          typeof res.ContentLength === "number" ? res.ContentLength : undefined,
        contentRange: res.ContentRange,
        status: res.ContentRange ? 206 : 200,
      };
    } catch {
      return null;
    }
  }
}
