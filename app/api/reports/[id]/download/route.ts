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
      files: {
        where: {
          fileType: "pdf"
        }
      }
    }
  });

  if (!report || report.files.length === 0) {
    return apiError("VALIDATION_ERROR", "Watermarked PDF was not found.", 404);
  }

  const file = report.files[0];

  return apiOk({
    report_id: report.id,
    file_type: file.fileType,
    storage_url: file.storageUrl,
    watermark_applied_flag: file.watermarkAppliedFlag,
    checksum: file.checksum
  });
}
