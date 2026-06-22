import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/server/api/response";
import {
  searchConfirmedSuburbPostcodeRelationships,
  suburbSearchQuerySchema
} from "@/server/services/geography-service";

export async function GET(request: NextRequest) {
  const parsed = suburbSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Search query q is required and must be 1-80 characters.",
      422,
      parsed.error.flatten()
    );
  }

  return apiOk({
    results: await searchConfirmedSuburbPostcodeRelationships(parsed.data),
    source: "database",
    rule: "Only database-confirmed suburb/postcode relationships can proceed."
  });
}
