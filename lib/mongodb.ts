import { MongoClient, type Db } from "mongodb";

/**
 * Cached MongoDB client.
 *
 * - In dev, Next.js hot-reload would otherwise spawn a new client every
 *   reload. We attach the client to `globalThis` so it survives HMR.
 * - In prod, the module is loaded once per process so a top-level
 *   variable is enough.
 *
 * Returns null when `MONGODB_URI` is not configured — callers must handle
 * the null case and fall back to static data so the page still renders.
 */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spiber";

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __mongo: MongoCache | undefined;
}

const cache: MongoCache = globalThis.__mongo ?? { client: null, promise: null };
if (process.env.NODE_ENV !== "production") globalThis.__mongo = cache;

export async function getDb(): Promise<Db | null> {
  if (!uri) return null;
  if (!cache.client) {
    if (!cache.promise) {
      cache.promise = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
      }).connect();
    }
    try {
      cache.client = await cache.promise;
    } catch {
      cache.promise = null;
      return null;
    }
  }
  return cache.client.db(dbName);
}
