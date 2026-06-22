import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calculateGstInclusiveCents } from "@/domain/commerce";
import { prisma } from "@/server/db/prisma";
import { writeAuditLog } from "@/server/services/audit-service";
import { CommerceError } from "@/server/services/commerce-service";

type AdminActor = {
  id: string;
  role: "admin" | "super_admin";
};

export function adminActor(user: { id: string; role: string }): AdminActor {
  return {
    id: user.id,
    role: user.role === "super_admin" ? "super_admin" : "admin"
  };
}

export const reasonSchema = z.object({
  reason: z.string().trim().min(3)
});

export const creditAdjustSchema = reasonSchema.extend({
  quantity: z.coerce.number().int().min(1).max(100).default(1)
});

export const subscriptionExtendSchema = reasonSchema.extend({
  days: z.coerce.number().int().min(1).max(730)
});

export const supportReplySchema = z.object({
  message: z.string().trim().min(1),
  close: z.boolean().optional()
});

export const couponCreateSchema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  discount_type: z.enum(["percent", "fixed_cents", "free"]),
  value: z.coerce.number().int().min(0),
  usage_limit: z.coerce.number().int().min(1).optional(),
  active_flag: z.boolean().default(true),
  reason: z.string().trim().min(3)
});

export const templateUpdateSchema = z.object({
  template_json: z.unknown().optional(),
  active_flag: z.boolean().optional(),
  reason: z.string().trim().min(3)
});

export const predictionDisplaySchema = z.object({
  indicators: z.record(z.boolean()),
  reason: z.string().trim().min(3)
});

export async function getAdminDashboard() {
  const [
    users,
    orders,
    pendingPayments,
    failedJobs,
    openTickets,
    reports,
    dataReleases
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.payment.count({ where: { status: { in: ["payment_pending", "webhook_retrying", "manual_review_required"] } } }),
    prisma.reportJob.count({ where: { status: "failed" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "waiting_admin", "escalated"] } } }),
    prisma.report.count(),
    prisma.dataRelease.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  return {
    kpis: {
      users,
      orders,
      pending_payments: pendingPayments,
      failed_report_jobs: failedJobs,
      open_support_tickets: openTickets,
      reports
    },
    recent_data_releases: dataReleases.map((release) => ({
      id: release.id,
      release_key: release.releaseKey,
      city: release.city,
      status: release.status,
      published_at: release.publishedAt?.toISOString() ?? null
    }))
  };
}

export async function searchAdminUsers(query?: string) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            email: {
              contains: query,
              mode: "insensitive"
            }
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      profiles: { where: { activeFlag: true, deletedAt: null }, take: 1 },
      reportCredits: true,
      subscriptions: true
    }
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.createdAt.toISOString(),
    profile_score: user.profiles[0]?.completenessScore ?? null,
    credits_total: user.reportCredits.length,
    active_subscriptions: user.subscriptions.filter((sub) => sub.status === "active").length
  }));
}

export async function getAdminUserProfile(input: {
  userId: string;
  actor: AdminActor;
  ipAddress?: string | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      profiles: { orderBy: { updatedAt: "desc" } },
      profileSnapshots: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });

  if (!user) {
    throw new CommerceError("VALIDATION_ERROR", "User was not found.", 404);
  }

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "profile_access",
    targetType: "user",
    targetId: user.id,
    reason: "Admin viewed full profile questionnaire.",
    ipAddress: input.ipAddress ?? undefined
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    profiles: user.profiles,
    snapshots: user.profileSnapshots
  };
}

export async function listAdminOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: true,
      product: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  return orders.map((order) => ({
    id: order.id,
    user_email: order.user.email,
    product_type: order.product.productType,
    product_name: order.product.name,
    status: order.status,
    payment_status: order.payments[0]?.status ?? null,
    amount_cents: order.amountCents,
    gst_cents: order.gstCents,
    created_at: order.createdAt.toISOString()
  }));
}

export async function refundOrder(input: {
  orderId: string;
  actor: AdminActor;
  reason: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payments: true }
  });

  if (!order) {
    throw new CommerceError("VALIDATION_ERROR", "Order was not found.", 404);
  }

  const before = { status: order.status, payments: order.payments.map((p) => p.status) };
  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: "refunded" }
    });

    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: { status: "refunded" }
    });

    return updatedOrder;
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "refund",
    targetType: "order",
    targetId: order.id,
    before,
    after: { status: updated.status },
    reason: input.reason
  });

  return { order_id: updated.id, status: updated.status };
}

