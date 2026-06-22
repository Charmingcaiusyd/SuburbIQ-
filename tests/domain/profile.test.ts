import { describe, expect, it } from "vitest";
import {
  calculateProfileCompleteness,
  getConfidenceBand,
  getMissingMandatoryFields
} from "../../src/domain/profile";

describe("buyer profile scoring", () => {
  it("blocks matching below 60 and reports missing mandatory fields", () => {
    const profile = {
      budgetRange: "1.2m-1.5m",
      buyingPurpose: "owner_occupier"
    };

    expect(calculateProfileCompleteness(profile)).toBe(25);
    expect(getConfidenceBand(25)).toBe("too_incomplete");
    expect(getMissingMandatoryFields(profile)).toEqual([
      "propertyTypePreference",
      "preferredGeography",
      "riskPreference"
    ]);
  });

  it("classifies score 70 as medium confidence", () => {
    expect(getConfidenceBand(70)).toBe("medium");
  });

  it("classifies score 59 as insufficient for personalised matching", () => {
    expect(calculateProfileCompleteness({
      budgetRange: "1.2m-1.5m",
      buyingPurpose: "owner_occupier",
      propertyTypePreference: "apartment",
      preferredGeography: ["Sydney"],
      riskPreference: "balanced",
      futureDevelopmentTolerance: "medium"
    })).toBe(59);
    expect(getConfidenceBand(59)).toBe("insufficient");
  });
});
