import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { writeAuditLog } from "@/server/services/audit-service";
import { CommerceError } from "@/server/services/commerce-service";

type DataReleaseActor = {
  id: string;
  role: "admin" | "super_admin";
};

const jsonObjectSchema = z.record(z.unknown()).default({});

export const dataUploadRowSchema = z.object({
  sal_code: z.string().trim().min(1),
  latest_year: z.coerce.number().int().min(1900).max(2200),
  score_json: jsonObjectSchema,
  prediction_json: jsonObjectSchema,
  confidence_json: jsonObjectSchema,
  report_generation_allowed_flag: z.boolean().default(true),
  report_block_reason: z.string().trim().min(1).nullable().optional()
});

export const dataUploadCreateSchema = z.object({
  file_name: z.string().trim().min(1),
  file_type: z.string().trim().min(1),
  city: z.string().trim().min(1).default("Sydney"),
  release_key: z.string().trim().min(3).optional(),
  scoring_release_key: z.string().trim().min(3).optional(),
  scoring_table_version: z.string().trim().min(3).optional(),
  model_registry_version: z.string().trim().min(3).default("mock-model-registry-v1"),
  rows: z.array(dataUploadRowSchema).optional(),
  reason: z.string().trim().min(3)
});

export const dataUploadValidateSchema = dataUploadCreateSchema
  .omit({ file_name: true, file_type: true })
  .extend({
    rows: z.array(dataUploadRowSchema).min(1)
  });

type DataUploadRow = z.infer<typeof dataUploadRowSchema>;

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function rowComparable(row: DataUploadRow) {
  return {
    latest_year: row.latest_year,
    score_json: row.score_json,
    prediction_json: row.prediction_json,
    confidence_json: row.confidence_json,
    report_generation_allowed_flag: row.report_generation_allowed_flag,
    report_block_reason: row.report_block_reason ?? null
  };
}

function recordComparable(record: {
  latestYear: number;
  scoreJson: Prisma.JsonValue;
  predictionJson: Prisma.JsonValue;
  confidenceJson: Prisma.JsonValue;
  reportGenerationAllowedFlag: boolean;
  reportBlockReason: string | null;
}) {
  return {
    latest_year: record.latestYear,
    score_json: record.scoreJson,
    prediction_json: record.predictionJson,
    confidence_json: record.confidenceJson,
    report_generation_allowed_flag: record.reportGenerationAllowedFlag,
    report_block_reason: record.reportBlockReason
  };
}

function releaseKey(prefix: string, city: string, uploadId: string) {
  return `${prefix}-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uploadId.slice(0, 8)}`;
}

function qualityFlagsFromConfidence(confidenceJson: Prisma.JsonValue) {
  if (!confidenceJson || typeof confidenceJson !== "object" || Array.isArray(confidenceJson)) {
    return [];
  }

  const flags = (confidenceJson as Record<string, unknown>).data_quality_flags;
  return Array.isArray(flags)
    ? flags.filter((flag): flag is string => typeof flag === "string")
    : [];
}

async function notifySuperAdmins(input: {
  title: string;
  body: string;
  relatedObjectType: string;
  relatedObjectId: string;
}) {
  const superAdmins = await prisma.user.findMany({
    where: {
      role: "super_admin",
      status: "active",
      deletedAt: null
    },
    select: { id: true }
  });

  if (superAdmins.length === 0) {
    return;
  }

  await prisma.inboxMessage.createMany({
    data: superAdmins.map((admin) => ({
      userId: admin.id,
      messageType: "system_announcement" as const,
      title: input.title,
      body: input.body,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId
    }))
  });
}

