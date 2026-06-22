import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/server/auth/token";
import { prisma } from "@/server/db/prisma";

export async function getCurrentPageUser() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
      status: "active"
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true
    }
  });
}

export async function requireAdminPageUser() {
  const user = await getCurrentPageUser();

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    redirect("/");
  }

  return user;
}
