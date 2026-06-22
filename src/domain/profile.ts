import type { ConfidenceBand } from "./enums";

export type BuyerProfileInput = {
  budgetRange?: string | null;
  buyingPurpose?: string | null;
  propertyTypePreference?: string | null;
  preferredGeography?: unknown;
  riskPreference?: string | null;
  growthPreference?: string | null;
  liquidityPreference?: string | null;
  commuteRequirements?: unknown;
  lifestylePriorities?: unknown;
  schoolFamilyNeeds?: unknown;
  rentalYieldImportance?: string | null;
  futureDevelopmentTolerance?: string | null;
  freeTextNotes?: string | null;
};

const weights = {
  budgetRange: 15,
  buyingPurpose: 10,
  propertyTypePreference: 10,
  preferredGeography: 10,
  riskPreference: 10,
  growthPreference: 8,
  liquidityPreference: 7,
  commuteRequirements: 7,
  lifestylePriorities: 6,
  schoolFamilyNeeds: 5,
  rentalYieldImportance: 5,
  futureDevelopmentTolerance: 4,
  freeTextNotes: 3
} satisfies Record<keyof BuyerProfileInput, number>;

function hasValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object" && value !== null) {
    return Object.keys(value).length > 0;
  }

  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

export function calculateProfileCompleteness(profile: BuyerProfileInput) {
  return Object.entries(weights).reduce((score, [field, weight]) => {
    return hasValue(profile[field as keyof BuyerProfileInput]) ? score + weight : score;
  }, 0);
}

export function getConfidenceBand(score: number): ConfidenceBand {
  if (score <= 39) return "too_incomplete";
  if (score <= 59) return "insufficient";
  if (score <= 69) return "low";
  if (score <= 84) return "medium";
  return "high";
}

export function getMissingMandatoryFields(profile: BuyerProfileInput) {
  return [
    "budgetRange",
    "buyingPurpose",
    "propertyTypePreference",
    "preferredGeography",
    "riskPreference"
  ].filter((field) => !hasValue(profile[field as keyof BuyerProfileInput]));
}
