import mongoose from "mongoose";

/**
 * Cached Mongoose connection (single source of truth for DB access).
 *
 * The connection promise is memoised on `globalThis` so Next.js HMR in dev and
 * the standalone server in prod reuse one pooled connection instead of opening
 * a new one per module reload / request.
 *
 * Callers should treat a thrown error as "DB unavailable" and fall back to
 * static content where the spec calls for graceful degradation.
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "spiber";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__mongoose ?? {
  conn: null,
  promise: null,
};
globalThis.__mongoose = cache;

/** Whether a connection string is configured at all. */
export function isDbConfigured(): boolean {
  return Boolean(MONGODB_URI);
}

/** Connect (or reuse the cached connection). Throws if unavailable. */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 3000,
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset so a later request can retry a transient failure.
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
