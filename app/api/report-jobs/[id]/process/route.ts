import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";
import { processReportJob } from "@/server/services/report-worker-service";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const job = await prisma.reportJob.findFirst({
    where: {
      id: context.params.id,
      userId: auth.user.id
    },
    select: {
      id: true
    }
  });

  if (!job) {
    return apiError("VALIDATION_ERROR", "Report job was not found.", 404);
  }

  const body = await request.json().catch(() => ({}));

  try {
    return apiOk(
      await processReportJob(context.params.id, {
        forceLlmFailure:
          body.force_llm_failure === true || body.forceLlmFailure === true,
        forceFallbackFailure:
          body.force_fallback_failure === true ||
          body.forceFallbackFailure === true
      })
    );
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
