import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  process.env.MONGODB_DB = "test";
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mem?.stop();
});

import { connectToDatabase } from "@/lib/db/connect";
import { BlogPost } from "@/lib/models/blogPost";
import { savePost } from "@/lib/services/blog.service";
import {
  listPublishedPosts,
  getPublishedPostBySlug,
} from "@/lib/repositories/blog.repo";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { readingTimeMin } from "@/lib/reading-time";

const rid = () => Math.random().toString(36).slice(2, 9);
const author = () => new mongoose.Types.ObjectId().toString();

function post(extra: Record<string, unknown> = {}) {
  return {
    title: { en: `Post ${rid()}` },
    body: { en: "<p>Hello world, this is the body.</p>" },
    tagIds: [],
    status: "draft" as const,
    ...extra,
  };
}

beforeEach(async () => {
  await connectToDatabase();
  await BlogPost.deleteMany({});
  // Ensure the unique slug index exists (autoIndex builds lazily in-memory).
  await BlogPost.syncIndexes();
});

describe("sanitize + reading time (pure)", () => {
  it("strips scripts and disallowed tags", () => {
    const out = sanitizeRichHtml(
      '<p>ok</p><script>alert(1)</script><iframe src="x"></iframe>',
    );
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("iframe");
  });
  it("estimates reading time at >=1 minute", () => {
    expect(readingTimeMin("<p>one two three</p>")).toBe(1);
    const long = "<p>" + "word ".repeat(600) + "</p>";
    expect(readingTimeMin(long)).toBe(3);
  });
});

describe("blog publish-on-read", () => {
  it("draft is saved but not publicly visible", async () => {
    const r = await savePost({
      input: post({ status: "draft" }),
      authorId: author(),
    });
    expect(r.ok).toBe(true);
    const { total } = await listPublishedPosts();
    expect(total).toBe(0);
  });

  it("published post is visible and gets a publishedAt", async () => {
    const r = await savePost({
      input: post({ status: "published" }),
      authorId: author(),
    });
    if (!r.ok) throw new Error("save failed");
    const fetched = await getPublishedPostBySlug(r.slug);
    expect(fetched).toBeTruthy();
    expect(fetched?.publishedAt).toBeTruthy();
    expect(fetched?.readingTimeMin).toBeGreaterThanOrEqual(1);
  });

  it("a future scheduled post is hidden; a past one is visible", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    await savePost({
      input: post({ status: "scheduled", scheduledFor: future }),
      authorId: author(),
    });
    const afterFuture = await listPublishedPosts();
    expect(afterFuture.total).toBe(0);

    await savePost({
      input: post({ status: "scheduled", scheduledFor: past }),
      authorId: author(),
    });
    const afterPast = await listPublishedPosts();
    expect(afterPast.total).toBe(1);
  });

  it("derives an excerpt from the body when none is given", async () => {
    const r = await savePost({
      input: post({
        status: "published",
        body: { en: "<h1>Title</h1><p>Some readable content here.</p>" },
      }),
      authorId: author(),
    });
    if (!r.ok) throw new Error("save failed");
    const fetched = await getPublishedPostBySlug(r.slug);
    expect(fetched?.excerpt?.en).toContain("Some readable content");
  });

  it("rejects a duplicate slug", async () => {
    const a = await savePost({
      input: post({ slug: "fixed-slug", status: "published" }),
      authorId: author(),
    });
    expect(a.ok).toBe(true);
    const b = await savePost({
      input: post({ slug: "fixed-slug", status: "published" }),
      authorId: author(),
    });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.code).toBe("duplicate");
  });
});
