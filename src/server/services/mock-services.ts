import type {
  CheckoutRequest,
  CheckoutSession,
  LlmReportGenerator,
  MapProvider,
  PaymentProvider,
  QueueAdapter,
  ReportGenerationRequest,
  ReportGenerationResult,
  StorageAdapter
} from "./interfaces";

const stubUuid = "00000000-0000-4000-8000-000000000000";

export const mockPaymentProvider: PaymentProvider = {
  async createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession> {
    return {
      orderId: request.productId || stubUuid,
      provider: "stripe",
      status: "payment_pending",
      checkoutUrl: "https://payments.example.local/stub-checkout"
    };
  },
  async verifyWebhook() {
    return true;
  }
};

export const mockLlmReportGenerator: LlmReportGenerator = {
  async generateNarrative() {
    return {
      output: {
        sections: [],
        note: "Mock LLM narrative. Real OpenAI integration starts in Phase 6."
      },
      valid: true
    };
  },
  async generateFallback() {
    return {
      output: {
        sections: [],
        note: "Deterministic fallback report stub."
      },
      valid: true
    };
  }
};

export const mockQueueAdapter: QueueAdapter = {
  async enqueueReportJob() {
    return;
  }
};

export const mockStorageAdapter: StorageAdapter = {
  async putReportFile(key: string) {
    return {
      url: `s3://stub-bucket/${key}`
    };
  }
};

export const mockMapProvider: MapProvider = {
  async getLayerMetadata(entitlement) {
    return [
      {
        layerKey: "base_map",
        layerType: "mapbox",
        accessTier: "public",
        enabled: true
      },
      {
        layerKey: "growth_prediction",
        layerType: "deck_gl",
        accessTier: "paid",
        enabled: entitlement === "paid"
      }
    ];
  }
};

export async function mockCreateReportJob(
  request: ReportGenerationRequest
): Promise<ReportGenerationResult> {
  const entitlementHoldStatus =
    request.entitlementType === "credit"
      ? "held"
      : request.entitlementType === "subscription"
        ? "quota_held"
        : "order_held";

  return {
    reportJobId: stubUuid,
    status: "queued",
    entitlementHoldStatus
  };
}
