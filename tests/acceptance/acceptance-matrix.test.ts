import { describe, expect, it } from "vitest";
import matrix from "../../docs/v1.3-engineering-spec/acceptance-matrix.json";

const requiredAcceptanceIds = [
  "AC-GEO-001",
  "AC-GEO-002",
  "AC-GEO-003",
  "AC-PROFILE-001",
  "AC-PROFILE-002",
  "AC-PROFILE-003",
  "AC-RPT-001",
  "AC-RPT-002",
  "AC-RPT-003",
  "AC-RPT-004",
  "AC-RPT-005",
  "AC-PAY-001",
  "AC-PAY-002",
  "AC-SUB-001",
  "AC-SUB-002",
  "AC-ADM-001",
  "AC-ADM-002",
  "AC-ADM-003",
  "AC-ADM-004",
  "AC-UI-001",
  "AC-UI-002",
  "AC-UI-003"
];

describe("acceptance matrix", () => {
  it("tracks every V1.3 acceptance criterion exactly once", () => {
    const ids = matrix.map((item) => item.id);

    expect(ids.sort()).toEqual([...requiredAcceptanceIds].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each criterion actionable for CI or manual QA", () => {
    for (const item of matrix) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.given.length).toBeGreaterThan(0);
      expect(item.when.length).toBeGreaterThan(0);
      expect(item.then.length).toBeGreaterThan(0);
      expect(item.layer).toMatch(/unit|integration|e2e|manual/);
      expect(item.automation_status).toMatch(/automated|partial|manual|planned/);
      expect(item.verification_command.length).toBeGreaterThan(0);
      expect(item.implementation_refs.length).toBeGreaterThan(0);
    }
  });
});