export async function addUserCredits(input: {
  userId: string;
  actor: AdminActor;
  quantity: number;
  reason: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new CommerceError("VALIDATION_ERROR", "User was not found.", 404);

  await prisma.reportCredit.createMany({
    data: Array.from({ length: input.quantity }, () => ({
      userId: user.id,
      status: "available" as const
    }))
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "credit_adjustment",
    targetType: "user",
    targetId: user.id,
    after: { quantity: input.quantity },
    reason: input.reason
  });

  return { user_id: user.id, credits_added: input.quantity };
}

export async function extendSubscription(input: {
  subscriptionId: string;
  actor: AdminActor;
  days: number;
  reason: string;
}) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: input.subscriptionId }
  });
  if (!subscription) throw new CommerceError("VALIDATION_ERROR", "Subscription was not found.", 404);

  const nextEnd = new Date(subscription.billingPeriodEnd);
  nextEnd.setDate(nextEnd.getDate() + input.days);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "active",
      billingPeriodEnd: nextEnd
    }
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "subscription_extension",
    targetType: "subscription",
    targetId: subscription.id,
    before: { billing_period_end: subscription.billingPeriodEnd },
    after: { billing_period_end: updated.billingPeriodEnd },
    reason: input.reason
  });

  return { subscription_id: updated.id, status: updated.status, billing_period_end: updated.billingPeriodEnd.toISOString() };
}

export async function listReportJobs() {
  const jobs = await prisma.reportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, suburb: true }
  });
  return jobs.map((job) => ({
    id: job.id,
    user_email: job.user.email,
    suburb: job.suburb.salName,
    status: job.status,
    attempts: job.attempts,
    fallback_used: job.fallbackUsedFlag,
    created_at: job.createdAt.toISOString()
  }));
}

export async function resendReportLink(input: {
  reportId: string;
  actor: AdminActor;
  reason: string;
}) {
  const report = await prisma.report.findUnique({
    where: { id: input.reportId },
    include: { user: true }
  });

  if (!report) throw new CommerceError("VALIDATION_ERROR", "Report was not found.", 404);

  await prisma.inboxMessage.create({
    data: {
      userId: report.userId,
      messageType: "admin_reply",
      title: "Your SuburbIQ report link",
      body: `Admin resent your report link for ${report.title}.`,
      relatedObjectType: "report",
      relatedObjectId: report.id
    }
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "report_resend",
    targetType: "report",
    targetId: report.id,
    after: { recipient: report.user.email },
    reason: input.reason
  });

  return { report_id: report.id, resent: true };
}

export async function listSupportTickets() {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } }
  });
  return tickets.map((ticket) => ({
    id: ticket.id,
    user_email: ticket.user.email,
    category: ticket.category,
    status: ticket.status,
    subject: ticket.subject,
    message: ticket.message,
    messages_count: ticket.messages.length,
    created_at: ticket.createdAt.toISOString()
  }));
}

export async function replyToSupportTicket(input: {
  ticketId: string;
  actor: AdminActor;
  message: string;
  close?: boolean;
}) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw new CommerceError("VALIDATION_ERROR", "Support ticket was not found.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: input.actor.id,
        message: input.message
      }
    });
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: input.close ? "closed" : "waiting_user" }
    });
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "support_reply",
    targetType: "support_ticket",
    targetId: ticket.id,
    after: { close: input.close === true },
    reason: input.message.slice(0, 200)
  });

  return { ticket_id: ticket.id, status: input.close ? "closed" : "waiting_user" };
}

export async function createCoupon(input: z.infer<typeof couponCreateSchema> & { actor: AdminActor }) {
  const coupon = await prisma.coupon.upsert({
    where: { code: input.code },
    update: {
      discountType: input.discount_type,
      value: input.value,
      usageLimit: input.usage_limit ?? null,
      activeFlag: input.active_flag
    },
    create: {
      code: input.code,
      discountType: input.discount_type,
      value: input.value,
      usageLimit: input.usage_limit ?? null,
      activeFlag: input.active_flag
    }
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "coupon_create",
    targetType: "coupon",
    targetId: coupon.id,
    after: coupon,
    reason: input.reason
  });

  return coupon;
}

export async function listDataReleases() {
  const [dataReleases, scoringReleases] = await Promise.all([
    prisma.dataRelease.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.scoringRelease.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return { data_releases: dataReleases, scoring_releases: scoringReleases };
}

export async function createDataUpload(input: {
  actor: AdminActor;
  fileName: string;
  fileType: string;
  reason: string;
}) {
  const upload = await prisma.dataUpload.create({
    data: {
      uploadedBy: input.actor.id,
      fileName: input.fileName,
      fileType: input.fileType,
      status: "uploaded",
      validationReportJson: {
        status: "pending",
        note: "Phase 7 admin upload placeholder. Validation worker is Phase 8."
      },
      changeReportJson: {
        status: "pending"
      }
    }
  });

  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_upload",
    targetType: "data_upload",
    targetId: upload.id,
    after: upload,
    reason: input.reason
  });

  return upload;
}

