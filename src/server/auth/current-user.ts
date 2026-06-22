import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "./token";
import { prisma } from "@/server/db/prisma";

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice("bearer ".length).trim();
}

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? getBearerToken(request);

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
      status: "active"
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true
    }
  });

  return user;
}

export function serializeUser(user: {
  id: string;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
    created_at: user.createdAt?.toISOString()
  };
}
