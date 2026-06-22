import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { getUserSubscriptionSummary } from "@/server/services/entitlement-service";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  return apiOk(await getUserSubscriptionSummary(auth.user.id));
}
