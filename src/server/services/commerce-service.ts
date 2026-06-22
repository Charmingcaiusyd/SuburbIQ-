import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ApiErrorCode } from "@/domain/errors";
import {
  applyDiscount,
  calculateGstInclusiveCents,
  isCreditPackProduct,
  isReportProduct,
  isSubscriptionProduct,
  subscriptionMonths,
  type PaymentProviderKey
} from "@/domain/commerce";
import { canTransitionOrder, canTransitionPayment } from "@/domain/state-machines";
import { getActivePublishedScoringRelease } from "@/server/services/geography-service";
import { prisma } from "@/server/db/prisma";

export class CommerceError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 400,
    public details?: unknown
  ) {
    super(message);
  }
}

export const checkoutCreateSchema = z.object({
  product_id: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  product_type: z.string().optional(),
  productType: z.string().optional(),
  suburb_id: z.string().uuid().optional(),
  suburbId: z.string().uuid().optional(),
  postcode_id: z.string().uuid().optional(),
  postcodeId: z.string().uuid().optional(),
  coupon_code: z.string().trim().optional(),
  couponCode: z.string().trim().optional(),
  provider: z.enum(["stripe", "paypal", "card", "manual"]).default("stripe"),
  acknowledged_low_confidence_warning: z.boolean().optional(),
  acknowledgedLowConfidenceWarning: z.boolean().optional()
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1),
  product_id: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  amount_cents: z.number().int().min(0).optional(),
  amountCents: z.number().int().min(0).optional()
});

export const paymentWebhookSchema = z.object({
  payment_id: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  provider_payment_id: z.string().optional(),
  providerPaymentId: z.string().optional(),
  event_type: z
    .enum([
      "payment_confirmed",
      "payment_failed",
      "webhook_retrying",
      "manual_review_required",
      "refunded",
      "partially_refunded"
    ])
    .optional(),
  eventType: z
    .enum([
      "payment_confirmed",
      "payment_failed",
      "webhook_retrying",
      "manual_review_required",
      "refunded",
      "partially_refunded"
    ])
    .optional()
});

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

