import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  calculateGstInclusiveCents,
  isCreditPackProduct,
  isReportProduct,
  isSubscriptionProduct,
  subscriptionMonths
} from "../../src/domain/commerce";

describe("commerce domain helpers", () => {
  it("calculates GST inclusive component", () => {
    expect(calculateGstInclusiveCents(11000)).toBe(1000);
  });

  it("applies percent, fixed and free discounts", () => {
    expect(applyDiscount({ amountCents: 10000, discountType: "percent", value: 25 }))
      .toEqual({ discountCents: 2500, finalAmountCents: 7500 });
    expect(applyDiscount({ amountCents: 10000, discountType: "fixed_cents", value: 12000 }))
      .toEqual({ discountCents: 10000, finalAmountCents: 0 });
    expect(applyDiscount({ amountCents: 10000, discountType: "free", value: 100 }))
      .toEqual({ discountCents: 10000, finalAmountCents: 0 });
  });

  it("classifies product entitlement types", () => {
    expect(isReportProduct("single_report")).toBe(true);
    expect(isCreditPackProduct("ten_credit_pack")).toBe(true);
    expect(isSubscriptionProduct("subscription_12m")).toBe(true);
    expect(subscriptionMonths("subscription_6m")).toBe(6);
  });
});