async function buildValidationAndChangeReport(
  tx: Prisma.TransactionClient,
  input: {
    city: string;
    rows: DataUploadRow[];
    uploadId: string;
  }
) {
  const salCodes = input.rows.map((row) => row.sal_code);
  const duplicateSalCodes = salCodes.filter(
    (salCode, index) => salCodes.indexOf(salCode) !== index
  );
  const uniqueSalCodes = Array.from(new Set(salCodes));

  const [suburbs, activeScoringRelease] = await Promise.all([
    tx.suburb.findMany({
      where: {
        city: input.city,
        activeFlag: true,
        salCode: { in: uniqueSalCodes }
      }
    }),
    tx.scoringRelease.findFirst({
      where: {
        status: "published",
        dataRelease: {
          city: input.city,
          status: "published"
        }
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { dataRelease: true }
    })
  ]);

  const suburbBySalCode = new Map(suburbs.map((suburb) => [suburb.salCode, suburb]));
  const unknownSalCodes = uniqueSalCodes.filter((salCode) => !suburbBySalCode.has(salCode));
  const currentRecords = activeScoringRelease
    ? await tx.suburbScoringRecord.findMany({
        where: { scoringReleaseId: activeScoringRelease.id },
        include: { suburb: true }
      })
    : [];
  const currentBySalCode = new Map(
    currentRecords.map((record) => [record.salCode, record])
  );
  const incomingBySalCode = new Map(input.rows.map((row) => [row.sal_code, row]));

  const changedRows: Array<{ sal_code: string; before: unknown; after: unknown }> = [];
  const addedRows: string[] = [];
  const removedRows: string[] = [];

  for (const row of input.rows) {
    const existing = currentBySalCode.get(row.sal_code);
    if (!existing) {
      addedRows.push(row.sal_code);
      continue;
    }

    if (stableStringify(rowComparable(row)) !== stableStringify(recordComparable(existing))) {
      changedRows.push({
        sal_code: row.sal_code,
        before: recordComparable(existing),
        after: rowComparable(row)
      });
    }
  }

  for (const record of currentRecords) {
    if (!incomingBySalCode.has(record.salCode)) {
      removedRows.push(record.salCode);
    }
  }

  const affectedSuburbIds = new Set<string>();
  for (const salCode of [...changedRows.map((row) => row.sal_code), ...addedRows, ...removedRows]) {
    const suburb = suburbBySalCode.get(salCode) ?? currentBySalCode.get(salCode)?.suburb;
    if (suburb) {
      affectedSuburbIds.add(suburb.id);
    }
  }

  const affectedPostcodes = affectedSuburbIds.size
    ? await tx.suburbPostcodeRelationship.findMany({
        where: {
          suburbId: { in: [...affectedSuburbIds] },
          selectableFlag: true
        },
        select: { postcodeId: true }
      })
    : [];

  const criticalWarnings = [
    ...(input.rows.length === 0 ? ["NO_ROWS"] : []),
    ...unknownSalCodes.map((salCode) => `UNKNOWN_SAL_CODE:${salCode}`),
    ...Array.from(new Set(duplicateSalCodes)).map((salCode) => `DUPLICATE_SAL_CODE:${salCode}`),
    ...(activeScoringRelease ? [] : ["NO_ACTIVE_SCORING_RELEASE_BASELINE"]),
    ...(removedRows.length ? [`REMOVED_ROWS:${removedRows.length}`] : []),
    ...input.rows
      .filter((row) => row.report_generation_allowed_flag === false)
      .map((row) => `REPORT_BLOCKED:${row.sal_code}`)
  ];
  const blockingErrors = [
    ...(input.rows.length === 0 ? ["Upload has no rows"] : []),
    ...unknownSalCodes.map((salCode) => `Unknown suburb SAL code: ${salCode}`),
    ...Array.from(new Set(duplicateSalCodes)).map((salCode) => `Duplicate SAL code: ${salCode}`)
  ];

  function currentRecordFor(salCode: string) {
    const record = currentBySalCode.get(salCode);
    if (!record) {
      throw new CommerceError("VALIDATION_ERROR", `Missing baseline scoring record for ${salCode}.`, 422);
    }

    return record;
  }

  const sampleDiffs = [
    ...changedRows.slice(0, 3),
    ...addedRows.slice(0, 2).map((salCode) => ({
      sal_code: salCode,
      before: null,
      after: rowComparable(incomingBySalCode.get(salCode) as DataUploadRow)
    })),
    ...removedRows.slice(0, 2).map((salCode) => ({
      sal_code: salCode,
      before: recordComparable(currentRecordFor(salCode)),
      after: null
    }))
  ].slice(0, 5);

  const validationReport = {
    status: blockingErrors.length ? "failed" : "passed",
    checked_at: new Date().toISOString(),
    required_columns: [
      "sal_code",
      "latest_year",
      "score_json",
      "prediction_json",
      "confidence_json",
      "report_generation_allowed_flag"
    ],
    row_count: input.rows.length,
    matched_suburbs_count: suburbs.length,
    unknown_sal_codes: unknownSalCodes,
    duplicate_sal_codes: Array.from(new Set(duplicateSalCodes)),
    blocking_errors: blockingErrors,
    active_baseline_release_key: activeScoringRelease?.releaseKey ?? null
  };
  const changeReport = {
    release_candidate_id: input.uploadId,
    changed_rows_count: changedRows.length,
    added_rows_count: addedRows.length,
    removed_rows_count: removedRows.length,
    affected_suburbs_count: affectedSuburbIds.size,
    affected_postcodes_count: new Set(affectedPostcodes.map((row) => row.postcodeId)).size,
    critical_warnings: criticalWarnings,
    sample_diffs: sampleDiffs
  };

  return {
    validationReport,
    changeReport,
    suburbBySalCode,
    blockingErrors
  };
}

async function createReleaseCandidate(
  tx: Prisma.TransactionClient,
  input: {
    uploadId: string;
    actor: DataReleaseActor;
    fileName: string;
    fileType: string;
    city: string;
    rows: DataUploadRow[];
    releaseKey?: string;
    scoringReleaseKey?: string;
    scoringTableVersion?: string;
    modelRegistryVersion: string;
  }
) {
  const analysis = await buildValidationAndChangeReport(tx, {
    city: input.city,
    rows: input.rows,
    uploadId: input.uploadId
  });

  if (analysis.blockingErrors.length > 0) {
    const failedUpload = await tx.dataUpload.update({
      where: { id: input.uploadId },
      data: {
        status: "failed",
        validationReportJson: jsonSafe(analysis.validationReport),
        changeReportJson: jsonSafe({
          status: "not_generated",
          reason: "Validation failed before change report approval.",
          ...analysis.changeReport
        })
      }
    });

    return {
      upload: failedUpload,
      validation_report: analysis.validationReport,
      change_report: analysis.changeReport,
      data_release: null,
      scoring_release: null
    };
  }

  const dataReleaseKey = input.releaseKey ?? releaseKey("data", input.city, input.uploadId);
  const scoringKey = input.scoringReleaseKey ?? releaseKey("scoring", input.city, input.uploadId);
  const scoringTableVersion = input.scoringTableVersion ?? scoringKey;
  const dataRelease = await tx.dataRelease.create({
    data: {
      releaseKey: dataReleaseKey,
      city: input.city,
      status: "awaiting_confirmation",
      sourceSummaryJson: jsonSafe({
        upload_id: input.uploadId,
        uploaded_by: input.actor.id,
        file_name: input.fileName,
        file_type: input.fileType,
        row_count: input.rows.length,
        validation_report: analysis.validationReport,
        change_report: analysis.changeReport
      })
    }
  });
  const scoringRelease = await tx.scoringRelease.create({
    data: {
      releaseKey: scoringKey,
      dataReleaseId: dataRelease.id,
      modelRegistryVersion: input.modelRegistryVersion,
      scoringTableVersion,
      status: "awaiting_confirmation"
    }
  });

  await tx.suburbScoringRecord.createMany({
    data: input.rows.map((row) => {
      const suburb = analysis.suburbBySalCode.get(row.sal_code);
      if (!suburb) {
        throw new CommerceError("VALIDATION_ERROR", `Unknown suburb SAL code: ${row.sal_code}`, 422);
      }

      return {
        scoringReleaseId: scoringRelease.id,
        suburbId: suburb.id,
        salCode: row.sal_code,
        latestYear: row.latest_year,
        scoreJson: jsonSafe(row.score_json),
        predictionJson: jsonSafe(row.prediction_json),
        confidenceJson: jsonSafe(row.confidence_json),
        reportGenerationAllowedFlag: row.report_generation_allowed_flag,
        reportBlockReason: row.report_block_reason ?? null
      };
    })
  });

  const upload = await tx.dataUpload.update({
    where: { id: input.uploadId },
    data: {
      status: "awaiting_confirmation",
      validationReportJson: jsonSafe(analysis.validationReport),
      changeReportJson: jsonSafe({
        status: "generated",
        data_release_id: dataRelease.id,
        scoring_release_id: scoringRelease.id,
        ...analysis.changeReport
      })
    }
  });

  return {
    upload,
    validation_report: analysis.validationReport,
    change_report: analysis.changeReport,
    data_release: dataRelease,
    scoring_release: scoringRelease
  };
}

export async function createDataUpload(input: z.infer<typeof dataUploadCreateSchema> & {
  actor: DataReleaseActor;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const upload = await tx.dataUpload.create({
      data: {
        uploadedBy: input.actor.id,
        fileName: input.file_name,
        fileType: input.file_type,
        status: "uploaded",
        validationReportJson: jsonSafe({
          status: input.rows ? "pending" : "manual_review_required",
          note: input.rows
            ? "Rows received and queued for inline validation."
            : "Upload metadata registered. Submit rows to validate and generate a release candidate."
        }),
        changeReportJson: jsonSafe({ status: "pending" })
      }
    });

    if (!input.rows) {
      return {
        upload,
        validation_report: upload.validationReportJson,
        change_report: upload.changeReportJson,
        data_release: null,
        scoring_release: null
      };
    }

    return createReleaseCandidate(tx, {
      uploadId: upload.id,
      actor: input.actor,
      fileName: input.file_name,
      fileType: input.file_type,
      city: input.city,
      rows: input.rows,
      releaseKey: input.release_key,
      scoringReleaseKey: input.scoring_release_key,
      scoringTableVersion: input.scoring_table_version,
      modelRegistryVersion: input.model_registry_version
    });
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_upload",
    targetType: "data_upload",
    targetId: result.upload.id,
    after: result,
    reason: input.reason
  });

  if (result.upload.status === "failed") {
    await notifySuperAdmins({
      title: "Data upload validation failed",
      body: `${input.file_name} failed validation and was not published. Previous approved scoring release remains active.`,
      relatedObjectType: "data_upload",
      relatedObjectId: result.upload.id
    });
  }

  return result;
}

