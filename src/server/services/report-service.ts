import { z } from "zod";
import { type EntitlementType } from "@/domain/enums";
import { canTransitionOrder } from "@/domain/state-machines";
import { prisma } from "@/server/db/prisma";
import { CommerceError } from "@/server/services/commerce-service";
import { getActivePublishedScoringRelease } from "@/server/services/geography-service";
import {
  createProfileSnapshot,
  getActiveProfile
} from "@/server/services/profile-service";
import {
  findUsableSubscription,
  holdReportCredit
} from "@/server/services/report-entitlement-state-service";

export const reportGenerateSchema = z.object({
  entitlement_type: z.enum(["credit", "subscription", "order"]).optional(),
  entitlementType: z.enum(["credit", "subscription", "order"]).optional(),
  credit_id: z.string().uuid().optional(),
  creditId: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  suburb_id: z.string().uuid(),
  suburbId: z.string().uuid().optional(),
  postcode_id: z.string().uuid().optional(),
  postcodeId: z.string().uuid().optional(),
  acknowledged_low_confidence_warning: z.boolean().optional(),
  acknowledgedLowConfidenceWarning: z.boolean().optional()
});

function normalizeGenerateRequest(body: unknown) {
  const raw = body as Record<string, unknown> | null;

  return {
    ...raw,
    suburb_id: raw?.suburb_id ?? raw?.suburbId
  };
}

