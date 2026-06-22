import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/server/api/response";
import { requireSuperAdmin } from "@/server/auth/guards";
import { adminActor, createDataUpload } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

const uploadSchema = z.object({
  file_name: z.string().trim().min(1),
  file_type: z.string().trim().min(1),
  reason: z.string().trim().min(3)
});

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.user) return auth.response;

  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Upload metadata is invalid.", 422, parsed.error.flatten());
  }

  try {
    return apiOk({
      upload: await createDataUpload({
        actor: adminActor(auth.user),
        fileName: parsed.data.file_name,
        fileType: parsed.data.file_type,
        reason: parsed.data.reason
      })
    });
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