export async function validateDataUpload(input: z.infer<typeof dataUploadValidateSchema> & {
  uploadId: string;
  actor: DataReleaseActor;
}) {
  const existing = await prisma.dataUpload.findUnique({ where: { id: input.uploadId } });
  if (!existing) {
    throw new CommerceError("VALIDATION_ERROR", "Data upload was not found.", 404);
  }

  if (existing.status === "awaiting_confirmation") {
    throw new CommerceError("VALIDATION_ERROR", "Upload already has a release candidate awaiting confirmation.", 422);
  }

  const result = await prisma.$transaction((tx) =>
    createReleaseCandidate(tx, {
      uploadId: existing.id,
      actor: input.actor,
      fileName: existing.fileName,
      fileType: existing.fileType,
      city: input.city,
      rows: input.rows,
      releaseKey: input.release_key,
      scoringReleaseKey: input.scoring_release_key,
      scoringTableVersion: input.scoring_table_version,
      modelRegistryVersion: input.model_registry_version
    })
  );

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_validate",
    targetType: "data_upload",
    targetId: existing.id,
    before: { status: existing.status },
    after: result,
    reason: input.reason
  });

  if (result.upload.status === "failed") {
    await notifySuperAdmins({
      title: "Data upload validation failed",
      body: `${existing.fileName} failed validation and was not published. Previous approved scoring release remains active.`,
      relatedObjectType: "data_upload",
      relatedObjectId: existing.id
    });
  }

  return result;
}

