import type { NextRequest } from "next/server";
import type { UserRole } from "@/domain/enums";
import { apiError, apiOk } from "@/server/api/response";
import { serializeUser } from "@/server/auth/current-user";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from "@/server/auth/token";
import { loginSchema } from "@/server/auth/validation";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Valid email and password are required.", 422);
  }

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.data.email
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      deletedAt: true
    }
  });

  if (
    !user ||
    user.deletedAt ||
    user.status !== "active" ||
    !(await verifyPassword(parsed.data.password, user.passwordHash))
  ) {
    return apiError("AUTH_REQUIRED", "Invalid email or password.", 401);
  }

  const accessToken = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole
  });
  const response = apiOk({
    access_token: accessToken,
    user: serializeUser(user)
  });

  response.cookies.set(AUTH_COOKIE_NAME, accessToken, getAuthCookieOptions());

  return response;
}
