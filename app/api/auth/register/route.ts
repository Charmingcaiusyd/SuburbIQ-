import type { NextRequest } from "next/server";
import { apiCreated, apiError } from "@/server/api/response";
import { hashPassword } from "@/server/auth/password";
import { registerSchema } from "@/server/auth/validation";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Email and password are required. Password must be at least 8 characters.",
      422,
      parsed.error.flatten()
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: parsed.data.email
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    return apiError("VALIDATION_ERROR", "An account already exists for this email.", 422);
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "customer"
    },
    select: {
      id: true,
      email: true
    }
  });

  return apiCreated({
    user_id: user.id,
    email: user.email,
    email_verification_required: true
  });
}
