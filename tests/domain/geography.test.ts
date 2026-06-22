import { describe, expect, it } from "vitest";
import { allowedMapAccessTiers } from "../../src/domain/geography";

describe("map layer entitlement", () => {
  it("limits anonymous visitors to public layers", () => {
    expect(allowedMapAccessTiers("public")).toEqual(["public", "visitor"]);
  });

  it("allows registered free users to free-tier layers but not paid layers", () => {
    expect(allowedMapAccessTiers("free")).toEqual(["public", "visitor", "free"]);
  });

  it("allows subscribers to paid layer tiers", () => {
    expect(allowedMapAccessTiers("paid")).toEqual([
      "public",
      "visitor",
      "free",
      "paid",
      "subscriber"
    ]);
  });
});
