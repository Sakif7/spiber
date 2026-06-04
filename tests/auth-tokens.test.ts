import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signVerifyToken,
  signResetToken,
  verifyPurposeToken,
} from "@/lib/auth/tokens";

describe("auth tokens", () => {
  it("signs and verifies an access token round-trip", async () => {
    const token = await signAccessToken({
      sub: "user1",
      email: "a@b.com",
      roles: ["admin"],
    });
    const claims = await verifyAccessToken(token);
    expect(claims?.sub).toBe("user1");
    expect(claims?.email).toBe("a@b.com");
    expect(claims?.roles).toContain("admin");
  });

  it("rejects a refresh token presented as an access token", async () => {
    const refresh = await signRefreshToken("user1");
    expect(await verifyAccessToken(refresh)).toBeNull();
  });

  it("verifies refresh tokens and extracts the subject + tokenVersion", async () => {
    const refresh = await signRefreshToken("user42", 3);
    const claims = await verifyRefreshToken(refresh);
    expect(claims?.sub).toBe("user42");
    expect(claims?.tokenVersion).toBe(3);
  });

  it("enforces purpose on verify/reset tokens", async () => {
    const verify = await signVerifyToken("user1");
    const reset = await signResetToken("user1");
    expect((await verifyPurposeToken(verify, "verify"))?.sub).toBe("user1");
    expect(await verifyPurposeToken(verify, "reset")).toBeNull();
    expect((await verifyPurposeToken(reset, "reset"))?.sub).toBe("user1");
    expect(await verifyPurposeToken(reset, "verify")).toBeNull();
  });

  it("rejects a garbage token", async () => {
    expect(await verifyAccessToken("not.a.jwt")).toBeNull();
  });
});
