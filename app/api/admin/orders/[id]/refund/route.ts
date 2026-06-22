import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireAdmin } from "@/server/auth/guards";
import { adminActor, reasonSchema, refundOrder } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (!auth.user) return auth.response;

  const parsed = reasonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Refund reason is required.", 422, parsed.error.flatten());
  }

  try {
    return apiOk(await refundOrder({
      orderId: context.params.id,
      actor: adminActor(auth.user),
      reason: parsed.data.reason
    }));
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