async function findProduct(input: z.infer<typeof checkoutCreateSchema>) {
  const productId = input.product_id ?? input.productId;
  const productType = input.product_type ?? input.productType;

  if (productId) {
    return prisma.product.findFirst({
      where: {
        id: productId,
        activeFlag: true
      }
    });
  }

  if (productType) {
    return prisma.product.findFirst({
      where: {
        productType,
        activeFlag: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  return null;
}

export async function validateCoupon(input: {
  code: string;
  productId?: string;
  amountCents?: number;
}) {
  const coupon = await prisma.coupon.findUnique({
    where: {
      code: normalizeCode(input.code)
    }
  });
  const now = new Date();

  if (
    !coupon ||
    !coupon.activeFlag ||
    (coupon.validFrom && coupon.validFrom > now) ||
    (coupon.validTo && coupon.validTo < now)
  ) {
    return {
      valid: false,
      code: normalizeCode(input.code),
      reason: "Coupon is invalid or expired."
    };
  }

  const amountCents =
    input.amountCents ??
    (input.productId
      ? (
          await prisma.product.findUnique({
            where: {
              id: input.productId
            }
          })
        )?.priceCents
      : 0) ??
    0;
  const discount = applyDiscount({
    amountCents,
    discountType: coupon.discountType,
    value: coupon.value
  });

  return {
    valid: true,
    code: coupon.code,
    discount_type: coupon.discountType,
    value: coupon.value,
    usage_limit: coupon.usageLimit,
    discount_cents: discount.discountCents,
    final_amount_cents: discount.finalAmountCents
  };
}

async function validateSelectedReportArea(input: {
  suburbId?: string;
  postcodeId?: string;
  acknowledgedLowConfidenceWarning?: boolean;
}) {
  if (!input.suburbId) {
    throw new CommerceError(
      "GEOGRAPHY_NOT_SELECTABLE",
      "A confirmed suburb is required for a single report checkout.",
      400
    );
  }

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
  const scoring = scoringRelease
    ? await prisma.suburbScoringRecord.findUnique({
        where: {
          scoringReleaseId_suburbId: {
            scoringReleaseId: scoringRelease.id,
            suburbId: relationship.suburbId
          }
        }
      })
    : null;

  if (!scoring?.reportGenerationAllowedFlag) {
    throw new CommerceError(
      "REPORT_BLOCKED",
      scoring?.reportBlockReason ?? "Report is unavailable for this suburb.",
      409
    );
  }

  const confidence = scoring.confidenceJson as Record<string, unknown>;
  const requiresLowConfidenceAck =
    confidence.low_confidence_warning_required === true ||
    confidence.lowConfidenceWarningRequired === true ||
    confidence.confidence_band === "low" ||
    confidence.confidenceBand === "low";

  if (requiresLowConfidenceAck && !input.acknowledgedLowConfidenceWarning) {
    throw new CommerceError(
      "LOW_CONFIDENCE_ACK_REQUIRED",
      "Low-confidence report warning must be acknowledged before checkout.",
      409
    );
  }

  return relationship;
}

export async function createCheckout(input: {
  userId: string;
  body: unknown;
}) {
  const parsed = checkoutCreateSchema.safeParse(input.body);

  if (!parsed.success) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      "Checkout request is invalid.",
      422,
      parsed.error.flatten()
    );
  }

  if (
    !parsed.data.product_id &&
    !parsed.data.productId &&
    !parsed.data.product_type &&
    !parsed.data.productType
  ) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      "product_id or product_type is required.",
      422
    );
  }

  const product = await findProduct(parsed.data);

  if (!product) {
    throw new CommerceError("VALIDATION_ERROR", "Active product was not found.", 422);
  }

  const suburbId = parsed.data.suburb_id ?? parsed.data.suburbId;
  const postcodeId = parsed.data.postcode_id ?? parsed.data.postcodeId;
  let selectedPostcodeId = postcodeId ?? null;

  if (isReportProduct(product.productType)) {
    const relationship = await validateSelectedReportArea({
      suburbId,
      postcodeId,
      acknowledgedLowConfidenceWarning:
        parsed.data.acknowledged_low_confidence_warning ??
        parsed.data.acknowledgedLowConfidenceWarning
    });
    selectedPostcodeId = relationship.postcodeId;
  }

  const couponCode = parsed.data.coupon_code ?? parsed.data.couponCode;
  const couponResult = couponCode
    ? await validateCoupon({
        code: couponCode,
        productId: product.id,
        amountCents: product.priceCents
      })
    : null;
  const finalAmountCents =
    couponResult?.valid === true
      ? couponResult.final_amount_cents
      : product.priceCents;
  const gstCents = product.gstInclusiveFlag
    ? calculateGstInclusiveCents(finalAmountCents)
    : 0;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: input.userId,
        productId: product.id,
        status: "pending_payment",
        selectedSuburbId: suburbId ?? null,
        selectedPostcodeId,
        amountCents: finalAmountCents,
        gstCents,
        currency: product.currency
      }
    });
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        userId: input.userId,
        provider: parsed.data.provider,
        providerPaymentId: `mock_${parsed.data.provider}_${order.id}`,
        status: finalAmountCents === 0 ? "payment_confirmed" : "payment_pending",
        rawEventJson: {
          checkout_provider: parsed.data.provider,
          coupon: couponResult,
          mock: true
        },
        amountCents: finalAmountCents
      }
    });

    return {
      order,
      payment
    };
  });

  if (finalAmountCents === 0) {
    await confirmPaymentAndGrantEntitlements({
      paymentId: result.payment.id,
      rawEvent: {
        event_type: "payment_confirmed",
        zero_amount_checkout: true
      }
    });
  }

  return {
    order_id: result.order.id,
    payment_id: result.payment.id,
    provider: parsed.data.provider,
    status: finalAmountCents === 0 ? "payment_confirmed" : result.payment.status,
    checkout_url:
      finalAmountCents === 0
        ? null
        : `https://payments.example.local/${parsed.data.provider}/checkout/${result.order.id}`,
    amount_cents: finalAmountCents,
    gst_cents: gstCents,
    currency: product.currency,
    coupon: couponResult,
    implementation: "mock_provider_database_order"
  };
}

function invoiceNumber(orderId: string) {
  return `INV-${orderId.slice(0, 8).toUpperCase()}`;
}

async function grantEntitlementForPaidOrder(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      product: true,
      invoices: true,
      reportCredits: true
    }
  });

  if (!order) {
    throw new CommerceError("VALIDATION_ERROR", "Order was not found.", 422);
  }

  if (order.invoices.length === 0) {
    await tx.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: invoiceNumber(order.id),
        businessName: "Sydney Property Data Platform",
        abn: "ABN_PLACEHOLDER",
        amountCents: order.amountCents,
        gstCents: order.gstCents,
        issuedAt: new Date()
      }
    });
  }

  if (isCreditPackProduct(order.product.productType) && order.reportCredits.length === 0) {
    await tx.reportCredit.createMany({
      data: Array.from({ length: 10 }, () => ({
        userId: order.userId,
        sourceOrderId: order.id,
        status: "available" as const
      }))
    });
  }

  if (isSubscriptionProduct(order.product.productType)) {
    const existingSubscription = await tx.subscription.findFirst({
      where: {
        userId: order.userId,
        productId: order.productId,
        status: "active",
        deletedAt: null
      }
    });

    if (!existingSubscription) {
      const start = new Date();
      const end = addMonths(start, subscriptionMonths(order.product.productType));
      await tx.subscription.create({
        data: {
          userId: order.userId,
          productId: order.productId,
          status: "active",
          billingPeriodStart: start,
          billingPeriodEnd: end,
          nextResetAt: addMonths(start, 1),
          reportsUsed: 0,
          reportsLimit: 30
        }
      });
    }
  }
}

