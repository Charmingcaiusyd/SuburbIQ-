import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { applyPaymentWebhook, toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function POST(request: NextRequest) {
  if (request.headers.get("x-webhook-test-signature") === "invalid") {
    return apiError("FORBIDDEN", "PayPal webhook signature verification failed.", 403);
  }

  try {
    return apiOk(
      await applyPaymentWebhook({
        provider: "paypal",
        body: await request.json().catch(() => null)
      })
    );
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
