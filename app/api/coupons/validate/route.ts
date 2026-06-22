import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import {
  couponValidateSchema,
  validateCoupon
} from "@/server/services/commerce-service";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const parsed = couponValidateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Coupon validation request is invalid.",
      422,
      parsed.error.flatten()
    );
  }

  return apiOk(
    await validateCoupon({
      code: parsed.data.code,
      productId: parsed.data.product_id ?? parsed.data.productId,
      amountCents: parsed.data.amount_cents ?? parsed.data.amountCents
    })
  );
}
