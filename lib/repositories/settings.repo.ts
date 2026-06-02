import { connectToDatabase } from "@/lib/db/connect";
import { Setting } from "@/lib/models/setting";

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  await connectToDatabase();
  const doc = await Setting.findOne({ key }).lean<{ value: T }>().exec();
  return doc ? doc.value : null;
}

export async function setSetting(key: string, value: unknown) {
  await connectToDatabase();
  await Setting.updateOne(
    { key },
    { $set: { value } },
    { upsert: true },
  ).exec();
}
