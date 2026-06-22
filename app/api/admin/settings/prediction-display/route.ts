import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireSuperAdmin } from "@/server/auth/guards";
import { adminActor, predictionDisplaySchema, updatePredictionDisplay } from "@/server/services/admin-service";

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.user) return auth.response;
  const parsed = predictionDisplaySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Prediction display payload is invalid.", 422, parsed.error.flatten());

  return apiOk(await updatePredictionDisplay({ actor: adminActor(auth.user), body: parsed.data }));
}
