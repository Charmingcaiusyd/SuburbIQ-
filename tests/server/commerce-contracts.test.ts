import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/prisma", () => ({ prisma: {} }));
vi.mock("@/server/services/geography-service", () => ({
  getActivePublishedScoringRelease: vi.fn()
}));

import {
  checkoutCreateSchema,
  paymentWebhookSchema
} from "../../src/server/services/commerce-service";

describe("commerce API contracts", () => {
  it("accepts snake_case and camelCase checkout payloads", () => {
    const suburbId = "00000000-0000-4000-8000-000000000010";
    const postcodeId = "00000000-0000-4000-8000-000000000011";

    expect(checkoutCreateSchema.parse({
      product_type: "single_report",
      suburb_id: suburbId,
      postcode_id: postcodeId,
      acknowledged_low_confidence_warning: true
    })).toMatchObject({
      product_type: "single_report",
      suburb_id: suburbId,
      postcode_id: postcodeId,
      acknowledged_low_confidence_warning: true,
      provider: "stripe"
    });

    expect(checkoutCreateSchema.parse({
      productType: "single_report",
      suburbId,
      postcodeId,
      acknowledgedLowConfidenceWarning: true,
      provider: "paypal"
    })).toMatchObject({
      productType: "single_report",
      suburbId,
      postcodeId,
      acknowledgedLowConfidenceWarning: true,
      provider: "paypal"
    });
  });

  it("accepts provider webhook state transitions used by mock Stripe and PayPal routes", () => {
    expect(paymentWebhookSchema.safeParse({
      payment_id: "00000000-0000-4000-8000-000000000012",
      event_type: "payment_confirmed"
    }).success).toBe(true);

    expect(paymentWebhookSchema.safeParse({
      providerPaymentId: "provider-payment-1",
      eventType: "manual_review_required"
    }).success).toBe(true);
  });
});
