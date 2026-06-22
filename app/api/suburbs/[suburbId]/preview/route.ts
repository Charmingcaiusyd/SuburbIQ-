import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { getSuburbPreview } from "@/server/services/geography-service";

export async function GET(
  _request: NextRequest,
  context: { params: { suburbId: string } }
) {
  const preview = await getSuburbPreview(context.params.suburbId);

  if (!preview) {
    return apiError(
      "GEOGRAPHY_NOT_SELECTABLE",
      "No active database-confirmed suburb was found.",
      404
    );
  }

  return apiOk(preview);
}