export async function publishDataRelease(input: { releaseId: string; actor: AdminActor; reason: string }) {
  const release = await prisma.dataRelease.update({
    where: { id: input.releaseId },
    data: { status: "published", publishedAt: new Date() }
  });
  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_publish",
    targetType: "data_release",
    targetId: release.id,
    after: release,
    reason: input.reason
  });
  return release;
}

export async function rollbackDataRelease(input: { releaseId: string; actor: AdminActor; reason: string }) {
  const release = await prisma.dataRelease.update({
    where: { id: input.releaseId },
    data: { status: "rolled_back", rolledBackAt: new Date() }
  });
  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "data_rollback",
    targetType: "data_release",
    targetId: release.id,
    after: release,
    reason: input.reason
  });
  return release;
}

export async function updateReportTemplate(input: {
  templateId: string;
  actor: AdminActor;
  body: z.infer<typeof templateUpdateSchema>;
}) {
  const template = await prisma.reportTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw new CommerceError("VALIDATION_ERROR", "Template was not found.", 404);

  const updated = await prisma.reportTemplate.update({
    where: { id: template.id },
    data: {
      templateJson: input.body.template_json as Prisma.InputJsonValue | undefined,
      activeFlag: input.body.active_flag ?? template.activeFlag
    }
  });
  await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "template_update",
    targetType: "report_template",
    targetId: template.id,
    before: template,
    after: updated,
    reason: input.body.reason
  });
  return updated;
}

export async function updatePredictionDisplay(input: {
  actor: AdminActor;
  body: z.infer<typeof predictionDisplaySchema>;
}) {
  const log = await writeAuditLog({
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    actionType: "setting_update",
    targetType: "prediction_display",
    after: input.body.indicators,
    reason: input.body.reason
  });

  return { saved: true, audit_log: log };
}

export async function listAuditLogs() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: true }
  });
  return logs.map((log) => ({
    id: log.id,
    actor_email: log.actor?.email ?? null,
    actor_role: log.actorRole,
    action_type: log.actionType,
    target_type: log.targetType,
    target_id: log.targetId,
    reason: log.reason,
    created_at: log.createdAt.toISOString()
  }));
}

export async function listAdminCredits() {
  const credits = await prisma.reportCredit.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: true,
      sourceOrder: true,
      heldByReportJob: true,
      capturedByReport: true
    }
  });

  return credits.map((credit) => ({
    id: credit.id,
    user_email: credit.user.email,
    status: credit.status,
    source_order_id: credit.sourceOrderId,
    held_by_report_job_id: credit.heldByReportJobId,
    captured_by_report_id: credit.capturedByReportId,
    expires_at: credit.expiresAt?.toISOString() ?? null,
    created_at: credit.createdAt.toISOString()
  }));
}

export async function listAdminSubscriptions() {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, product: true }
  });

  return subscriptions.map((subscription) => ({
    id: subscription.id,
    user_email: subscription.user.email,
    product_name: subscription.product.name,
    status: subscription.status,
    reports_used: subscription.reportsUsed,
    reports_limit: subscription.reportsLimit,
    billing_period_end: subscription.billingPeriodEnd.toISOString(),
    next_reset_at: subscription.nextResetAt.toISOString()
  }));
}

export async function listAdminReports() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, suburb: true, reportJob: true, files: true }
  });

  return reports.map((report) => ({
    id: report.id,
    title: report.title,
    user_email: report.user.email,
    suburb: report.suburb.salName,
    status: report.status,
    job_status: report.reportJob.status,
    files_count: report.files.length,
    generated_at: report.generatedAt?.toISOString() ?? null,
    created_at: report.createdAt.toISOString()
  }));
}

export async function listAdminCoupons() {
  return prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function listAdminDataUploads() {
  const uploads = await prisma.dataUpload.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: true }
  });

  return uploads.map((upload) => ({
    id: upload.id,
    uploaded_by: upload.actor.email,
    file_name: upload.fileName,
    file_type: upload.fileType,
    status: upload.status,
    created_at: upload.createdAt.toISOString()
  }));
}

export async function listAdminReportTemplates() {
  return prisma.reportTemplate.findMany({
    orderBy: [{ activeFlag: "desc" }, { updatedAt: "desc" }],
    take: 100
  });
}

export function gstPreview(amountCents: number) {
  return calculateGstInclusiveCents(amountCents);
}
