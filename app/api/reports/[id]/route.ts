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

  const report = await prisma.report.findFirst({
    where: {
      id: context.params.id,
      userId: auth.user.id
    },
    include: {
      suburb: true,
      files: true
    }
  });

  if (!report) {
    return apiError("VALIDATION_ERROR", "Report was not found.", 404);
  }

  return apiOk({
    report: {
      id: report.id,
      title: report.title,
      status: report.status,
      suburb: {
        id: report.suburb.id,
        sal_code: report.suburb.salCode,
        sal_name: report.suburb.salName
      },
      generated_at: report.generatedAt?.toISOString() ?? null,
      data_version_refs: report.dataVersionRefsJson,
      prediction_snapshot: report.predictionSnapshotJson,
      profile_snapshot: report.profileSnapshotJson,
      files: report.files.map((file) => ({
        file_type: file.fileType,
        storage_url: file.storageUrl,
        watermark_applied_flag: file.watermarkAppliedFlag
      }))
    }
  });
}
