export const PRODUCT_TYPES = [
  "single_report",
  "ten_credit_pack",
  "subscription_1m",
  "subscription_6m",
  "subscription_12m"
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PAYMENT_PROVIDERS = ["stripe", "paypal", "card", "manual"] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number];

export function isReportProduct(productType: string) {
  return productType === "single_report";
}

export function isCreditPackProduct(productType: string) {
  return productType === "ten_credit_pack";
}

export function isSubscriptionProduct(productType: string) {
  return productType.startsWith("subscription_");
}

export function subscriptionMonths(productType: string) {
  if (productType === "subscription_6m") return 6;
  if (productType === "subscription_12m") return 12;
  return 1;
}

export function calculateGstInclusiveCents(amountCents: number) {
  return Math.round(amountCents / 11);
}

export function applyDiscount(input: {
  amountCents: number;
  discountType?: string | null;
  value?: number | null;
}) {
  const amountCents = Math.max(input.amountCents, 0);

  if (!input.discountType || input.value == null) {
    return {
      discountCents: 0,
      finalAmountCents: amountCents
    };
  }

  const normalizedType = input.discountType.toLowerCase();
  const discountCents =
    normalizedType === "percent"
      ? Math.round(amountCents * (Math.min(Math.max(input.value, 0), 100) / 100))
      : normalizedType === "fixed_cents"
        ? Math.max(input.value, 0)
        : normalizedType === "free"
          ? amountCents
          : 0;

  return {
    discountCents: Math.min(discountCents, amountCents),
    finalAmountCents: Math.max(amountCents - discountCents, 0)
  };
}