export async function publishDataRelease(input: {
  releaseId: string;
  actor: DataReleaseActor;
  reason: string;
}) {
  const existing = await prisma.dataRelease.findUnique({
    where: { id: input.releaseId },
    include: {
      scoringReleases: {
        include: {
          _count: { select: { scoringRows: true } }
        }
      }
    }
  });

  if (!existing) {
    throw new CommerceError("VALIDATION_ERROR", "Data release was not found.", 404);
  }

  if (existing.status !== "awaiting_confirmation") {
    throw new CommerceError("VALIDATION_ERROR", "Only releases awaiting confirmation can be published.", 422);
  }

  if (existing.scoringReleases.length === 0 || existing.scoringReleases.some((release) => release._count.scoringRows === 0)) {
    throw new CommerceError("VALIDATION_ERROR", "Release has no scoring rows to publish.", 422);
  }

  const activeBefore = await prisma.dataRelease.findFirst({
    where: {
      city: existing.city,
      status: "published"
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });

  const published = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const dataRelease = await tx.dataRelease.update({
      where: { id: existing.id },
      data: {
        status: "published",
        publishedAt: now,
        rolledBackAt: null
      }
    });

    await tx.scoringRelease.updateMany({
      where: { dataReleaseId: existing.id },
      data: {
        status: "published",
        publishedAt: now
      }
    });

    await tx.mapLayer.updateMany({
      where: { activeFlag: true },
      data: { releaseVersion: dataRelease.releaseKey }
    });

    return dataRelease;
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_publish",
    targetType: "data_release",
    targetId: published.id,
    before: { active_release_key: activeBefore?.releaseKey ?? null, status: existing.status },
    after: {
      active_release_key: published.releaseKey,
      scoring_releases_published: existing.scoringReleases.length
    },
    reason: input.reason
  });

  return {
    release: published,
    previous_active_release_key: activeBefore?.releaseKey ?? null,
    active_release_key: published.releaseKey
  };
}

