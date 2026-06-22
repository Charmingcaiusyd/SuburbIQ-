import type {
  CreditStatus,
  EntitlementType,
  PaymentStatus,
  ReportJobStatus
} from "@/domain/enums";

export type CheckoutRequest = {
  userId: string;
  productId: string;
  suburbId?: string;
  postcodeId?: string;
  couponCode?: string;
};

export type CheckoutSession = {
  orderId: string;
  provider: "stripe" | "paypal" | "manual";
  status: PaymentStatus;
  checkoutUrl: string;
};

export type ReportGenerationRequest = {
  userId: string;
  entitlementType: EntitlementType;
  suburbId: string;
  postcodeId?: string;
  creditId?: string;
  orderId?: string;
  acknowledgedLowConfidenceWarning?: boolean;
};

export type ReportGenerationResult = {
  reportJobId: string;
  status: ReportJobStatus;
  entitlementHoldStatus: CreditStatus | "quota_held" | "order_held";
};

export interface PaymentProvider {
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(payload: unknown, signature: string | null): Promise<boolean>;
}

export interface LlmReportGenerator {
  generateNarrative(context: unknown): Promise<{ output: unknown; valid: boolean }>;
  generateFallback(context: unknown): Promise<{ output: unknown; valid: boolean }>;
}

export interface QueueAdapter {
  enqueueReportJob(reportJobId: string): Promise<void>;
}

export interface StorageAdapter {
  putReportFile(key: string, content: string | Buffer): Promise<{ url: string }>;
}

export interface MapProvider {
  getLayerMetadata(entitlement: "public" | "free" | "paid"): Promise<unknown[]>;
}
