import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/prisma", () => ({ prisma: {} }));
vi.mock("@/server/services/report-entitlement-state-service", () => ({
  captureHeldReportCredit: vi.fn(),
  captureSubscriptionQuota: vi.fn(),
  findUsableSubscription: vi.fn(),
  releaseHeldReportCredit: vi.fn()
}));

import { validateGeneratedReportOutput } from "../../src/server/services/report-worker-service";

describe("report generation validation", () => {
  it("accepts generated output with enough report sections", () => {
    expect(validateGeneratedReportOutput({
      sections: Array.from({ length: 10 }, (_, index) => ({
        title: `Section ${index + 1}`,
        body: "Generated report content"
      }))
    })).toBe(true);
  });

  it("rejects failed LLM output before fallback is used", () => {
    expect(validateGeneratedReportOutput(null)).toBe(false);
    expect(validateGeneratedReportOutput({ sections: [] })).toBe(false);
    expect(validateGeneratedReportOutput({ sections: Array.from({ length: 9 }) })).toBe(false);
  });
});
