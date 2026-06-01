import { describe, it, expect } from "vitest";
import { newsletterInputSchema, contactInputSchema } from "@/lib/schemas/forms";
import { loginFormSchema } from "@/lib/schemas/user";
import { localize } from "@/lib/schemas/localized";

describe("form schemas", () => {
  it("normalizes newsletter email (trim + lowercase)", () => {
    const r = newsletterInputSchema.safeParse({ email: "  A@B.COM " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });

  it("rejects an invalid newsletter email", () => {
    expect(newsletterInputSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });

  it("requires name + message on contact", () => {
    expect(contactInputSchema.safeParse({ email: "a@b.com" }).success).toBe(
      false,
    );
    expect(
      contactInputSchema.safeParse({
        name: "A",
        email: "a@b.com",
        message: "hi",
      }).success,
    ).toBe(true);
  });

  it("validates the login form", () => {
    expect(
      loginFormSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
    expect(
      loginFormSchema.safeParse({ email: "bad", password: "x" }).success,
    ).toBe(false);
  });
});

describe("localize", () => {
  it("falls back to English when Bangla is missing", () => {
    expect(localize({ en: "Hello" }, "bn")).toBe("Hello");
    expect(localize({ en: "Hello", bn: "হ্যালো" }, "bn")).toBe("হ্যালো");
    expect(localize({ en: "Hello", bn: "হ্যালো" }, "en")).toBe("Hello");
    expect(localize(undefined, "en")).toBe("");
  });
});
