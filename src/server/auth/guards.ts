import type { NextRequest } from "next/server";
import { apiError } from "@/server/api/response";
import { getCurrentUser } from "./current-user";

export async function requireUser(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      user: null,
      response: apiError("AUTH_REQUIRED", "You must log in to continue.", 401)
    };
  }

  return {
    user,
    response: null
  };
}

export async function requireAdmin(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth;
  }

  if (auth.user.role !== "admin" && auth.user.role !== "super_admin") {
    return {
      user: null,
      response: apiError("FORBIDDEN", "Admin access is required.", 403)
    };
  }

  return auth;
}

export async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth;
  }

  if (auth.user.role !== "super_admin") {
    return {
      user: null,
      response: apiError("FORBIDDEN", "Super Admin access is required.", 403)
    };
  }

  return auth;
}
