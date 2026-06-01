import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/auth/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const key = "unit-test-key-a";
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    expect(rateLimit("unit-test-key-b", 1, 10_000).ok).toBe(true);
    expect(rateLimit("unit-test-key-b", 1, 10_000).ok).toBe(false);
    expect(rateLimit("unit-test-key-c", 1, 10_000).ok).toBe(true);
  });
});