async function getTemplateVersions() {
  const [reportTemplate, llmTemplate] = await Promise.all([
    prisma.reportTemplate.findFirst({
      where: {
        activeFlag: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.llmTemplate.findFirst({
      where: {
        activeFlag: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  return {
    reportTemplateVersion: reportTemplate?.version ?? "v1.3-default-report",
    llmTemplateVersion: llmTemplate?.version ?? "v1.3-default-llm"
  };
}

async function validateReportTarget(input: {
  suburbId: string;
  postcodeId?: string;
  acknowledgedLowConfidenceWarning?: boolean;
}) {
  const relationship = input.postcodeId
    ? await prisma.suburbPostcodeRelationship.findFirst({
        where: {
          suburbId: input.suburbId,
          postcodeId: input.postcodeId,
          selectableFlag: true,
          suburb: {
            activeFlag: true
          },
          postcode: {
            activeFlag: true
          }
        },
        include: {
          suburb: true,
          postcode: true
        }
      })
    : await prisma.suburbPostcodeRelationship.findFirst({
        where: {
          suburbId: input.suburbId,
          selectableFlag: true,
          suburb: {
            activeFlag: true
          },
          postcode: {
            activeFlag: true
          }
        },
        include: {
          suburb: true,
          postcode: true
        },
        orderBy: {
          createdAt: "asc"
        }
      });

  if (!relationship) {
    throw new CommerceError(
      "GEOGRAPHY_NOT_SELECTABLE",
      "Suburb/postcode relationship is not database-confirmed or selectable.",
      400
    );
  }

  const scoringRelease = await getActivePublishedScoringRelease(relationship.suburb.city);
  const scoringRecord = scoringRelease
    ? await prisma.suburbScoringRecord.findUnique({
        where: {
          scoringReleaseId_suburbId: {
            scoringReleaseId: scoringRelease.id,
            suburbId: relationship.suburbId
          }
        }
      })
    : null;

  if (!scoringRelease || !scoringRecord) {
    throw new CommerceError(
      "REPORT_BLOCKED",
      "No approved scoring release is available for this suburb.",
      409
    );
  }

  if (!scoringRecord.reportGenerationAllowedFlag) {
    throw new CommerceError(
      "REPORT_BLOCKED",
      scoringRecord.reportBlockReason ?? "Report is unavailable for this suburb.",
      409
    );
  }

  const confidence = scoringRecord.confidenceJson as Record<string, unknown>;
  const lowConfidence =
    confidence.low_confidence_warning_required === true ||
    confidence.lowConfidenceWarningRequired === true ||
    confidence.confidence_band === "low" ||
    confidence.confidenceBand === "low";

  if (lowConfidence && !input.acknowledgedLowConfidenceWarning) {
    throw new CommerceError(
      "LOW_CONFIDENCE_ACK_REQUIRED",
      "Low-confidence report warning must be acknowledged before generation.",
      409
    );
  }

  return {
    relationship,
    scoringRelease,
    scoringRecord
  };
}

async function validateOrderEntitlement(input: {
  userId: string;
  orderId: string;
  suburbId: string;
  postcodeId: string;
}) {
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      userId: input.userId,
      status: "paid",
      selectedSuburbId: input.suburbId,
      selectedPostcodeId: input.postcodeId,
      deletedAt: null
    }
  });

  if (!order) {
    throw new CommerceError(
      "NO_REPORT_ENTITLEMENT",
      "No paid single-report order is available for this suburb/postcode.",
      402
    );
  }

  return order;
}

async function resolveEntitlement(input: {
  userId: string;
  entitlementType: EntitlementType;
  creditId?: string;
  orderId?: string;
  suburbId: string;
  postcodeId: string;
}) {
  if (input.entitlementType === "credit") {
    if (!input.creditId) {
      throw new CommerceError("NO_REPORT_ENTITLEMENT", "credit_id is required.", 402);
    }

    const credit = await prisma.reportCredit.findFirst({
      where: {
        id: input.creditId,
        userId: input.userId,
        status: {
          in: ["available", "released"]
        }
      }
    });

    if (!credit) {
      throw new CommerceError(
        "NO_REPORT_ENTITLEMENT",
        "No available report credit was found.",
        402
      );
    }

    return {
      creditId: credit.id,
      orderId: null,
      subscriptionId: null
    };
  }

  if (input.entitlementType === "subscription") {
    const subscription = await findUsableSubscription(input.userId);

    if (!subscription) {
      throw new CommerceError(
        "NO_REPORT_ENTITLEMENT",
        "No active subscription quota is available.",
        402
      );
    }

    return {
      creditId: null,
      orderId: null,
      subscriptionId: subscription.id
    };
  }

  if (!input.orderId) {
    throw new CommerceError("NO_REPORT_ENTITLEMENT", "order_id is required.", 402);
  }

  const order = await validateOrderEntitlement({
    userId: input.userId,
    orderId: input.orderId,
    suburbId: input.suburbId,
    postcodeId: input.postcodeId
  });

  return {
    creditId: null,
    orderId: order.id,
    subscriptionId: null
  };
}

export async function createPaidReportJob(input: {
  userId: string;
  body: unknown;
}) {
  const parsed = reportGenerateSchema.safeParse(normalizeGenerateRequest(input.body));

  if (!parsed.success) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      "Report generation request is invalid.",
      422,
      parsed.error.flatten()
    );
  }

  const entitlementType =
    parsed.data.entitlement_type ?? parsed.data.entitlementType ?? "credit";
  const suburbId = parsed.data.suburb_id;
  const postcodeId = parsed.data.postcode_id ?? parsed.data.postcodeId;
  const activeProfile = await getActiveProfile(input.userId);

  if (!activeProfile || activeProfile.completenessScore < 60) {
    throw new CommerceError(
      "PROFILE_INCOMPLETE",
      "Buyer profile completeness must be at least 60 before generating a paid report.",
      422
    );
  }

  const target = await validateReportTarget({
    suburbId,
    postcodeId,
    acknowledgedLowConfidenceWarning:
      parsed.data.acknowledged_low_confidence_warning ??
      parsed.data.acknowledgedLowConfidenceWarning
  });
  const finalPostcodeId = target.relationship.postcodeId;
  const entitlement = await resolveEntitlement({
    userId: input.userId,
    entitlementType,
    creditId: parsed.data.credit_id ?? parsed.data.creditId,
    orderId: parsed.data.order_id ?? parsed.data.orderId,
    suburbId,
    postcodeId: finalPostcodeId
  });
  const snapshot = await createProfileSnapshot(input.userId);

  if (!snapshot) {
    throw new CommerceError(
      "PROFILE_INCOMPLETE",
      "Could not create profile snapshot for report generation.",
      422
    );
  }

  const templateVersions = await getTemplateVersions();

  const reportJob = await prisma.$transaction(async (tx) => {
    const job = await tx.reportJob.create({
      data: {
        userId: input.userId,
        orderId: entitlement.orderId,
        suburbId,
        postcodeId: finalPostcodeId,
        status: "queued",
        entitlementType,
        profileSnapshotId: snapshot.id,
        scoringReleaseId: target.scoringRelease.id,
        dataReleaseId: target.scoringRelease.dataReleaseId,
        reportTemplateVersion: templateVersions.reportTemplateVersion,
        llmTemplateVersion: templateVersions.llmTemplateVersion,
        attempts: 0,
        fallbackUsedFlag: false
      }
    });

    if (entitlement.orderId) {
      const order = await tx.order.findUniqueOrThrow({
        where: {
          id: entitlement.orderId
        }
      });

      if (canTransitionOrder(order.status, "report_generating")) {
        await tx.order.update({
          where: {
            id: order.id
          },
          data: {
            status: "report_generating"
          }
        });
      }
    }

    return job;
  });

  if (entitlement.creditId) {
    await holdReportCredit({
      userId: input.userId,
      creditId: entitlement.creditId,
      reportJobId: reportJob.id
    });
  }

  return {
    report_job_id: reportJob.id,
    status: reportJob.status,
    entitlement_type: entitlementType,
    entitlement_hold_status:
      entitlementType === "credit"
        ? "held"
        : entitlementType === "subscription"
          ? "quota_reserved"
          : "order_reserved",
    estimated_stage: "queued"
  };
}
