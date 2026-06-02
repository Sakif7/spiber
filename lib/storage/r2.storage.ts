import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Storage } from "./types";

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
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  return {
    name: "r2",
    async put({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { url: `${base}/${key}` };
    },
  };
}
