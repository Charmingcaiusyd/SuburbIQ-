import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "../../src/server/auth/token";

describe("session token", () => {
  it("round trips a signed customer session", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";

    const token = createSessionToken({
      userId: "00000000-0000-4000-8000-000000000001",
      email: "buyer@example.com",
      role: "customer"
    });

    const payload = verifySessionToken(token);

    expect(payload?.sub).toBe("00000000-0000-4000-8000-000000000001");
    expect(payload?.email).toBe("buyer@example.com");
    expect(payload?.role).toBe("customer");
  });

  it("rejects tampered tokens", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";

    const token = createSessionToken({
      userId: "00000000-0000-4000-8000-000000000001",
      email: "buyer@example.com",
      role: "customer"
    });

    expect(verifySessionToken(`${token}tampered`)).toBeNull();
    expect(verifySessionToken(`${token}.extra`)).toBeNull();
  });
});
