import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { type ReportJobStatus } from "@/domain/enums";
import { canTransitionOrder, canTransitionReportJob } from "@/domain/state-machines";
import { prisma } from "@/server/db/prisma";
import { CommerceError } from "@/server/services/commerce-service";
import {
  captureHeldReportCredit,
  captureSubscriptionQuota,
  findUsableSubscription,
  releaseHeldReportCredit
} from "@/server/services/report-entitlement-state-service";

export type ProcessReportJobOptions = {
  forceLlmFailure?: boolean;
  forceFallbackFailure?: boolean;
};

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function setJobStatus(jobId: string, from: ReportJobStatus, to: ReportJobStatus) {
  if (!canTransitionReportJob(from, to)) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      `Cannot transition report job from ${from} to ${to}.`,
      409
    );
  }

  return prisma.reportJob.update({
    where: {
      id: jobId
    },
    data: {
      status: to
    }
  });
}

function reportSectionsFromContext(context: {
  suburbName: string;
  salCode: string;
}) {
  return [
    "Executive Summary",
    "Area Snapshot",
    "Current Market Position",
    "Historical Price Trend",
    "1-Year Growth Signal",
    "3-Year Growth Signal",
    "Greater Sydney Comparison",
    "Downside / Drawdown Risk",
    "Liquidity / Transaction Depth",
    "Unit Stock Share / Housing Mix",
    "Rent and Yield Proxy",
    "Population and Demographic Context",
    "Planning / Supply Pressure",
    "Data Quality and Confidence",
    "Personal Fit Analysis",
    "Top Reasons This Area Matches You",
    "Not Suitable Because",
    "Similar Suburbs",
    "Risk Warnings",
    "Methodology and Disclaimer"
  ].map((title) => ({
    title,
    body: `${title} for ${context.suburbName} (${context.salCode}) generated from locked platform context.`
  }));
}

function validateGeneratedOutput(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return false;
  }

  const sections = (output as { sections?: unknown }).sections;
  return Array.isArray(sections) && sections.length >= 10;
}

async function logLlmAttempt(input: {
  reportJobId: string;
  attemptNumber: number;
  promptVersion: string;
  validationStatus: "valid" | "failed";
  errorMessage?: string;
}) {
  return prisma.llmGenerationLog.create({
    data: {
      reportJobId: input.reportJobId,
      provider: "mock",
      model: "mock-llm-v1",
      promptVersion: input.promptVersion,
      attemptNumber: input.attemptNumber,
      validationStatus: input.validationStatus,
      errorMessage: input.errorMessage
    }
  });
}

async function compensateFailedJob(job: {
  id: string;
  userId: string;
  orderId: string | null;
  entitlementType: string;
}) {
  if (job.entitlementType === "credit") {
    const heldCredit = await prisma.reportCredit.findFirst({
      where: {
        userId: job.userId,
        heldByReportJobId: job.id,
        status: "held"
      }
    });

    if (heldCredit) {
      await releaseHeldReportCredit({
        userId: job.userId,
        creditId: heldCredit.id
      });
      await prisma.reportJob.update({
        where: {
          id: job.id
        },
        data: {
          status: "credit_released"
        }
      });
    }
  }

  if (job.orderId) {
    const order = await prisma.order.findUnique({
      where: {
        id: job.orderId
      }
    });

    if (order && canTransitionOrder(order.status, "failed")) {
      await prisma.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "failed"
        }
      });
    }
  }
}

async function captureSuccessfulEntitlement(job: {
  id: string;
  userId: string;
  orderId: string | null;
  entitlementType: string;
}, reportId: string) {
  if (job.entitlementType === "credit") {
    const heldCredit = await prisma.reportCredit.findFirst({
      where: {
        userId: job.userId,
        heldByReportJobId: job.id,
        status: "held"
      }
    });

    if (heldCredit) {
      await captureHeldReportCredit({
        userId: job.userId,
        creditId: heldCredit.id,
        reportId
      });
    }
  }

  if (job.entitlementType === "subscription") {
    const subscription = await findUsableSubscription(job.userId);

    if (subscription) {
      await captureSubscriptionQuota({
        userId: job.userId,
        subscriptionId: subscription.id
      });
    }
  }

  if (job.orderId) {
    const order = await prisma.order.findUnique({
      where: {
        id: job.orderId
      }
    });

    if (order && canTransitionOrder(order.status, "completed")) {
      await prisma.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "completed"
        }
      });
    }
  }
}

