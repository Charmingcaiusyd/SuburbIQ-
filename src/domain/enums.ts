export const USER_ROLES = ["customer", "admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REPORT_JOB_STATUSES = [
  "queued",
  "processing",
  "llm_generation_started",
  "llm_retry_1",
  "llm_retry_2",
  "llm_retry_3",
  "fallback_template_used",
  "rendering_html",
  "rendering_pdf",
  "completed",
  "failed",
  "refund_started",
  "credit_released",
  "quota_restored"
] as const;
export type ReportJobStatus = (typeof REPORT_JOB_STATUSES)[number];

export const CREDIT_STATUSES = [
  "available",
  "held",
  "captured",
  "released",
  "expired",
  "admin_adjusted"
] as const;
export type CreditStatus = (typeof CREDIT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "report_generating",
  "completed",
  "failed",
  "refunded",
  "partially_refunded",
  "manual_review_required"
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "payment_pending",
  "webhook_retrying",
  "payment_confirmed",
  "payment_failed",
  "manual_review_required",
  "refunded",
  "partially_refunded"
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "renewal_disabled",
  "expired",
  "payment_failed",
  "admin_extended"
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const DATA_RELEASE_STATUSES = [
  "draft",
  "uploaded",
  "validated",
  "change_report_generated",
  "awaiting_confirmation",
  "published",
  "rollback_in_progress",
  "rolled_back",
  "failed"
] as const;
export type DataReleaseStatus = (typeof DATA_RELEASE_STATUSES)[number];

export const SUPPORT_TICKET_STATUSES = [
  "open",
  "waiting_admin",
  "waiting_user",
  "escalated",
  "resolved",
  "closed"
] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const INBOX_MESSAGE_TYPES = [
  "report_completed",
  "report_failed",
  "refund_processed",
  "credit_returned",
  "admin_reply",
  "subscription_update",
  "monthly_market_update",
  "system_announcement"
] as const;
export type InboxMessageType = (typeof INBOX_MESSAGE_TYPES)[number];

export type EntitlementType = "credit" | "subscription" | "order";

export type ConfidenceBand =
  | "too_incomplete"
  | "insufficient"
  | "low"
  | "medium"
  | "high";
