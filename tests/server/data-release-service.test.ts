import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    dataRelease: {
      update: vi.fn()
    },
    scoringRelease: {
      updateMany: vi.fn()
    },
    mapLayer: {
      updateMany: vi.fn()
    }
  };
  const prisma = {
    scoringRelease: {
      findFirst: vi.fn()
    },
    dataRelease: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    user: {
      findMany: vi.fn()
    },
    inboxMessage: {
      createMany: vi.fn()
    },
    $transaction: vi.fn(async (callback: (txClient: typeof tx) => unknown) =>
      callback(tx)
    )
  };
  const writeAuditLog = vi.fn(async () => ({
    id: "audit-1",
    action_type: "test",
    target_type: "test",
    target_id: "target-1",
    created_at: "2026-06-23T00:00:00.000Z"
  }));

  return { prisma, tx, writeAuditLog };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/services/audit-service", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import {
  dataUploadCreateSchema,
  dataUploadValidateSchema,
  getDataQualityDashboard,
  publishDataRelease,
  rollbackDataRelease
} from "../../src/server/services/data-release-service";

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "super_admin" as const
};

describe("data release workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (txClient: typeof mocks.tx) => unknown) => callback(mocks.tx)
    );
    mocks.writeAuditLog.mockResolvedValue({
      id: "audit-1",
      action_type: "test",
      target_type: "test",
      target_id: "target-1",
      created_at: "2026-06-23T00:00:00.000Z"
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts inline upload rows and applies Phase 8 defaults", () => {
    const parsed = dataUploadCreateSchema.parse({
      file_name: "sydney-refresh.json",
      file_type: "json",
      rows: [
        {
          sal_code: "SAL123",
          latest_year: 2026,
          score_json: { price_band: "1.2m-1.5m" },
          prediction_json: { growth_1y: 0.04 },
          confidence_json: { confidence_band: "medium" }
        }
      ],
      reason: "Monthly refresh"
    });

    expect(parsed.city).toBe("Sydney");
    expect(parsed.model_registry_version).toBe("mock-model-registry-v1");
    expect(parsed.rows?.[0].report_generation_allowed_flag).toBe(true);
  });

  it("requires rows when validating an already registered upload", () => {
    expect(dataUploadValidateSchema.safeParse({
      city: "Sydney",
      rows: [],
      reason: "Validate upload"
    }).success).toBe(false);
  });

  it("reports manual review when no active scoring release exists", async () => {
    mocks.prisma.scoringRelease.findFirst.mockResolvedValue(null);

    await expect(getDataQualityDashboard("Sydney")).resolves.toEqual({
      city: "Sydney",
      active_release_key: null,
      freshness: "manual_review_required",
      flags: { manual_review_required: 1 },
      row_count: 0,
      report_blocked_count: 0
    });
  });

  it("summarizes active release freshness and quality flags", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T00:00:00.000Z"));
    mocks.prisma.scoringRelease.findFirst.mockResolvedValue({
      releaseKey: "scoring-v2",
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      dataRelease: {
        releaseKey: "data-v2"
      },
      scoringRows: [
        {
          confidenceJson: {
            data_quality_flags: ["low_sample", "low_confidence"]
          },
          reportGenerationAllowedFlag: false
        },
        {
          confidenceJson: {
            data_quality_flags: ["low_sample"]
          },
          reportGenerationAllowedFlag: true
        }
      ]
    });

    const dashboard = await getDataQualityDashboard("Sydney");

    expect(dashboard.freshness).toBe("fresh");
    expect(dashboard.flags).toMatchObject({
      fresh: 1,
      low_sample: 2,
      low_confidence: 1,
      report_blocked: 1
    });
    expect(dashboard.report_blocked_count).toBe(1);
  });

  it("publishes an awaiting-confirmation release and activates map layers", async () => {
    mocks.prisma.dataRelease.findUnique.mockResolvedValue({
      id: "release-new",
      city: "Sydney",
      status: "awaiting_confirmation",
      releaseKey: "data-v2",
      scoringReleases: [
        {
          _count: {
            scoringRows: 10
          }
        }
      ]
    });
    mocks.prisma.dataRelease.findFirst.mockResolvedValue({
      releaseKey: "data-v1"
    });
    mocks.tx.dataRelease.update.mockResolvedValue({
      id: "release-new",
      releaseKey: "data-v2",
      status: "published"
    });

    const result = await publishDataRelease({
      releaseId: "release-new",
      actor,
      reason: "Approved change report"
    });

    expect(mocks.tx.scoringRelease.updateMany).toHaveBeenCalledWith({
      where: { dataReleaseId: "release-new" },
      data: {
        status: "published",
        publishedAt: expect.any(Date)
      }
    });
    expect(mocks.tx.mapLayer.updateMany).toHaveBeenCalledWith({
      where: { activeFlag: true },
      data: { releaseVersion: "data-v2" }
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: "data_publish",
      targetId: "release-new"
    }));
    expect(result).toMatchObject({
      previous_active_release_key: "data-v1",
      active_release_key: "data-v2"
    });
  });

  it("rolls back a published release without deleting generated reports", async () => {
    mocks.prisma.dataRelease.findUnique.mockResolvedValue({
      id: "release-new",
      city: "Sydney",
      status: "published",
      releaseKey: "data-v2",
      scoringReleases: [{ id: "scoring-v2" }],
      _count: {
        reportJobs: 3
      }
    });
    mocks.prisma.dataRelease.findFirst.mockResolvedValue({
      releaseKey: "data-v1"
    });
    mocks.tx.dataRelease.update
      .mockResolvedValueOnce({ id: "release-new", status: "rollback_in_progress" })
      .mockResolvedValueOnce({ id: "release-new", status: "rolled_back" });

    const result = await rollbackDataRelease({
      releaseId: "release-new",
      actor,
      reason: "Rollback after validation issue"
    });

    expect(mocks.tx.dataRelease.update).toHaveBeenCalledWith({
      where: { id: "release-new" },
      data: { status: "rollback_in_progress" }
    });
    expect(mocks.tx.scoringRelease.updateMany).toHaveBeenCalledWith({
      where: { dataReleaseId: "release-new" },
      data: { status: "rolled_back" }
    });
    expect(mocks.tx.mapLayer.updateMany).toHaveBeenCalledWith({
      where: { activeFlag: true },
      data: { releaseVersion: "data-v1" }
    });
    expect(result.generated_reports_retained).toBe(true);
  });
});
