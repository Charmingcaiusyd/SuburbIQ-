import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/domain/enums";

export const AUTH_COOKIE_NAME = "spd_session";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

function getAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  if (!secret || secret === "replace-with-local-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be configured.");
    }

    return "development-only-secret-change-me";
  }

  return secret;
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(input: string) {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

function sign(unsignedToken: string) {
  return base64UrlEncode(
    createHmac("sha256", getAuthSecret()).update(unsignedToken).digest()
  );
}

export function createSessionToken(input: {
  userId: string;
  email: string;
  role: UserRole;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload: SessionTokenPayload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;

  if (!header || !payload || !signature) {
    return null;
  }

  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = sign(unsignedToken);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload).toString("utf-8")) as
      | SessionTokenPayload
      | undefined;

    if (!decoded?.sub || !decoded.email || !decoded.role || decoded.exp < Date.now() / 1000) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS
  };
}
