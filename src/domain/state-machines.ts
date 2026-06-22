import type {
  CreditStatus,
  DataReleaseStatus,
  OrderStatus,
  PaymentStatus,
  ReportJobStatus
} from "./enums";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

function canTransition<T extends string>(
  map: TransitionMap<T>,
  from: T,
  to: T
) {
  return from === to || map[from]?.includes(to) === true;
}

export const reportJobTransitions: TransitionMap<ReportJobStatus> = {
  queued: ["processing"],
  processing: ["llm_generation_started", "failed"],
  llm_generation_started: ["rendering_html", "llm_retry_1"],
  llm_retry_1: ["rendering_html", "llm_retry_2"],
  llm_retry_2: ["rendering_html", "llm_retry_3"],
  llm_retry_3: ["rendering_html", "fallback_template_used"],
  fallback_template_used: ["rendering_html", "failed"],
  rendering_html: ["rendering_pdf"],
  rendering_pdf: ["completed"],
  completed: [],
  failed: ["refund_started", "credit_released", "quota_restored"],
  refund_started: [],
  credit_released: [],
  quota_restored: []
};

export const creditTransitions: TransitionMap<CreditStatus> = {
  available: ["held", "expired", "admin_adjusted"],
  held: ["captured", "released", "admin_adjusted"],
  captured: ["admin_adjusted"],
  released: ["held", "admin_adjusted"],
  expired: ["admin_adjusted"],
  admin_adjusted: ["available", "held", "captured", "released", "expired"]
};

export const paymentTransitions: TransitionMap<PaymentStatus> = {
  payment_pending: ["webhook_retrying", "payment_confirmed", "payment_failed"],
  webhook_retrying: ["payment_confirmed", "manual_review_required", "payment_failed"],
  payment_confirmed: ["refunded", "partially_refunded"],
  payment_failed: ["manual_review_required"],
  manual_review_required: ["payment_confirmed", "payment_failed"],
  refunded: [],
  partially_refunded: ["refunded"]
};

export const orderTransitions: TransitionMap<OrderStatus> = {
  pending_payment: ["paid", "manual_review_required", "failed"],
  paid: ["report_generating", "refunded", "partially_refunded"],
  report_generating: ["completed", "failed"],
  completed: ["refunded", "partially_refunded"],
  failed: ["refunded"],
  refunded: [],
  partially_refunded: ["refunded"],
  manual_review_required: ["paid", "failed"]
};

export const dataReleaseTransitions: TransitionMap<DataReleaseStatus> = {
  draft: ["uploaded", "failed"],
  uploaded: ["validated", "failed"],
  validated: ["change_report_generated", "failed"],
  change_report_generated: ["awaiting_confirmation", "failed"],
  awaiting_confirmation: ["published", "failed"],
  published: ["rollback_in_progress"],
  rollback_in_progress: ["rolled_back", "failed"],
  rolled_back: [],
  failed: []
};

export function canTransitionReportJob(from: ReportJobStatus, to: ReportJobStatus) {
  return canTransition(reportJobTransitions, from, to);
}

export function canTransitionCredit(from: CreditStatus, to: CreditStatus) {
  return canTransition(creditTransitions, from, to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return canTransition(paymentTransitions, from, to);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return canTransition(orderTransitions, from, to);
}

export function canTransitionDataRelease(
  from: DataReleaseStatus,
  to: DataReleaseStatus
) {
  return canTransition(dataReleaseTransitions, from, to);
}
