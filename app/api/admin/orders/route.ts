import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { requireAdmin } from "@/server/auth/guards";
import { listAdminOrders } from "@/server/services/admin-service";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.user) return auth.response;

  return apiOk({ orders: await listAdminOrders() });
}
