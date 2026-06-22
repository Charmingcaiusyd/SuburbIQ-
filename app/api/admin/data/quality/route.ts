import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { requireSuperAdmin } from "@/server/auth/guards";
import { getDataQualityDashboard } from "@/server/services/admin-service";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.user) return auth.response;

  return apiOk(await getDataQualityDashboard(
    request.nextUrl.searchParams.get("city") ?? "Sydney"
  ));
}
