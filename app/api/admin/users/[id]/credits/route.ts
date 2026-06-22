import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireAdmin } from "@/server/auth/guards";
import { addUserCredits, adminActor, creditAdjustSchema } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (!auth.user) return auth.response;

  const parsed = creditAdjustSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Credit quantity and reason are required.", 422, parsed.error.flatten());
  }

  try {
    return apiOk(await addUserCredits({
      userId: context.params.id,
      actor: adminActor(auth.user),
      quantity: parsed.data.quantity,
      reason: parsed.data.reason
    }));
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
