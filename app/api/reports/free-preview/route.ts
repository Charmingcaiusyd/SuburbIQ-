import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { getSuburbPreview } from "@/server/services/geography-service";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const suburbId = body?.suburb_id ?? body?.suburbId;

  if (!suburbId) {
    return apiError("VALIDATION_ERROR", "suburb_id is required.", 422);
  }

  const preview = await getSuburbPreview(suburbId);

  if (!preview) {
    return apiError(
      "GEOGRAPHY_NOT_SELECTABLE",
      "No active database-confirmed suburb was found.",
      404
    );
  }

  return apiOk({
    report_type: "free_preview",
    watermark: {
      generated_for: auth.user.email,
      not_for_redistribution: true
    },
    pdf_download_available: false,
    prediction_data_included: false,
    preview
  });
}