export async function confirmPaymentAndGrantEntitlements(input: {
  paymentId: string;
  rawEvent?: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: input.paymentId
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new CommerceError("VALIDATION_ERROR", "Payment was not found.", 422);
    }

    if (!canTransitionPayment(payment.status, "payment_confirmed")) {
      if (payment.status !== "payment_confirmed") {
        throw new CommerceError(
          "VALIDATION_ERROR",
          `Cannot confirm payment from ${payment.status}.`,
          409
        );
      }
    }

    const updatedPayment =
      payment.status === "payment_confirmed"
        ? payment
        : await tx.payment.update({
            where: {
              id: payment.id
            },
            data: {
              status: "payment_confirmed",
              rawEventJson: input.rawEvent as Prisma.InputJsonValue
            }
          });

    if (payment.order.status !== "paid") {
      if (!canTransitionOrder(payment.order.status, "paid")) {
        throw new CommerceError(
          "VALIDATION_ERROR",
          `Cannot mark order paid from ${payment.order.status}.`,
          409
        );
      }

      await tx.order.update({
        where: {
          id: payment.orderId
        },
        data: {
          status: "paid"
        }
      });
    }

    await grantEntitlementForPaidOrder(tx, payment.orderId);

    return {
      payment_id: updatedPayment.id,
      order_id: payment.orderId,
      payment_status: "payment_confirmed",
      order_status: "paid"
    };
  });
}

export async function applyPaymentWebhook(input: {
  provider: PaymentProviderKey;
  body: unknown;
}) {
  const parsed = paymentWebhookSchema.safeParse(input.body);

  if (!parsed.success) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      "Webhook payload is invalid.",
      422,
      parsed.error.flatten()
    );
  }

  const paymentId = parsed.data.payment_id ?? parsed.data.paymentId;
  const orderId = parsed.data.order_id ?? parsed.data.orderId;
  const providerPaymentId =
    parsed.data.provider_payment_id ?? parsed.data.providerPaymentId;
  const eventType = parsed.data.event_type ?? parsed.data.eventType ?? "payment_confirmed";

  if (!paymentId && !orderId && !providerPaymentId) {
    throw new CommerceError(
      "VALIDATION_ERROR",
      "Webhook payload must include payment_id, order_id or provider_payment_id.",
      422
    );
  }

  const payment = await prisma.payment.findFirst({
    where: {
      provider: input.provider,
      OR: [
        paymentId ? { id: paymentId } : undefined,
        orderId ? { orderId } : undefined,
        providerPaymentId ? { providerPaymentId } : undefined
      ].filter(Boolean) as Prisma.PaymentWhereInput[]
    }
  });

  if (!payment) {
    throw new CommerceError("VALIDATION_ERROR", "Matching payment was not found.", 422);
  }

  if (eventType === "payment_confirmed") {
    return confirmPaymentAndGrantEntitlements({
      paymentId: payment.id,
      rawEvent: input.body
    });
  }

  return prisma.$transaction(async (tx) => {
    if (!canTransitionPayment(payment.status, eventType)) {
      throw new CommerceError(
        "VALIDATION_ERROR",
        `Cannot transition payment from ${payment.status} to ${eventType}.`,
        409
      );
    }

    const updatedPayment = await tx.payment.update({
      where: {
        id: payment.id
      },
      data: {
        status: eventType,
        rawEventJson: input.body as Prisma.InputJsonValue
      }
    });

    const orderStatus =
      eventType === "payment_failed"
        ? "failed"
        : eventType === "manual_review_required"
          ? "manual_review_required"
          : eventType === "refunded"
            ? "refunded"
            : eventType === "partially_refunded"
              ? "partially_refunded"
              : null;

    if (orderStatus) {
      const order = await tx.order.findUniqueOrThrow({
        where: {
          id: payment.orderId
        }
      });

      if (canTransitionOrder(order.status, orderStatus)) {
        await tx.order.update({
          where: {
            id: order.id
          },
          data: {
            status: orderStatus
          }
        });
      }
    }

    return {
      payment_id: updatedPayment.id,
      order_id: updatedPayment.orderId,
      payment_status: updatedPayment.status
    };
  });
}

export function toCommerceErrorResponse(error: unknown) {
  if (error instanceof CommerceError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details
    };
  }

  return {
    code: "VALIDATION_ERROR" as const,
    message: "Commerce operation failed.",
    status: 500,
    details: error instanceof Error ? error.message : error
  };
}
