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
  return Boolean(process.env.MONGODB_URI);
}

/** Connect (or reuse the cached connection). Throws if unavailable.
 *  Env is read lazily (at call time) so tests can set it before connecting. */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || "spiber",
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
