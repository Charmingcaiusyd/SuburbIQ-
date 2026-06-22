import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireAdmin } from "@/server/auth/guards";
import { adminActor, getAdminUserProfile } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (!auth.user) return auth.response;

  try {
    return apiOk({
      user: await getAdminUserProfile({
        userId: context.params.id,
        actor: adminActor(auth.user),
        ipAddress: request.headers.get("x-forwarded-for")
      })
    });
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
