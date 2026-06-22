import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const reports = await prisma.report.findMany({
    where: {
      userId: auth.user.id
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      suburb: true,
      files: true
    }
  });

  return apiOk({
    reports: reports.map((report) => ({
      id: report.id,
      title: report.title,
      status: report.status,
      suburb: {
        id: report.suburb.id,
        sal_code: report.suburb.salCode,
        sal_name: report.suburb.salName
      },
      generated_at: report.generatedAt?.toISOString() ?? null,
      files: report.files.map((file) => ({
        file_type: file.fileType,
        storage_url: file.storageUrl
      }))
    }))
  });
}