export async function rollbackDataRelease(input: {
  releaseId: string;
  actor: DataReleaseActor;
  reason: string;
}) {
  const existing = await prisma.dataRelease.findUnique({
    where: { id: input.releaseId },
    include: {
      scoringReleases: true,
      _count: { select: { reportJobs: true } }
    }
  });

  if (!existing) {
    throw new CommerceError("VALIDATION_ERROR", "Data release was not found.", 404);
  }

  if (existing.status !== "published") {
    throw new CommerceError("VALIDATION_ERROR", "Only published releases can be rolled back.", 422);
  }

  const previous = await prisma.dataRelease.findFirst({
    where: {
      city: existing.city,
      status: "published",
      id: { not: existing.id }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });

  const rolledBack = await prisma.$transaction(async (tx) => {
    await tx.dataRelease.update({
      where: { id: existing.id },
      data: { status: "rollback_in_progress" }
    });
    await tx.scoringRelease.updateMany({
      where: { dataReleaseId: existing.id },
      data: { status: "rollback_in_progress" }
    });
    await tx.mapLayer.updateMany({
      where: { activeFlag: true },
      data: { releaseVersion: previous?.releaseKey ?? null }
    });
    await tx.scoringRelease.updateMany({
      where: { dataReleaseId: existing.id },
      data: { status: "rolled_back" }
    });

    return tx.dataRelease.update({
      where: { id: existing.id },
      data: {
        status: "rolled_back",
        rolledBackAt: new Date()
      }
    });
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_rollback",
    targetType: "data_release",
    targetId: rolledBack.id,
    before: {
      status: existing.status,
      release_key: existing.releaseKey,
      locked_report_jobs_retained: existing._count.reportJobs
    },
    after: {
      status: rolledBack.status,
      active_release_key: previous?.releaseKey ?? null,
      scoring_releases_rolled_back: existing.scoringReleases.length
    },
    reason: input.reason
  });

  return {
    release: rolledBack,
    active_release_key: previous?.releaseKey ?? null,
    generated_reports_retained: true
  };
}

export async function getDataQualityDashboard(city = "Sydney") {
  const active = await prisma.scoringRelease.findFirst({
    where: {
      status: "published",
      dataRelease: { city, status: "published" }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      dataRelease: true,
      scoringRows: true
    }
  });

  if (!active) {
    return {
      city,
      active_release_key: null,
      freshness: "manual_review_required",
      flags: { manual_review_required: 1 },
      row_count: 0,
      report_blocked_count: 0
    };
  }

  const ageDays = active.publishedAt
    ? Math.floor((Date.now() - active.publishedAt.getTime()) / 86_400_000)
    : null;
  const freshness =
    ageDays === null
      ? "manual_review_required"
      : ageDays > 365
        ? "severe_stale"
        : ageDays > 180
          ? "stale"
          : "fresh";
  const flags: Record<string, number> = { [freshness]: 1 };
  let reportBlockedCount = 0;

  for (const row of active.scoringRows) {
    for (const flag of qualityFlagsFromConfidence(row.confidenceJson)) {
      flags[flag] = (flags[flag] ?? 0) + 1;
    }

    if (!row.reportGenerationAllowedFlag) {
      reportBlockedCount += 1;
      flags.report_blocked = (flags.report_blocked ?? 0) + 1;
    }
  }

  return {
    city,
    active_release_key: active.dataRelease.releaseKey,
    active_scoring_release_key: active.releaseKey,
    published_at: active.publishedAt?.toISOString() ?? null,
    freshness,
    age_days: ageDays,
    flags,
    row_count: active.scoringRows.length,
    report_blocked_count: reportBlockedCount
  };
}
