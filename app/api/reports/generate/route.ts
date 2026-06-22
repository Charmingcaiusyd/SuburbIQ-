import type { NextRequest } from "next/server";
import { apiCreated } from "@/server/api/response";
import { mockCreateReportJob, mockQueueAdapter } from "@/server/services/mock-services";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await mockCreateReportJob({
    userId: body.user_id ?? body.userId ?? "stub-user",
    entitlementType: body.entitlement_type ?? body.entitlementType ?? "credit",
    suburbId: body.suburb_id ?? body.suburbId,
    postcodeId: body.postcode_id ?? body.postcodeId,
    creditId: body.credit_id ?? body.creditId,
    orderId: body.order_id ?? body.orderId,
    acknowledgedLowConfidenceWarning:
      body.acknowledged_low_confidence_warning ??
      body.acknowledgedLowConfidenceWarning
  });

  await mockQueueAdapter.enqueueReportJob(result.reportJobId);

  return apiCreated({
    report_job_id: result.reportJobId,
    status: result.status,
    entitlement_hold_status: result.entitlementHoldStatus,
    estimated_stage: "queued",
    implementation: "stub"
  });
}
