import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function GET(
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
    include: {
      suburb: true,
      postcode: true,
      reports: {
        include: {
          files: true
        }
      }
    }
  });

  if (!job) {
    return apiError("VALIDATION_ERROR", "Report job was not found.", 404);
  }

  return apiOk({
    report_job: {
      id: job.id,
      status: job.status,
      entitlement_type: job.entitlementType,
      attempts: job.attempts,
      fallback_used: job.fallbackUsedFlag,
      suburb: {
        id: job.suburb.id,
        sal_code: job.suburb.salCode,
        sal_name: job.suburb.salName
      },
      postcode: job.postcode?.postcode ?? null,
      report: job.reports[0]
        ? {
            id: job.reports[0].id,
            status: job.reports[0].status,
            generated_at: job.reports[0].generatedAt?.toISOString() ?? null,
            files: job.reports[0].files.map((file) => ({
              file_type: file.fileType,
              storage_url: file.storageUrl,
              watermark_applied_flag: file.watermarkAppliedFlag
            }))
          }
        : null
    }
  });
}
