import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireAdmin } from "@/server/auth/guards";
import { adminActor, extendSubscription, subscriptionExtendSchema } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (!auth.user) return auth.response;

  const parsed = subscriptionExtendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Extension days and reason are required.", 422, parsed.error.flatten());
  }

  try {
    return apiOk(await extendSubscription({
      subscriptionId: context.params.id,
      actor: adminActor(auth.user),
      days: parsed.data.days,
      reason: parsed.data.reason
    }));
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
