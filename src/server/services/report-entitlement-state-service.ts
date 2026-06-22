import { canTransitionCredit } from "@/domain/state-machines";
import { prisma } from "@/server/db/prisma";
import { CommerceError } from "./commerce-service";

export async function holdReportCredit(input: {
  userId: string;
  creditId: string;
  reportJobId: string;
}) {
  const credit = await prisma.reportCredit.findFirst({
    where: {
      id: input.creditId,
      userId: input.userId
    }
  });

  if (!credit) {
    throw new CommerceError("NO_REPORT_ENTITLEMENT", "Report credit was not found.", 402);
  }

  if (!canTransitionCredit(credit.status, "held")) {
    throw new CommerceError(
      "NO_REPORT_ENTITLEMENT",
      `Credit cannot be held from ${credit.status}.`,
      402
    );
  }

  return prisma.reportCredit.update({
    where: {
      id: credit.id
    },
    data: {
      status: "held",
      heldByReportJobId: input.reportJobId
    }
  });
}

export async function captureHeldReportCredit(input: {
  userId: string;
  creditId: string;
  reportId: string;
}) {
  const credit = await prisma.reportCredit.findFirst({
    where: {
      id: input.creditId,
      userId: input.userId,
      status: "held"
    }
  });

  if (!credit || !canTransitionCredit("held", "captured")) {
    throw new CommerceError("NO_REPORT_ENTITLEMENT", "Held credit was not found.", 402);
  }

  return prisma.reportCredit.update({
    where: {
      id: credit.id
    },
    data: {
      status: "captured",
      capturedByReportId: input.reportId
    }
  });
}

export async function releaseHeldReportCredit(input: {
  userId: string;
  creditId: string;
}) {
  const credit = await prisma.reportCredit.findFirst({
    where: {
      id: input.creditId,
      userId: input.userId,
      status: "held"
    }
  });

  if (!credit || !canTransitionCredit("held", "released")) {
    throw new CommerceError("NO_REPORT_ENTITLEMENT", "Held credit was not found.", 402);
  }

  return prisma.reportCredit.update({
    where: {
      id: credit.id
    },
    data: {
      status: "released",
      heldByReportJobId: null
    }
  });
}

export async function findUsableSubscription(userId: string) {
  const now = new Date();

  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      status: "active",
      deletedAt: null,
      billingPeriodStart: {
        lte: now
      },
      billingPeriodEnd: {
        gt: now
      }
    },
    orderBy: {
      billingPeriodEnd: "asc"
    }
  });

  return (
    subscriptions.find(
      (subscription) => subscription.reportsUsed < subscription.reportsLimit
    ) ?? null
  );
}

export async function captureSubscriptionQuota(input: {
  userId: string;
  subscriptionId: string;
}) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: input.subscriptionId,
      userId: input.userId,
      status: "active",
      deletedAt: null
    }
  });

  if (!subscription || subscription.reportsUsed >= subscription.reportsLimit) {
    throw new CommerceError(
      "NO_REPORT_ENTITLEMENT",
      "No active subscription quota is available.",
      402
    );
  }

  return prisma.subscription.update({
    where: {
      id: subscription.id
    },
    data: {
      reportsUsed: {
        increment: 1
      }
    }
  });
}

export async function restoreSubscriptionQuota(input: {
  userId: string;
  subscriptionId: string;
}) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: input.subscriptionId,
      userId: input.userId
    }
  });

  if (!subscription || subscription.reportsUsed <= 0) {
    return subscription;
  }

  return prisma.subscription.update({
    where: {
      id: subscription.id
    },
    data: {
      reportsUsed: {
        decrement: 1
      }
    }
  });
}
