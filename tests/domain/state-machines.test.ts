import { describe, expect, it } from "vitest";
import {
  canTransitionCredit,
  canTransitionDataRelease,
  canTransitionPayment,
  canTransitionReportJob
} from "../../src/domain/state-machines";

describe("state machines", () => {
  it("allows the happy path report job transitions", () => {
    expect(canTransitionReportJob("queued", "processing")).toBe(true);
    expect(canTransitionReportJob("processing", "llm_generation_started")).toBe(true);
    expect(canTransitionReportJob("rendering_pdf", "completed")).toBe(true);
  });

  it("blocks invalid report job jumps", () => {
    expect(canTransitionReportJob("queued", "completed")).toBe(false);
    expect(canTransitionReportJob("completed", "processing")).toBe(false);
  });

  it("models credit hold capture and release", () => {
    expect(canTransitionCredit("available", "held")).toBe(true);
    expect(canTransitionCredit("held", "captured")).toBe(true);
    expect(canTransitionCredit("held", "released")).toBe(true);
    expect(canTransitionCredit("captured", "available")).toBe(false);
  });

  it("keeps payment access gated until confirmation", () => {
    expect(canTransitionPayment("payment_pending", "payment_confirmed")).toBe(true);
    expect(canTransitionPayment("payment_pending", "refunded")).toBe(false);
  });

  it("requires data releases to pass validation and change report before publish", () => {
    expect(canTransitionDataRelease("uploaded", "validated")).toBe(true);
    expect(canTransitionDataRelease("uploaded", "published")).toBe(false);
  });

  it("models publish and rollback confirmation gates for data releases", () => {
    expect(canTransitionDataRelease("change_report_generated", "awaiting_confirmation")).toBe(true);
    expect(canTransitionDataRelease("awaiting_confirmation", "published")).toBe(true);
    expect(canTransitionDataRelease("published", "rolled_back")).toBe(false);
    expect(canTransitionDataRelease("published", "rollback_in_progress")).toBe(true);
    expect(canTransitionDataRelease("rollback_in_progress", "rolled_back")).toBe(true);
  });
});
