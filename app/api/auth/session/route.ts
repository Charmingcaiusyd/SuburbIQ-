import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { getCurrentUser, serializeUser } from "@/server/auth/current-user";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  return apiOk({
    authenticated: Boolean(user),
    user: user ? serializeUser(user) : null
  });
}
