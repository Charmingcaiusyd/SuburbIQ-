import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import { requireUser } from "@/server/auth/guards";
import {
  buyerProfileSchema,
  getActiveProfile,
  saveActiveProfile,
  serializeProfile
} from "@/server/services/profile-service";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const profile = await getActiveProfile(auth.user.id);

  if (!profile) {
    return apiOk({
      profile: null,
      completenessScore: 0,
      confidenceBand: "too_incomplete",
      missingMandatoryFields: [
        "budgetRange",
        "buyingPurpose",
        "propertyTypePreference",
        "preferredGeography",
        "riskPreference"
      ]
    });
  }

  return apiOk({
    profile: serializeProfile(profile)
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);

  if (!auth.user) {
    return auth.response;
  }

  const parsed = buyerProfileSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Buyer profile requires budget, purpose, property type and risk preference.",
      422,
      parsed.error.flatten()
    );
  }

  const profile = await saveActiveProfile(auth.user.id, parsed.data);

  return apiOk({
    profile
  });
}
