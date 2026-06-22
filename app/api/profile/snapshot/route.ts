import type { NextRequest } from "next/server";
import { apiCreated, apiError } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import { createProfileSnapshot } from "@/server/services/profile-service";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const snapshot = await createProfileSnapshot(auth.user.id);

  if (!snapshot) {
    return apiError("PROFILE_INCOMPLETE", "Create a buyer profile before snapshotting.", 422);
  }

  return apiCreated({
    snapshot
  });
}
