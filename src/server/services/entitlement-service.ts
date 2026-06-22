import { prisma } from "@/server/db/prisma";

function iso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function getUserOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      deletedAt: null
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      product: true,
      selectedSuburb: true,
      selectedPostcode: true,
      payments: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      },
      invoices: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      },
      reportJobs: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    product: {
      id: order.product.id,
      product_type: order.product.productType,
      name: order.product.name
    },
    selected_area: order.selectedSuburb
      ? {
          suburb_id: order.selectedSuburb.id,
          sal_code: order.selectedSuburb.salCode,
          sal_name: order.selectedSuburb.salName,
          postcode_id: order.selectedPostcode?.id ?? null,
          postcode: order.selectedPostcode?.postcode ?? null
        }
      : null,
    amount_cents: order.amountCents,
    gst_cents: order.gstCents,
    currency: order.currency,
    latest_payment_status: order.payments[0]?.status ?? null,
    latest_invoice_number: order.invoices[0]?.invoiceNumber ?? null,
    latest_report_job: order.reportJobs[0]
      ? {
          id: order.reportJobs[0].id,
          status: order.reportJobs[0].status
        }
      : null,
    created_at: order.createdAt.toISOString()
  }));
}

export async function getUserCreditSummary(userId: string) {
  const credits = await prisma.reportCredit.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const counts = credits.reduce<Record<string, number>>((summary, credit) => {
    summary[credit.status] = (summary[credit.status] ?? 0) + 1;
    return summary;
  }, {});

  return {
    counts: {
      available: counts.available ?? 0,
      held: counts.held ?? 0,
      captured: counts.captured ?? 0,
      released: counts.released ?? 0,
      expired: counts.expired ?? 0,
      admin_adjusted: counts.admin_adjusted ?? 0
    },
    credits: credits.map((credit) => ({
      id: credit.id,
      status: credit.status,
      source_order_id: credit.sourceOrderId,
      held_by_report_job_id: credit.heldByReportJobId,
      captured_by_report_id: credit.capturedByReportId,
      expires_at: iso(credit.expiresAt),
      created_at: credit.createdAt.toISOString(),
      updated_at: credit.updatedAt.toISOString()
    }))
  };
}

export async function getUserSubscriptionSummary(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      deletedAt: null
    },
    orderBy: {
      billingPeriodEnd: "desc"
    },
    include: {
      product: true
    }
  });

  return {
    active: subscriptions
      .filter((subscription) => subscription.status === "active")
      .map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        product: {
          id: subscription.product.id,
          product_type: subscription.product.productType,
          name: subscription.product.name
        },
        billing_period_start: subscription.billingPeriodStart.toISOString(),
        billing_period_end: subscription.billingPeriodEnd.toISOString(),
        reports_used: subscription.reportsUsed,
        reports_limit: subscription.reportsLimit,
        reports_remaining: Math.max(
          subscription.reportsLimit - subscription.reportsUsed,
          0
        ),
        next_reset_at: subscription.nextResetAt.toISOString()
      })),
    history: subscriptions.map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      product_type: subscription.product.productType,
      billing_period_start: subscription.billingPeriodStart.toISOString(),
      billing_period_end: subscription.billingPeriodEnd.toISOString(),
      reports_used: subscription.reportsUsed,
      reports_limit: subscription.reportsLimit,
      next_reset_at: subscription.nextResetAt.toISOString()
    }))
  };
}

export async function getUserEntitlementSummary(userId: string) {
  const [orders, credits, subscriptions] = await Promise.all([
    getUserOrders(userId),
    getUserCreditSummary(userId),
    getUserSubscriptionSummary(userId)
  ]);

  return {
    orders,
    credits,
    subscriptions
  };
}
