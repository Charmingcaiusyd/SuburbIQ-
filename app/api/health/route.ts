import type { NextRequest } from "next/server";
import { apiOk } from "@/server/api/response";
import { getDeploymentEnvStatus } from "@/server/config/env";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const env = getDeploymentEnvStatus();
  const deep = request.nextUrl.searchParams.get("deep") === "true";
  let database: "skipped" | "ok" | "error" = "skipped";

  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const requiredEnvHealthy =
    process.env.NODE_ENV === "production" ? env.missing_required.length === 0 : true;
  const healthy = requiredEnvHealthy && database !== "error";

  return apiOk(
    {
      status: healthy ? "ok" : "degraded",
      service: "SuburbIQ",
      subtitle: "Sydney Property Data & Buyer Decision Platform",
      version: process.env.npm_package_version ?? "0.1.0",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
      time: new Date().toISOString(),
      checks: {
        env,
        database
      }
    },
    { status: healthy ? 200 : 503 }
  );
}
