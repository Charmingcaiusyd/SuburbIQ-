import type { NextRequest } from "next/server";
import { apiCreated, apiError } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { createPaidReportJob } from "@/server/services/report-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  try {
    const result = await createPaidReportJob({
      userId: auth.user.id,
      body: await request.json().catch(() => null)
    });

    return apiCreated(result);
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