export async function processReportJob(
  reportJobId: string,
  options: ProcessReportJobOptions = {}
) {
  const existingReport = await prisma.report.findFirst({
    where: {
      reportJobId
    },
    include: {
      files: true
    }
  });

  if (existingReport) {
    return {
      report_job_id: reportJobId,
      status: "completed",
      report_id: existingReport.id,
      files: existingReport.files.map((file) => ({
        file_type: file.fileType,
        storage_url: file.storageUrl
      })),
      idempotent: true
    };
  }

  let job = await prisma.reportJob.findUnique({
    where: {
      id: reportJobId
    },
    include: {
      suburb: true,
      postcode: true,
      profileSnapshot: true,
      scoringRelease: {
        include: {
          dataRelease: true
        }
      }
    }
  });

  if (!job) {
    throw new CommerceError("VALIDATION_ERROR", "Report job was not found.", 404);
  }

  if (job.status !== "queued") {
    throw new CommerceError(
      "VALIDATION_ERROR",
      `Report job cannot be processed from ${job.status}.`,
      409
    );
  }

  await setJobStatus(job.id, "queued", "processing");
  await setJobStatus(job.id, "processing", "llm_generation_started");

  const scoringRecord = await prisma.suburbScoringRecord.findUnique({
    where: {
      scoringReleaseId_suburbId: {
        scoringReleaseId: job.scoringReleaseId,
        suburbId: job.suburbId
      }
    }
  });

  if (!scoringRecord) {
    await setJobStatus(job.id, "llm_generation_started", "failed");
    await compensateFailedJob(job);
    throw new CommerceError("REPORT_BLOCKED", "Locked scoring record is missing.", 409);
  }

  const context = {
    report_job_id: job.id,
    suburb_id: job.suburbId,
    sal_code: job.suburb.salCode,
    sal_name: job.suburb.salName,
    postcode: job.postcode?.postcode ?? null,
    profile_snapshot: job.profileSnapshot.snapshotJson,
    prediction_json: scoringRecord.predictionJson,
    score_json: scoringRecord.scoreJson,
    confidence_json: scoringRecord.confidenceJson,
    data_release_version: job.scoringRelease.dataRelease.releaseKey,
    scoring_release_version: job.scoringRelease.releaseKey,
    report_template_version: job.reportTemplateVersion,
    llm_template_version: job.llmTemplateVersion
  };

  let output: unknown = null;
  let currentStatus: ReportJobStatus = "llm_generation_started";

  for (const attempt of [1, 2, 3]) {
    const generated = options.forceLlmFailure
      ? null
      : {
          generated_by: "mock_llm",
          sections: reportSectionsFromContext({
            suburbName: job.suburb.salName,
            salCode: job.suburb.salCode
          }),
          context
        };
    const valid = validateGeneratedOutput(generated);

    await logLlmAttempt({
      reportJobId: job.id,
      attemptNumber: attempt,
      promptVersion: job.llmTemplateVersion,
      validationStatus: valid ? "valid" : "failed",
      errorMessage: valid ? undefined : "Mock LLM generation failed validation."
    });

    if (valid) {
      output = generated;
      break;
    }

    const nextStatus = attempt === 1 ? "llm_retry_1" : attempt === 2 ? "llm_retry_2" : "llm_retry_3";
    await setJobStatus(job.id, currentStatus, nextStatus);
    currentStatus = nextStatus;
  }

  let fallbackUsed = false;

  if (!output) {
    await setJobStatus(job.id, "llm_retry_3", "fallback_template_used");
    fallbackUsed = true;

    output = options.forceFallbackFailure
      ? null
      : {
          generated_by: "fallback_template",
          warning: "Generated using fallback template.",
          sections: reportSectionsFromContext({
            suburbName: job.suburb.salName,
            salCode: job.suburb.salCode
          }),
          context
        };

    if (!validateGeneratedOutput(output)) {
      await setJobStatus(job.id, "fallback_template_used", "failed");
      await compensateFailedJob(job);

      return {
        report_job_id: job.id,
        status: "failed",
        fallback_used: true,
        compensation: "entitlement_released_or_order_failed"
      };
    }
  }

  const renderingFrom: ReportJobStatus = fallbackUsed
    ? "fallback_template_used"
    : currentStatus;
  await setJobStatus(job.id, renderingFrom, "rendering_html");

  const html = `<html><body><h1>SuburbIQ report: ${job.suburb.salName}</h1><pre>${JSON.stringify(
    output,
    null,
    2
  )}</pre></body></html>`;
  const pdf = `PDF MOCK\nSuburbIQ report: ${job.suburb.salName}\nReport Job: ${job.id}\nNot for redistribution`;

  await setJobStatus(job.id, "rendering_html", "rendering_pdf");

  const report = await prisma.report.create({
    data: {
      reportJobId: job.id,
      userId: job.userId,
      suburbId: job.suburbId,
      status: "completed",
      title: `SuburbIQ Report - ${job.suburb.salName}`,
      generatedAt: new Date(),
      dataVersionRefsJson: {
        data_release_version: context.data_release_version,
        scoring_release_version: context.scoring_release_version,
        report_template_version: context.report_template_version,
        llm_template_version: context.llm_template_version,
        profile_snapshot_id: job.profileSnapshotId
      } as Prisma.InputJsonValue,
      predictionSnapshotJson: scoringRecord.predictionJson as Prisma.InputJsonValue,
      profileSnapshotJson: job.profileSnapshot.snapshotJson as Prisma.InputJsonValue
    }
  });

  await prisma.reportFile.createMany({
    data: [
      {
        reportId: report.id,
        fileType: "html",
        storageUrl: `s3://stub-bucket/reports/${report.id}/index.html`,
        watermarkAppliedFlag: false,
        checksum: checksum(html)
      },
      {
        reportId: report.id,
        fileType: "pdf",
        storageUrl: `s3://stub-bucket/reports/${report.id}/report.pdf`,
        watermarkAppliedFlag: true,
        checksum: checksum(pdf)
      }
    ]
  });

  await captureSuccessfulEntitlement(job, report.id);

  await prisma.reportJob.update({
    where: {
      id: job.id
    },
    data: {
      status: "completed",
      attempts: options.forceLlmFailure ? 3 : 1,
      fallbackUsedFlag: fallbackUsed
    }
  });

  await prisma.inboxMessage.create({
    data: {
      userId: job.userId,
      messageType: "report_completed",
      title: "Your SuburbIQ report is ready",
      body: `Your report for ${job.suburb.salName} is ready.`,
      relatedObjectType: "report",
      relatedObjectId: report.id
    }
  });

  const files = await prisma.reportFile.findMany({
    where: {
      reportId: report.id
    }
  });

  return {
    report_job_id: job.id,
    status: "completed",
    report_id: report.id,
    fallback_used: fallbackUsed,
    files: files.map((file) => ({
      file_type: file.fileType,
      storage_url: file.storageUrl,
      watermark_applied_flag: file.watermarkAppliedFlag
    }))
  };
}
