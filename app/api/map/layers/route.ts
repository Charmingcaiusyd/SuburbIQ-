import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { getCurrentUser } from "@/server/auth/current-user";
import { getMapLayers, resolveUserMapEntitlement } from "@/server/services/geography-service";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser(request);
  const entitlement = await resolveUserMapEntitlement(currentUser?.id ?? null);

  return apiOk({
    entitlement,
    layers: await getMapLayers(entitlement),
    source: "database"
  });
}
