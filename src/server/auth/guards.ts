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
