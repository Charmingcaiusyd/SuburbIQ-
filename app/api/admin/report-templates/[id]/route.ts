import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireSuperAdmin } from "@/server/auth/guards";
import { adminActor, templateUpdateSchema, updateReportTemplate } from "@/server/services/admin-service";
import { toCommerceErrorResponse } from "@/server/services/commerce-service";

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  const auth = await requireSuperAdmin(request);
  if (!auth.user) return auth.response;
  const parsed = templateUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Template update payload is invalid.", 422, parsed.error.flatten());

  try {
    return apiOk({ template: await updateReportTemplate({ templateId: context.params.id, actor: adminActor(auth.user), body: parsed.data }) });
  } catch (error) {
    const response = toCommerceErrorResponse(error);
    return apiError(response.code, response.message, response.status, response.details);
  }
}
